import { z } from "zod";

export const businessQuerySchema = z
  .object({
    topic: z.enum([
      "overview",
      "revenue",
      "profit",
      "orders",
      "aov",
      "units",
      "products",
      "channels",
      "growth",
      "goals",
      "warnings",
    ]),
    operation: z.enum([
      "summary",
      "top",
      "bottom",
      "ranking",
      "contribution",
      "compare",
      "change",
      "status",
      "remaining",
      "pace",
    ]),
    entities: z.array(z.string().min(1).max(200)).max(8),
    metric: z
      .enum([
        "revenue",
        "units",
        "orders",
        "aov",
        "grossProfit",
        "netProfit",
        "margin",
        "growth",
        "contribution",
      ])
      .optional(),
    rank: z.number().int().min(1).max(100).optional(),
    goalPeriod: z.enum(["daily", "monthly", "yearly"]).optional(),
  })
  .strict();
export type BusinessQuery = z.infer<typeof businessQuerySchema>;

// Closed fields keep arbitrary business text out of the provider's fact labels.
export const factSchema = z
  .object({
    entity: z.string().min(1).max(200).optional(),
    field: z.enum([
      "revenue",
      "units",
      "orders",
      "aov",
      "grossProfit",
      "margin",
      "growth",
      "orderGrowth",
      "aovGrowth",
      "profitGrowth",
      "contribution",
      "target",
      "actual",
      "progress",
      "remaining",
      "expectedProgress",
      "daysRemaining",
      "requiredPace",
    ]),
    value: z.number().finite().min(-1e30).max(1e30).nullable(),
    format: z.enum(["currency", "number", "percent"]),
    goal: z
      .object({
        metric: z.enum([
          "revenue",
          "orders",
          "units",
          "grossProfit",
          "netProfit",
        ]),
        period: z.enum(["daily", "monthly", "yearly"]),
        start: z.iso.date(),
        end: z.iso.date(),
        referenceDate: z.iso.date(),
      })
      .strict()
      .optional(),
  })
  .strict();
export const verifiedAnswerSchema = z
  .object({
    query: businessQuerySchema.nullable(),
    status: z.enum(["answered", "unavailable", "unsupported", "clarification"]),
    facts: z.array(factSchema).max(64),
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
    fallbackText: z.string().min(1).max(12000),
  })
  .strict();
export type VerifiedBusinessAnswer = z.infer<typeof verifiedAnswerSchema>;
export type BusinessFact = z.infer<typeof factSchema>;
