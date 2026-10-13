import {
  formatDate,
  formatNumber,
  formatPercentage,
  formatRupiah,
} from "@/lib/utils";
import { ALIAS_PATTERN, redactPrivateText } from "./privacy";
import {
  reasoningSchema,
  type BusinessSnapshot,
  type EntityCatalog,
} from "./model";

// The model chooses words and verified fact references, never final numbers.
// Rendering happens in RAMU, so invented amounts/percentages are rejected.
export function renderGroundedReasoning(
  value: unknown,
  snapshot: BusinessSnapshot,
  catalog: EntityCatalog,
) {
  const { paragraphs } = reasoningSchema.parse(value);
  const facts = new Map(snapshot.facts.map((f) => [f.id, f]));
  const known = new Set(catalog.map((e) => e.entity));
  return paragraphs
    .map((paragraph) => {
      for (const alias of paragraph.match(ALIAS_PATTERN) ?? [])
        if (!known.has(alias)) throw new Error("Unknown reasoning entity");
      const prose = paragraph
        .replace(ALIAS_PATTERN, "")
        .replace(/\{\{(?:F[1-9]\d{0,2}|PERIOD)\}\}/g, "");
      if (/\p{N}/u.test(prose) || /\{\{|\}\}|ENTITAS_\d+_RAMU/.test(prose))
        throw new Error("Unverified numeric prose");
      if (
        /\b(?:nol|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|seratus|seribu|puluhan|ratusan|ribuan|jutaan|miliaran|setengah|zero|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|half|hundred)(?:\s+(?:belas|puluh|ratus|thousand|million|billion))*\s+(?:kali|persen|percent|times|juta|ribu|miliar|rupiah|pesanan|unit)\b/i.test(
          prose,
        )
      )
        throw new Error("Unverified number words");
      if (redactPrivateText(prose) !== prose.trim())
        throw new Error("Private reasoning output");
      return paragraph.replace(
        /\{\{(F[1-9]\d{0,2}|PERIOD)\}\}/g,
        (_, id: string) => {
          if (id === "PERIOD")
            return `${formatDate(snapshot.period.start)}–${formatDate(snapshot.period.end)}`;
          const fact = facts.get(id);
          if (!fact || fact.value === null)
            throw new Error("Unknown or unavailable fact reference");
          return fact.format === "currency"
            ? formatRupiah(fact.value)
            : fact.format === "percent"
              ? formatPercentage(fact.value)
              : formatNumber(fact.value);
        },
      );
    })
    .join("\n\n");
}
