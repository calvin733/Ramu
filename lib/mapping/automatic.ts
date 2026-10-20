import {
  aliases,
  allowedFields,
  fields,
  isPii,
  normalizeHeader,
  normalizeImport,
  type Field,
  type ImportDocument,
  type ImportSheet,
  type SheetType,
} from "./index";
import { registerImportedPrivacy } from "@/lib/chat/import-privacy";
import type { UploadedData } from "@/lib/types";
import { normalizeName } from "@/lib/utils";

export interface ImportIssue {
  id: string;
  kind: "sheet" | "sales-sheets" | "field" | "meaning" | "omit";
  sheetId?: string;
  field?: Field;
  source?: string;
  question: string;
  detail?: string;
  options: { value: string; label: string }[];
}
export type ImportAssessment =
  | { kind: "ready"; data: UploadedData }
  | { kind: "clarify"; issue: ImportIssue }
  | { kind: "invalid"; message: string };
export type ImportConfirmations = ReadonlySet<string>;
const key = (s: ImportSheet, field: string) => `${s.id}:${field}`;
const mapped = (s: ImportSheet, field: Field) =>
  s.mapping.filter((m) => m.target === field);
const salesName = /penjualan|sales|transactions|transaksi|orders/;
const payoutName =
  /payout|settlement|danaditerima|danacair|pencairan|saldomasuk|netpayment|nett?received|cashreceived|pengeluaran|expenses?|refund|retur/;
const moneyName =
  /total|amount|nominal|nilai|pendapat|penjual|harga|price|biaya|cost|sales|revenue|payout|pembayar|payment|paid|potongan|diskon|hpp|fee|ongkir|refund|retur|saldo/;
const paymentValue =
  /^(?:cash|tunai|transfer(?: bank)?|qris|bca|bni|bri|mandiri|gopay|ovo|dana|kartu kredit|debit|credit card|bank transfer)$/i;
const summaryValue =
  /^(?:grand\s*total|sub\s*total|total(?:\s+(?:penjualan|keseluruhan|semua))?|jumlah\s+keseluruhan)$/i;

