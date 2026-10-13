import { entityLabel } from "@/lib/copy/entity-label";
import type { VerifiedBusinessAnswer } from "@/lib/queries/model";
import { EntityRegistry } from "@/lib/chat/privacy";

// Only closed query fields and numeric facts go to Gemini. Free-form questions,
// source filenames, narrative text, and real business entity names stay out.
export function prepareChatFacts(
  answer: VerifiedBusinessAnswer,
  period: {
    start: string;
    end: string;
    days: number;
    previousStart: string | null;
    previousEnd: string | null;
  },
) {
  const aliases = new Map<string, string>();
  const alias = (name: string) => {
    if (!aliases.has(name))
      aliases.set(name, `ENTITAS_${aliases.size + 1}_RAMU`);
    return aliases.get(name)!;
  };
  const facts = answer.facts.map((f) => ({
    ...f,
    ...(f.entity ? { entity: alias(f.entity) } : {}),
  }));
  const query = answer.query
    ? { ...answer.query, entities: answer.query.entities.map(alias) }
    : null;
  return {
    payload: {
      verifiedQuery: query,
      period,
      verifiedFacts: facts,
      limitations: answer.limitations,
    },
    restore: (text: string) =>
      text.replace(/ENTITAS_\d+_RAMU/g, (token) => {
        const name = [...aliases].find(([, v]) => v === token)?.[0];
        return name
          ? entityLabel(
              name,
              answer.query?.topic === "channels" ? "channel" : "product",
            )
          : token;
      }),
  };
}

// Dashboard/goal explanation callers keep their existing summary contract, but
// names and generated prose are no longer sent unfiltered to the provider.
export function prepareExplanationContext(context: {
  products: { name: string }[];
  channels?: { name: string }[];
  goals?: { supportingProducts: { name: string }[] }[];
}) {
  const products = [
    ...context.products,
    ...(context.goals ?? []).flatMap((g) => g.supportingProducts),
  ];
  const registry = new EntityRegistry(
    {
      transactions: [],
      products: products.map((p) => ({ name: p.name })),
      expenses: [],
      source: { name: "", kind: "demo", loadedAt: "" },
    },
    { products, channels: context.channels ?? [] },
  );
  const privateProse = new Set([
    "answer",
    "fallback",
    "fallbackText",
    "title",
    "body",
    "action",
    "missing",
  ]);
  const scrub = (
    value: unknown,
    key = "",
    kind: "product" | "channel" = "product",
  ): unknown => {
    if (typeof value === "string") {
      if (key === "name") return registry.alias(value, kind);
      if (
        key === "id" &&
        !["growth", "top", "margin", "cost", "strong"].includes(value)
      )
        return "insight";
      return value;
    }
    if (Array.isArray(value))
      return value.map((v) =>
        scrub(v, key, key === "channels" ? "channel" : "product"),
      );
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => !privateProse.has(key))
          .map(([key, v]) => [key, scrub(v, key, kind)]),
      );
    return value;
  };
  return {
    payload: scrub(context),
    restore: (text: string) => registry.restore(text),
  };
}
