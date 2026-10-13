import type { BusinessMetrics } from "@/lib/types";
import type { GoalProgress } from "@/lib/goals";
import { goalAlias } from "./retrieval";
import { understandQuery, type BusinessQuery } from "@/lib/queries";
import { unsupportedReason } from "@/lib/queries/understand";
import { ALIAS_PATTERN, EntityRegistry } from "./privacy";
import {
  assertKnownEntities,
  planSchema,
  type BusinessQueryPlan,
  type InformationRequest,
  type PlannerInput,
  type RamuConversationState,
  type UnsupportedTopic,
} from "./model";

export function unsupportedTopics(question: string): UnsupportedTopic[] {
  const q = question.toLowerCase();
  return [
    /pelanggan|customer|pembeli|retensi|loyalitas/.test(q) ? "customers" : null,
    /prediksi|forecast|ramal|besok|bulan depan|tahun depan|next month/.test(q)
      ? "forecast"
      : null,
    /\bstok\b|inventory|persediaan/.test(q) ? "inventory" : null,
    /pajak|\btax\b|ppn|pph/.test(q) ? "tax" : null,
    /laba bersih|net profit/.test(q) && !/target|goal|tujuan/.test(q)
      ? "net_profit"
      : null,
  ].filter((t): t is UnsupportedTopic => t !== null);
}
const planFor = (
  requests: InformationRequest[],
  intent: BusinessQueryPlan["intent"] = "lookup",
  responseGoal: BusinessQueryPlan["responseGoal"] = "direct_answer",
  unsupported: UnsupportedTopic[] = [],
): BusinessQueryPlan => ({ intent, requests, responseGoal, unsupported });
const toRequest = (
  query: BusinessQuery,
  registry: EntityRegistry,
): InformationRequest => ({
  ...query,
  ...(query.topic === "aov" ? { metric: "aov" as const } : {}),
  ...(query.operation === "change" &&
  ["orders", "profit"].includes(query.topic) &&
  query.metric === "growth"
    ? {
        metric:
          query.topic === "orders"
            ? ("orders" as const)
            : ("grossProfit" as const),
      }
    : {}),
  entities: query.entities.map((name) =>
    registry.get(name)
      ? name
      : registry.alias(
          name,
          query.topic === "channels" ? "channel" : "product",
        ),
  ),
});
const previousQuery = (state: RamuConversationState): BusinessQuery | null => {
  const request =
    state.lastPlan?.requests.find(
      (r) => r.topic === "channels" || r.topic === "products",
    ) ?? state.lastPlan?.requests[0];
  if (!request || request.topic === "trends") return null;
  return {
    ...request,
    entities: request.entities,
  } as BusinessQuery;
};
const broadRequests = (): InformationRequest[] => [
  { topic: "overview", operation: "summary", entities: [] },
  { topic: "products", operation: "ranking", metric: "revenue", entities: [] },
  { topic: "channels", operation: "ranking", metric: "revenue", entities: [] },
  { topic: "warnings", operation: "summary", entities: [] },
  { topic: "goals", operation: "status", entities: [] },
  { topic: "trends", operation: "summary", entities: [] },
];

