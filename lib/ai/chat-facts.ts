import { entityLabel } from "@/lib/copy/entity-label";
import type { VerifiedBusinessAnswer } from "@/lib/queries/model";

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
