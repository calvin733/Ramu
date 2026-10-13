import type { UploadedData, BusinessMetrics } from "@/lib/types";
import { normalizeName } from "@/lib/utils";
import { getImportedPrivateNames } from "./import-privacy";
import { entityLabel } from "@/lib/copy/entity-label";
import type { EntityCatalog } from "./model";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const ALIAS_PATTERN = /\b(?:PRODUCT|CHANNEL|GOAL)_[1-9]\d{0,5}_RAMU\b/g;

// This also runs server-side. Source-specific redaction and alias restoration
// remain local; no registry names, order IDs, or filenames leave the browser.
export function redactPrivateText(
  text: string,
  privateIdentifiers: readonly string[] = [],
) {
  let safe = text
    .normalize("NFKC")
    .replace(
      /[\u0000-\u0008\u000b-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g,
      "",
    )
    .replace(/```[\s\S]*?```/g, "[RAW_DATA]")
    .replace(/\[\s*\{[\s\S]*?\}\s*\]/g, "[RAW_DATA]")
    .replace(
      /\{(?=[^{}]*"(?:transactions|orderId|order_id|customer|worksheet|rows|notes)"\s*:)[^{}]*\}/gi,
      "[RAW_DATA]",
    )
    .split("\n")
    .map((line) =>
      /(?:\t.*\t)|(?:\b(?:date|tanggal|order_id|orderId|product_name|quantity)\b.*[,;].*[,;])|(?:\b\d{4}-\d{2}-\d{2}\b.*[,;\t])/.test(
        line,
      )
        ? "[RAW_DATA]"
        : line,
    )
    .join("\n");
  // Remove adjacent CSV/TSV rows as a block, including two-column headers.
  // Ordinary question lines stay intact so the user's intent is retained.
  const lines = safe.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    const tableLine = (line: string) =>
      /[;,\t]/.test(line) &&
      !/[?:]\s*$/.test(line) &&
      !/^(apa|bagaimana|kenapa|menurut|bandingkan|saya|kalau)\b/i.test(
        line.trim(),
      );
    if (
      tableLine(lines[i]) &&
      (tableLine(lines[i + 1]) || lines[i + 1] === "[RAW_DATA]")
    ) {
      lines[i] = "[RAW_DATA]";
      let j = i + 1;
      while (
        j < lines.length &&
        (tableLine(lines[j]) || lines[j] === "[RAW_DATA]")
      )
        lines[j++] = "[RAW_DATA]";
      i = j - 1;
    }
  }
  safe = lines.join("\n");
  for (const identifier of [...privateIdentifiers].sort(
    (a, b) => b.length - a.length,
  )) {
    if (identifier.trim().length < 3) continue;
    safe = safe.replace(
      new RegExp(
        `(?<![\\p{L}\\p{N}_])${escape(identifier)}(?![\\p{L}\\p{N}_])`,
        "giu",
      ),
      "[PRIVATE_ID]",
    );
  }
  return safe
    .replace(/\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/(?:https?:\/\/|www\.)[^\s<>]+/gi, "[URL]")
    .replace(
      /\b(?:[\w.-]+\.(?:com|id|net|org|co|io))(?:\/[^\s<>]*)?/gi,
      "[URL]",
    )
    .replace(/(?:\+?62|0)[\s().-]*8(?:[\s().-]*\d){7,12}\b/g, "[PHONE]")
    .replace(/\+\d(?:[\s().-]*\d){8,14}\b/g, "[PHONE]")
    .replace(/\b\(?\d{3}\)?[ .-]\d{3,4}[ .-]\d{4}\b/g, "[PHONE]")
    .replace(
      /\b(?:telepon|telp|phone|whatsapp|nomor hp|no\.? hp)\s*[:=]?\s*\+?\d[\d\s().-]{7,}/gi,
      "[PHONE]",
    )
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[PRIVATE_ID]")
    .replace(/\b\d{9,}\b/g, "[PRIVATE_ID]")
    .replace(
      /\b(?:INV|INVOICE|ORD|ORDER|TRX|TXN|ACC|ACCT|ACCOUNT)[-_][A-Z0-9][A-Z0-9_-]{2,}\b/gi,
      "[ORDER_ID]",
    )
    .replace(
      /\b(?:nomor\s+(?:pesanan|transaksi|rekening|akun)|order\s*(?:id|number)|invoice|NIK|no\.?\s*rekening)\s*[:#=]?\s*[A-Z0-9][A-Z0-9_.-]*/gi,
      "[PRIVATE_ID]",
    )
    .replace(/["'][^"'\n]+\.(?:xlsx?|csv|pdf|docx?)["']/gi, "[FILE]")
    .replace(
      /\b(?:file|berkas)\s+[^;\n]+?\.(?:xlsx?|csv|pdf|docx?)\b/gi,
      "[FILE]",
    )
    .replace(/[\p{L}\p{N}_().-]+\.(?:xlsx?|csv|pdf|docx?)\b/giu, "[FILE]")
    .replace(
      /\b(?:alamat(?:\s+(?:saya|pelanggan|rumah))?\s*[:=]?|Jl\.|Jalan)\s+[^;\n]+?(?=[;\n]|\s+(?:dan|tapi|tetapi)\s|$)/gi,
      "[ADDRESS]",
    )
    .replace(
      /\b(?:nama\s+(?:saya|pelanggan)|pelanggan\s+bernama|customer\s+name|Bapak|Ibu|Pak|Bu)\s*[:=]?\s*[^;,\n]+?(?=[;,\n]|\s+(?:dan|tapi|tetapi|bagaimana|berapa|fokus|menurut)\b|$)/giu,
      "[NAME]",
    )
    .trim();
}

export interface AliasEntry {
  entity: string;
  kind: "product" | "channel" | "goal";
  name: string;
  displayName: string;
  identified: boolean;
}
interface MatchNode {
  children: Map<string, MatchNode>;
  replacements: string[];
}
class LocalMatcher {
  private root: MatchNode = { children: new Map(), replacements: [] };
  add(name: string, replacement: string) {
    let node = this.root;
    for (const raw of name.normalize("NFKC").replace(/\s+/g, " ").trim()) {
      const character = raw.toLocaleLowerCase("id-ID");
      if (!node.children.has(character))
        node.children.set(character, { children: new Map(), replacements: [] });
      node = node.children.get(character)!;
    }
    if (!node.replacements.includes(replacement))
      node.replacements.push(replacement);
  }
  replace(text: string) {
    const characters = Array.from(text);
    const lower = characters.map((c) => c.toLocaleLowerCase("id-ID"));
    const word = (c: string) => /[\p{L}\p{N}_]/u.test(c);
    let result = "";
    for (let i = 0; i < characters.length;) {
      let node = this.root,
        end = i,
        replacement = "";
      if (i === 0 || !word(characters[i - 1]) || !word(characters[i]))
        for (let j = i; j < characters.length; j++) {
          const whitespace = /\s/u.test(characters[j]);
          const next = node.children.get(whitespace ? " " : lower[j]);
          if (!next) break;
          node = next;
          if (whitespace)
            while (j + 1 < characters.length && /\s/u.test(characters[j + 1]))
              j++;
          if (
            node.replacements.length &&
            (j + 1 === characters.length || !word(characters[j + 1]))
          ) {
            end = j + 1;
            replacement = node.replacements.join(" / ");
          }
        }
      if (replacement) {
        result += replacement;
        i = end;
      } else {
        result += characters[i];
        i++;
      }
    }
    return result;
  }
}
export class EntityRegistry {
  private metricViews = new WeakMap<BusinessMetrics, BusinessMetrics>();
  private entries: AliasEntry[] = [];
  private names = new LocalMatcher();
  private identifiers = new LocalMatcher();
  private byKey = new Map<string, AliasEntry>();
  private byAlias = new Map<string, AliasEntry>();
  private counts = { product: 0, channel: 0, goal: 0 };
  constructor(
    data: UploadedData,
    metrics: { products: { name: string }[]; channels: { name: string }[] },
  ) {
    const importedNameSet = new Set(getImportedPrivateNames(data));
    const privateIdentifiers = [
      ...new Set(
        [
          data.source.name,
          ...getImportedPrivateNames(data),
          ...data.transactions.flatMap((t) => [t.orderId, t.productId ?? ""]),
          ...data.products.map((p) => p.id ?? ""),
          ...data.transactions.flatMap((t) => {
            const record = t as unknown as Record<string, unknown>;
            return [
              "customerName",
              "customer_name",
              "buyerName",
              "nama_pelanggan",
            ].flatMap((key) =>
              typeof record[key] === "string" ? [record[key] as string] : [],
            );
          }),
        ].filter(
          (id) =>
            importedNameSet.has(id) ||
            (id.length >= 3 && (!/^\d+$/.test(id) || id.length >= 9)),
        ),
      ),
    ];
    privateIdentifiers.forEach((id) =>
      this.identifiers.add(id, "[PRIVATE_ID]"),
    );
    for (const name of [
      ...metrics.products.map((p) => p.name),
      ...data.products.map((p) => p.name),
      ...data.transactions.map((t) => t.productName),
    ].filter(Boolean))
      this.register(name, "product");
    for (const name of [
      ...metrics.channels.map((c) => c.name),
      ...data.transactions.map((t) => t.channel ?? ""),
    ].filter(Boolean))
      this.register(name, "channel");
  }
  register(name: string, kind: AliasEntry["kind"], displayName = name) {
    const key = `${kind}:${kind === "product" ? normalizeName(name.normalize("NFKC")) : name}`;
    const existing = this.byKey.get(key);
    if (existing) {
      if (displayName !== name) existing.displayName = displayName;
      return existing.entity;
    }
    const entity = `${kind.toUpperCase()}_${++this.counts[kind]}_RAMU`;
    const entry = {
      entity,
      kind,
      name,
      displayName,
      identified: kind === "goal" || entityLabel(name, kind) === name,
    };
    this.entries.push(entry);
    this.byKey.set(key, entry);
    this.byAlias.set(entity, entry);
    if (kind !== "goal") this.names.add(name, entity);
    return entity;
  }
  get(entity: string) {
    return this.byAlias.get(entity);
  }
  queryView(metrics: BusinessMetrics): BusinessMetrics {
    let view = this.metricViews.get(metrics);
    if (!view) {
      // Name projection only; numerical values/calculations stay unchanged.
      view = {
        ...metrics,
        products: metrics.products.map((p) => ({
          ...p,
          name: this.alias(p.name, "product"),
        })),
        channels: metrics.channels
          .filter((c) => c.name !== "Tanpa kanal")
          .map((c) => ({ ...c, name: this.alias(c.name, "channel") })),
      };
      this.metricViews.set(metrics, view);
    }
    return view;
  }
  alias(name: string, kind: AliasEntry["kind"]) {
    return this.register(name, kind);
  }
  sanitize(text: string) {
    return redactPrivateText(
      this.identifiers.replace(this.names.replace(text.normalize("NFKC"))),
    );
  }
  restore(text: string) {
    return text.replace(ALIAS_PATTERN, (alias) => {
      const entry = this.get(alias);
      if (!entry) throw new Error("Unknown display alias");
      return entry.kind === "goal"
        ? entry.displayName
        : entityLabel(entry.name, entry.kind);
    });
  }
  catalog(priority: string[] = []): EntityCatalog {
    const ordered = [
      ...priority
        .map((a) => this.get(a))
        .filter((e): e is AliasEntry => Boolean(e)),
      ...["product", "channel", "goal"].flatMap((kind) =>
        this.entries.filter((e) => e.kind === kind).slice(0, 8),
      ),
      ...this.entries,
    ];
    const unique = [
      ...new Map(ordered.map((e) => [e.entity, e])).values(),
    ].slice(0, 40);
    return unique.map(({ entity, kind, identified }) => ({
      entity,
      kind,
      identified,
    }));
  }
}