// Confidence routing, not another exhaustive language parser. Anything uncertain
// gets the AI planner; these small rules only provide offline continuity.
export function preparePlan(
  question: string,
  metrics: BusinessMetrics,
  goals: GoalProgress[],
  registry: EntityRegistry,
  memory: RamuConversationState,
) {
  for (const p of goals) goalAlias(p, registry);
  const sanitized = registry.sanitize(question);
  const localText = sanitized;
  const queryMetrics = registry.queryView(metrics);
  const previous = previousQuery(memory);
  const unsupported = unsupportedTopics(sanitized);
  const clauses = localText.split(/\s+(?:dan|serta|and)\s+|[;?!]/i);
  const supportedClauses = unsupported.length
    ? clauses.filter((c) => c.trim() && !unsupportedReason(c))
    : [];
  const partial = supportedClauses
    .map((c) => understandQuery(c, queryMetrics))
    .filter((q): q is BusinessQuery => Boolean(q));
  let query = understandQuery(localText, queryMetrics, previous);
  if (
    query?.topic === "overview" &&
    /berapa.*penjualan|penjualan.*berapa/i.test(localText)
  )
    query = {
      topic: "revenue",
      operation: "summary",
      metric: "revenue",
      entities: [],
    };
  const followup =
    memory.recentTurns.length > 0 &&
    /^(kalau|yang |kenapa|mengapa|terus|jadi|apa risikonya|bedanya|bandingkan keduanya|bagaimana dengan)/i.test(
      localText,
    );
  const strategic =
    /kenapa|mengapa|sebaiknya|menurut|fokus|peluang|masalah|ketergantungan|hal.*penting|paling penting|risiko|strategi|apa.*lakukan/i.test(
      localText,
    );
  const multiTopic =
    /\b(?:dan|atau|and|or)\b/i.test(localText) &&
    [
      /produk|product|PRODUCT_\d+_RAMU/i.test(sanitized),
      /channel|kanal|marketplace|CHANNEL_\d+_RAMU/i.test(sanitized),
      /pendapatan|omzet|revenue|penjualan/i.test(sanitized),
      /pesanan|orders?/i.test(sanitized),
      /laba|profit|margin/i.test(sanitized),
      /target|goal/i.test(sanitized),
    ].filter(Boolean).length > 1 &&
    !(query?.operation === "compare" && query.entities.length >= 2);
  let fallback: BusinessQueryPlan;
  if (partial.length)
    fallback = planFor(
      partial.slice(0, 6).map((q) => toRequest(q, registry)),
      "lookup",
      "direct_answer",
      unsupported,
    );
  else if (unsupported.length)
    fallback = planFor([], "lookup", "direct_answer", unsupported);
  else {
    const focused = memory.focusEntities.filter(
      (a) => registry.get(a)?.kind === "product",
    );
    if (
      followup &&
      focused.length &&
      query?.topic === "profit" &&
      !/bisnis|total|semua/i.test(localText)
    )
      query = {
        ...query,
        topic: "products",
        entities: focused,
        metric: query.metric ?? "grossProfit",
        operation: "summary",
      };
    if (query?.topic === "overview" && !strategic && !multiTopic)
      fallback = planFor(broadRequests(), "explain", "direct_answer");
    else if (
      query &&
      !strategic &&
      !multiTopic &&
      !(query.operation === "compare" && query.entities.length < 2)
    )
      fallback = planFor(
        [toRequest(query, registry)],
        followup
          ? "follow_up"
          : query.operation === "compare"
            ? "compare"
            : "lookup",
        query.operation === "compare" ? "compare_options" : "direct_answer",
      );
    else if (
      followup &&
      previous &&
      /bedanya|bandingkan keduanya/i.test(localText)
    ) {
      const refs = memory.referencedEntities
        .filter(
          (a) =>
            registry.get(a)?.kind ===
            (previous.topic === "channels" ? "channel" : "product"),
        )
        .slice(0, 2);
      fallback = planFor(
        [
          {
            topic: previous.topic,
            operation: "compare",
            metric: previous.metric ?? "revenue",
            entities: refs,
          },
        ],
        "follow_up",
        "compare_options",
      );
    } else if (
      followup &&
      previous &&
      strategic &&
      previous.topic === "channels"
    )
      fallback = planFor(
        [
          {
            topic: "channels",
            operation: "ranking",
            metric: "revenue",
            entities: [],
          },
        ],
        "recommend",
        "identify_focus",
      );
    else
      fallback = planFor(
        broadRequests(),
        /target|kejar/i.test(localText)
          ? "recommend"
          : /kenapa|masalah/i.test(localText)
            ? "diagnose"
            : "prioritize",
        /target|kejar/i.test(localText) ? "support_goal" : "identify_focus",
      );
  }
  const needsPlanner = unsupported.length
    ? partial.length > 0 ||
      strategic ||
      /produk|channel|kanal|omzet|pendapatan|target/i.test(localText)
    : !query ||
      strategic ||
      multiTopic ||
      (query.operation === "compare" && query.entities.length < 2) ||
      (followup && !query.rank && !/terendah|paling rendah/i.test(localText));
  const priority = [
    ...(sanitized.match(ALIAS_PATTERN) ?? []),
    ...memory.focusEntities,
    ...memory.referencedEntities,
  ];
  const planner: PlannerInput = {
    question: sanitized.slice(0, 1400) || "Pertanyaan bisnis",
    memory,
    catalog: registry.catalog(priority),
    availableTopics: [
      "overview",
      "revenue",
      "growth",
      "trends",
      "warnings",
      ...(metrics.capabilities.products ? ["products" as const] : []),
      ...(metrics.channels.some((c) => c.name !== "Tanpa kanal")
        ? ["channels" as const]
        : []),
      ...(goals.length ? ["goals" as const] : []),
      "profit",
      "orders",
      "units",
      "aov",
    ],
  };
  return { planner, fallback: planSchema.parse(fallback), needsPlanner };
}
export function acceptPlan(
  candidate: unknown,
  input: PlannerInput,
  fallback: BusinessQueryPlan,
) {
  const plan = planSchema.parse(candidate);
  assertKnownEntities(plan, input.catalog);
  // A planner cannot erase known unsupported parts of a mixed question.
  return {
    ...plan,
    unsupported: [...new Set([...fallback.unsupported, ...plan.unsupported])],
  };
}