export function friendlyImportError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "File belum bisa diproses. Periksa tanggal dan angka penjualan Anda.";
  return message
    .replace(/\bdate\b/g, "tanggal")
    .replace(/\bquantity\b/g, "jumlah")
    .replace(/\bunit_price\b/g, "harga satuan")
    .replace(/\brevenue\b/g, "penjualan")
    .replace(/\bdiscount\b/g, "diskon")
    .replace(/\bproduct_name\b/g, "nama produk")
    .replace(/\bCOGS\b/g, "biaya produk")
    .replace(/\border_id\b/g, "nomor pesanan");
}
function checkSummaryRows(document: ImportDocument) {
  for (const sheet of document.sheets.filter(
    (s) => s.sheetType === "transactions",
  )) {
    const identifiers = sheet.mapping.filter(
      (m) => m.target === "order_id" || m.target === "product_name",
    );
    if (
      sheet.rows.some((row) =>
        identifiers.some((m) =>
          summaryValue.test(String(row[m.source] ?? "").trim()),
        ),
      )
    )
      throw new Error(
        `Sheet ${sheet.name} memuat baris total atau subtotal bersama transaksi. Hapus baris ringkasan tersebut agar penjualan tidak dihitung dua kali, lalu unggah kembali.`,
      );
  }
}
// Both automatic and explicitly confirmed manual imports use the same validation
// and browser-only privacy registration. Expense coverage is NEVER inferred.
export function prepareImportedData(
  document: ImportDocument,
  expensesComplete = false,
) {
  checkSummaryRows(document);
  const data = normalizeImport(document, expensesComplete);
  registerImportedPrivacy(data, document);
  return data;
}
function fieldIssue(
  s: ImportSheet,
  field: Field,
  duplicate = false,
  confirmed: ImportConfirmations = new Set(),
): ImportIssue {
  return {
    id: key(s, `field:${field}`),
    kind: "field",
    sheetId: s.id,
    field,
    question: duplicate
      ? `Ada dua kolom yang terlihat seperti ${fields[field].toLowerCase()}. Mana yang sesuai?`
      : `Kolom mana yang menunjukkan ${fields[field].toLowerCase()}?`,
    detail: `Pada sheet ${s.name}. Pilih kolom dari file Anda; file tidak perlu diunggah ulang.`,
    options: s.columns
      .filter(
        (c) => !isPii(c) && !confirmed.has(key(s, `reject:${field}:${c}`)),
      )
      .map((c) => ({ value: c, label: c })),
  };
}
function meaningIssue(
  s: ImportSheet,
  field: Field,
  source: string,
): ImportIssue {
  return {
    id: key(s, `meaning:${field}:${source}`),
    kind: "meaning",
    sheetId: s.id,
    field,
    source,
    question:
      field === "revenue"
        ? `Apakah “${source}” adalah total penjualan?`
        : field === "cogs"
          ? `Apakah “${source}” adalah biaya produk per unit?`
          : `Apakah “${source}” berisi channel penjualan, bukan metode pembayaran?`,
    detail:
      field === "revenue"
        ? "Dana yang diterima setelah potongan marketplace berbeda dari penjualan. Jangan gunakan angka pencairan sebagai penjualan."
        : field === "cogs"
          ? "Biaya total untuk beberapa unit tidak bisa dibaca sebagai biaya per unit."
          : "Contoh channel: toko, Shopee, atau Tokopedia. Transfer bank dan QRIS adalah metode pembayaran.",
    options: [
      {
        value: "confirm",
        label:
          field === "revenue"
            ? "Ya, ini total penjualan"
            : field === "cogs"
              ? "Ya, biaya per unit"
              : "Ya, ini channel penjualan",
      },
      { value: "ignore", label: "Bukan, jangan gunakan kolom ini" },
    ],
  };
}
export function assessAutomaticImport(
  document: ImportDocument,
  confirmed: ImportConfirmations = new Set(),
): ImportAssessment {
  const clarify = (issue: ImportIssue): ImportAssessment => ({
    kind: "clarify",
    issue,
  });
  const populated = document.sheets.filter((s) => s.rows.length);
  for (const s of populated) {
    const hits = (field: Field) =>
      s.columns.some((c) =>
        aliases[field].some((a) => normalizeHeader(a) === normalizeHeader(c)),
      );
    const resemblesSales =
      hits("date") &&
      (hits("revenue") || (hits("quantity") && hits("unit_price")));
    if (
      (s.sheetType === "unknown" ||
        (s.sheetType !== "transactions" && resemblesSales)) &&
      !confirmed.has(key(s, "sheet"))
    )
      return clarify({
        id: key(s, "sheet"),
        kind: "sheet",
        sheetId: s.id,
        question: `Apa isi sheet “${s.name}”?`,
        detail:
          "Kami perlu memastikan bagian ini tidak mengubah total bisnis Anda.",
        options: [
          { value: "transactions", label: "Transaksi penjualan" },
          { value: "products", label: "Daftar produk" },
          { value: "expenses", label: "Biaya operasional" },
          { value: "unknown", label: "Tidak perlu dianalisis, abaikan" },
        ],
      });
  }
  const sales = populated.filter((s) => s.sheetType === "transactions");
  if (!sales.length) {
    const s =
      populated.find((s) => !confirmed.has(key(s, "sheet"))) ?? populated[0];
    if (!s)
      return {
        kind: "invalid",
        message: "File belum berisi transaksi penjualan.",
      };
    return clarify({
      id: key(s, "sheet"),
      kind: "sheet",
      sheetId: s.id,
      question: "Sheet mana yang berisi transaksi penjualan?",
      detail: `Saat ini memilih ${s.name}. Atur sheet lain secara manual bila diperlukan.`,
      options: [{ value: "transactions", label: `${s.name} berisi penjualan` }],
    });
  }
  if (sales.length > 1 && !confirmed.has("sales-sheets"))
    return clarify({
      id: "sales-sheets",
      kind: "sales-sheets",
      question: "Sheet penjualan mana yang ingin dianalisis?",
      detail:
        "Pilih transaksi asli. Jangan gabungkan rekap dan rincian transaksi yang sama karena penjualan akan terhitung dua kali.",
      options: [
        ...sales.map((s) => ({ value: s.id, label: `Gunakan ${s.name}` })),
        {
          value: "combine",
          label: "Gabungkan: semua sheet berisi transaksi yang berbeda",
        },
      ],
    });
  for (const s of populated.filter((s) => s.sheetType !== "unknown")) {
    for (const field of allowedFields[s.sheetType]) {
      const entries = mapped(s, field);
      if (entries.length > 1) return clarify(fieldIssue(s, field, true));
      if (
        entries.length &&
        (isPii(entries[0].source) || !s.columns.includes(entries[0].source))
      )
        return {
          kind: "invalid",
          message:
            "Kolom data pribadi tidak digunakan untuk analisis. Pilih kolom bisnis secara manual.",
        };
      if (
        entries.length &&
        !confirmed.has(key(s, `field:${field}`)) &&
        (entries[0].confidence < 0.9 ||
          !aliases[field].some(
            (a) => normalizeHeader(a) === normalizeHeader(entries[0].source),
          ))
      )
        return clarify(fieldIssue(s, field));
    }
    const required: Field[] =
      s.sheetType === "transactions"
        ? [
            "date",
            ...(!mapped(s, "revenue").length &&
            mapped(s, "quantity").length &&
            mapped(s, "unit_price").length
              ? []
              : ["revenue" as const]),
          ]
        : s.sheetType === "expenses"
          ? ["date", "category", "amount"]
          : ["product_name"];
    for (const field of required)
      if (!mapped(s, field).length)
        return clarify(fieldIssue(s, field, false, confirmed));
    for (const field of ["revenue", "cogs", "channel"] as const) {
      const source = mapped(s, field)[0]?.source;
      if (!source || confirmed.has(key(s, `meaning:${field}:${source}`)))
        continue;
      const header = normalizeHeader(source);
      const values = s.rows
        .slice(0, 100)
        .map((r) => r[source])
        .filter((v) => v !== "" && v != null);
      const uncertain =
        field === "revenue"
          ? header === "total" ||
            payoutName.test(header) ||
            !aliases.revenue.some((a) => normalizeHeader(a) === header)
          : field === "cogs"
            ? header !== "cogs"
            : (["source", "platform"].includes(header) &&
                !values.every((v) =>
                  /^(?:shopee|tokopedia|tiktok(?: shop)?|lazada|blibli|bukalapak|whatsapp|toko|offline|online)$/i.test(
                    String(v).trim(),
                  ),
                )) ||
              values.some(
                (v) =>
                  typeof v !== "string" ||
                  paymentValue.test(String(v).trim()) ||
                  /^\+?[\d\s()-]{8,}$/.test(String(v).trim()),
              );
      if (uncertain) return clarify(meaningIssue(s, field, source));
    }
    // A date alone does not prove this is a sales sheet (e.g. marketplace payouts).
    if (
      s.sheetType === "transactions" &&
      (payoutName.test(normalizeHeader(document.name)) ||
        (!salesName.test(normalizeHeader(s.name)) &&
          payoutName.test(normalizeHeader(s.name)))) &&
      !confirmed.has(key(s, "role"))
    )
      return clarify({
        id: key(s, "role"),
        kind: "meaning",
        sheetId: s.id,
        question: `Apakah sheet “${s.name}” berisi penjualan, bukan biaya atau pencairan dana?`,
        options: [
          {
            value: "confirm",
            label: "Ya, ini penjualan sebelum pencairan dana",
          },
          { value: "ignore", label: "Bukan, abaikan sheet ini" },
        ],
      });
    for (const column of s.mapping.filter(
      (m) => !m.target && !isPii(m.source),
    )) {
      const id = key(s, `omit:${column.source}`);
      if (confirmed.has(id) || !moneyName.test(normalizeHeader(column.source)))
        continue;
      if (
        !s.rows.some((r) => r[column.source] !== "" && r[column.source] != null)
      )
        continue;
      return clarify({
        id,
        kind: "omit",
        sheetId: s.id,
        source: column.source,
        question: `Bolehkah kolom “${column.source}” tidak digunakan?`,
        detail:
          "Kolom ini mungkin berisi angka yang memengaruhi analisis. Jika diperlukan, pilih Atur kolom secara manual.",
        options: [
          {
            value: "ignore",
            label: "Ya, kolom ini tidak diperlukan untuk analisis",
          },
        ],
      });
    }
  }
  try {
    const data = prepareImportedData(document);
    const byId = new Map(
      data.products.filter((p) => p.id).map((p) => [p.id!, p]),
    );
    const byName = new Map(
      data.products.map((p) => [normalizeName(p.name), p]),
    );
    const conflictingCost = data.transactions.some((t) => {
      const product =
        (t.productId ? byId.get(t.productId) : undefined) ??
        byName.get(normalizeName(t.productName));
      return (
        t.cogs !== undefined &&
        product?.cogs !== undefined &&
        t.cogs !== product.cogs
      );
    });
    if (conflictingCost)
      return {
        kind: "invalid",
        message:
          "Biaya produk pada transaksi berbeda dari daftar produk. Periksa kolom biaya secara manual. Daftar produk akan menjadi acuan bila Anda mengonfirmasi pilihan tersebut.",
      };
    return { kind: "ready", data };
  } catch (error) {
    return { kind: "invalid", message: friendlyImportError(error) };
  }
}
export function resolveImportIssue(
  document: ImportDocument,
  issue: ImportIssue,
  value: string,
  confirmations: ImportConfirmations,
) {
  if (!issue.options.some((o) => o.value === value))
    throw new Error("Pilih salah satu pilihan yang tersedia.");
  const confirmed = new Set(confirmations).add(issue.id);
  const sheets = document.sheets.map((s): ImportSheet => {
    if (issue.kind === "sales-sheets") {
      if (
        s.sheetType !== "transactions" ||
        value === "combine" ||
        s.id === value
      )
        return s;
      confirmed.add(key(s, "sheet"));
      return { ...s, sheetType: "unknown" };
    }
    if (s.id !== issue.sheetId) return s;
    if (issue.kind === "sheet") {
      const sheetType = value as SheetType;
      return {
        ...s,
        sheetType,
        mapping: s.columns.map((source) => ({
          source,
          target: isPii(source)
            ? ""
            : (allowedFields[sheetType].find((f) =>
                aliases[f].some(
                  (a) => normalizeHeader(a) === normalizeHeader(source),
                ),
              ) ?? ""),
          confidence: 1,
        })),
      };
    }
    if (issue.kind === "field")
      return {
        ...s,
        mapping: s.mapping.map((m) => {
          if (m.target === issue.field && m.source !== value)
            confirmed.add(key(s, `omit:${m.source}`));
          return {
            ...m,
            target:
              m.source === value
                ? issue.field!
                : m.target === issue.field
                  ? ""
                  : m.target,
            confidence: m.source === value ? 1 : m.confidence,
          };
        }),
      };
    if (issue.kind === "meaning" && value === "ignore") {
      confirmed.delete(issue.id);
      if (!issue.source) {
        confirmed.add(key(s, "sheet"));
        return { ...s, sheetType: "unknown" };
      }
      confirmed.add(key(s, `omit:${issue.source}`));
      confirmed.add(key(s, `reject:${issue.field}:${issue.source}`));
      return {
        ...s,
        mapping: s.mapping.map((m) =>
          m.source === issue.source ? { ...m, target: "" } : m,
        ),
      };
    }
    return s;
  });
  return { document: { ...document, sheets }, confirmed };
}
