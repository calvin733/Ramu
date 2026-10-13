import { z } from "zod";
import { businessQuerySchema, factSchema } from "@/lib/queries/model";

export const MAX_RECENT_TURNS = 6;
export const aliasSchema = z
  .string()
  .regex(/^(PRODUCT|CHANNEL|GOAL)_[1-9]\d{0,5}_RAMU$/);
export const topicSchema = z.enum([
  ...businessQuerySchema.shape.topic.options,
  "trends",
]);
export const requestSchema = businessQuerySchema.extend({
  topic: topicSchema,
  entities: z.array(aliasSchema).max(8),
});
export const unsupportedSchema = z.enum([
  "customers",
  "forecast",
  "inventory",
  "tax",
  "net_profit",
]);
export const planSchema = z
  .object({
    intent: z.enum([
      "lookup",
      "compare",
      "diagnose",
      "prioritize",
      "recommend",
      "explain",
      "follow_up",
    ]),
    requests: z.array(requestSchema).max(6),
    responseGoal: z.enum([
      "direct_answer",
      "compare_options",
      "explain_risks",
      "identify_focus",
      "support_goal",
      "clarify",
    ]),
    unsupported: z.array(unsupportedSchema).max(5),
  })
  .strict();
export type BusinessQueryPlan = z.infer<typeof planSchema>;
export type InformationRequest = z.infer<typeof requestSchema>;
export type BusinessTopic = z.infer<typeof topicSchema>;
export type UnsupportedTopic = z.infer<typeof unsupportedSchema>;

const factReferenceSchema = z
  .string()
  .max(160)
  .refine((value) => {
    const [subject, field, ...scope] = value.split(":");
    if (
      !aliasSchema.safeParse(subject).success &&
      !topicSchema.safeParse(subject).success
    )
      return false;
    if (!factSchema.shape.field.safeParse(field).success) return false;
    if (!scope.length) return true;
    if (scope.length === 2)
      return (
        ["day", "week", "month"].includes(scope[0]) &&
        z.iso.date().safeParse(scope[1]).success
      );
    return (
      scope.length === 3 &&
      ["revenue", "orders", "units", "grossProfit", "netProfit"].includes(
        scope[0],
      ) &&
      ["daily", "monthly", "yearly"].includes(scope[1]) &&
      z.iso.date().safeParse(scope[2]).success
    );
  }, "Invalid closed fact reference");

export const memorySchema = z
  .object({
    recentTurns: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: z.string().min(1).max(2400),
          })
          .strict(),
      )
      .max(MAX_RECENT_TURNS),
    lastPlan: planSchema.nullable(),
    activeTopics: z.array(topicSchema).max(12),
    referencedEntities: z.array(aliasSchema).max(8),
    focusEntities: z.array(aliasSchema).max(8),
    lastReferencedFacts: z.array(factReferenceSchema).max(16),
  })
  .strict();
export type RamuConversationState = z.infer<typeof memorySchema>;
export const catalogSchema = z
  .array(
    z
      .object({
        entity: aliasSchema,
        kind: z.enum(["product", "channel", "goal"]),
        identified: z.boolean(),
      })
      .strict(),
  )
  .max(40);
export type EntityCatalog = z.infer<typeof catalogSchema>;
export const plannerInputSchema = z
  .object({
    question: z.string().trim().min(1).max(1400),
    memory: memorySchema,
    catalog: catalogSchema,
    availableTopics: z.array(topicSchema).max(12),
  })
  .strict();
export type PlannerInput = z.infer<typeof plannerInputSchema>;

const periodSchema = z
  .object({
    start: z.iso.date(),
    end: z.iso.date(),
    days: z.number().int().min(1).max(30),
    previousStart: z.iso.date().nullable(),
    previousEnd: z.iso.date().nullable(),
  })
  .strict();
export const snapshotSchema = z
  .object({
    period: periodSchema,
    dataPeriod: z.object({ start: z.iso.date(), end: z.iso.date() }).strict(),
    facts: z
      .array(
        factSchema.extend({
          id: z.string().regex(/^F[1-9]\d{0,2}$/),
          topic: topicSchema,
          entity: aliasSchema.optional(),
          bucket: z
            .object({
              date: z.iso.date(),
              unit: z.enum(["day", "week", "month"]),
            })
            .strict()
            .optional(),
        }),
      )
      .max(128),
    warnings: z
      .array(
        z
          .object({
            code: z.enum(["growth", "top", "margin", "cost", "strong"]),
            kind: z.enum(["opportunity", "warning", "performance"]),
          })
          .strict(),
      )
      .max(4),
    results: z
      .array(
        z
          .object({
            topic: topicSchema,
            status: z.enum([
              "answered",
              "unavailable",
              "unsupported",
              "clarification",
            ]),
          })
          .strict(),
      )
      .max(6),
    limitations: z
      .array(
        z.enum([
          "available_products_only",
          "unassigned_channel",
          "goal_periods",
          "historical_comparison",
        ]),
      )
      .max(4),
  })
  .strict();
export type BusinessSnapshot = z.infer<typeof snapshotSchema>;
export const conversationInputSchema = plannerInputSchema
  .omit({ availableTopics: true })
  .extend({
    kind: z.literal("conversation"),
    plan: planSchema,
    snapshot: snapshotSchema,
    fallback: z.string().min(1).max(12000),
  });
export type ConversationInput = z.infer<typeof conversationInputSchema>;
export const reasoningSchema = z
  .object({
    paragraphs: z.array(z.string().trim().min(1).max(1600)).min(1).max(3),
  })
  .strict();

export function assertKnownEntities(
  plan: BusinessQueryPlan,
  catalog: EntityCatalog,
) {
  const known = new Map(catalog.map((e) => [e.entity, e.kind]));
  for (const request of plan.requests) {
    if (
      request.entities.length &&
      !["products", "channels", "goals"].includes(request.topic)
    )
      throw new Error("Entities require a typed aggregate request");
    for (const entity of request.entities) {
      const kind = known.get(entity);
      if (
        !kind ||
        (request.topic === "products" && kind !== "product") ||
        (request.topic === "channels" && kind !== "channel") ||
        (request.topic === "goals" && kind !== "goal")
      )
        throw new Error("Unknown or incompatible entity");
    }
  }
}
