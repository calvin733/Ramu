import Papa from "papaparse";
import * as XLSX from "xlsx";
import { z } from "zod";
import {
  DataValidationError,
  MAX_FILE_SIZE,
  MAX_ROWS,
  parseExpenses,
  parseProducts,
  parseTransactions,
} from "@/lib/parsers";
import type { UploadedData } from "@/lib/types";
import { normalizeName } from "@/lib/utils";

export const fields = {
  date: "Tanggal Transaksi",
  order_id: "Nomor Pesanan",
  product_name: "Nama Produk",
  product_id: "Kode Produk",
  quantity: "Jumlah",
  unit_price: "Harga Satuan",
  revenue: "Pendapatan",
  discount: "Diskon",
  channel: "Kanal Penjualan",
  cogs: "Biaya Produk per Unit",
  category: "Kategori",
  amount: "Biaya Operasional",
  selling_price: "Harga Jual",
  description: "Keterangan",
} as const;
export type Field = keyof typeof fields;
export type SheetType = "transactions" | "products" | "expenses" | "unknown";
export const normalizeHeader = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]/g, "");
export const aliases: Record<Field, string[]> = {
  date: [
    "date",
    "tanggal",
    "tgl",
    "transaction_date",
    "tanggal_transaksi",
    "order_date",
    "created_at",
  ],
  order_id: [
    "order_id",
    "invoice",
    "invoice_id",
    "invoice_number",
    "no_invoice",
    "order",
    "order_number",
    "transaction_id",
    "id_transaksi",
    "nomor_transaksi",
  ],
  product_name: [
    "product_name",
    "product",
    "produk",
    "nama_produk",
    "barang",
    "nama_barang",
    "item",
    "item_name",
  ],
  quantity: ["quantity", "qty", "jumlah", "unit", "units", "jumlah_barang"],
  unit_price: [
    "unit_price",
    "price",
    "harga",
    "harga_satuan",
    "selling_price",
    "harga_jual",
  ],
  discount: ["discount", "diskon", "potongan", "discount_amount"],
  revenue: [
    "revenue",
    "sales",
    "sales_amount",
    "omzet",
    "pendapatan",
    "total",
    "total_sales",
    "total_penjualan",
  ],
  channel: [
    "channel",
    "kanal",
    "platform",
    "sales_channel",
    "marketplace",
    "source",
  ],
  cogs: ["cogs", "hpp", "cost", "cost_price", "harga_pokok", "biaya_produk"],
  category: [
    "category",
    "kategori",
    "product_category",
    "expense_category",
    "kategori_biaya",
    "jenis_pengeluaran",
  ],
  amount: [
    "amount",
    "expense",
    "expense_amount",
    "biaya",
    "pengeluaran",
    "nominal",
  ],
  product_id: ["product_id", "id_produk", "kode_produk", "sku"],
  selling_price: ["selling_price", "harga_jual", "harga", "price"],
  description: ["description", "keterangan", "deskripsi"],
};
export const allowedFields: Record<SheetType, Field[]> = {
  transactions: [
    "date",
    "order_id",
    "product_name",
    "product_id",
    "quantity",
    "unit_price",
    "revenue",
    "discount",
    "channel",
    "cogs",
  ],
  products: ["product_name", "product_id", "category", "selling_price", "cogs"],
  expenses: ["date", "category", "amount", "description"],
  unknown: [],
};
export const isPii = (s: string) =>
  /email|e?mailaddress|phone|telephone|telepon|telp|whatsapp|alamat|address|customer|pelanggan|nik|ktp|rekening|bankaccount|cardnumber|kartukredit|contact|kontak|namaorang|namapembeli/.test(
    normalizeHeader(s),
  );
export interface ColumnMapping {
  source: string;
  target: Field | "";
  confidence: number;
}
export interface ImportSheet {
  id: string;
  name: string;
  columns: string[];
  rows: Record<string, unknown>[];
  sheetType: SheetType;
  mapping: ColumnMapping[];
}
export interface ImportDocument {
  name: string;
  sheets: ImportSheet[];
}

export function inferSheet(
  name: string,
  rows: Record<string, unknown>[],
  id = "0",
): ImportSheet {
  const columns = Object.keys(rows[0] ?? {});
  if (rows.length > MAX_ROWS)
    throw new DataValidationError(
      "Data terlalu besar. Maksimal 50.000 baris per sheet.",
    );
  if (columns.length > 100 || columns.some((c) => c.length > 200))
    throw new DataValidationError(
      "Terlalu banyak kolom atau judul kolom terlalu panjang.",
    );
  const hits = (f: Field) =>
    columns.some((c) =>
      aliases[f].some((a) => normalizeHeader(c) === normalizeHeader(a)),
    );
  const n = normalizeHeader(name);
  let sheetType: SheetType = "unknown";
  if (
    /expenses|biaya|pengeluaran/.test(n) ||
    (hits("amount") && hits("date") && hits("category"))
  )
    sheetType = "expenses";
  else if (/masterproduk|products|^produk$/.test(n)) sheetType = "products";
  else if (
    hits("date") ||
    /transactions|penjualan|sales|transaksi|orders/.test(n)
  )
    sheetType = "transactions";
  else if (hits("product_name") && (hits("cogs") || hits("selling_price")))
    sheetType = "products";
  const mapping: ColumnMapping[] = columns.map((source) => {
    const target = isPii(source)
      ? ""
      : (allowedFields[sheetType].find((f) =>
          aliases[f].some(
            (a) => normalizeHeader(a) === normalizeHeader(source),
          ),
        ) ?? "");
    return { source, target, confidence: target ? 1 : 0 };
  });
  for (const m of mapping)
    if (m.target && mapping.filter((x) => x.target === m.target).length > 1)
      m.confidence = 0.5;
  return { id, name, columns, rows, sheetType, mapping };
}
export async function inspectFile(file: File): Promise<ImportDocument> {
  if (file.size > MAX_FILE_SIZE)
    throw new DataValidationError("Ukuran file melebihi 10 MB.");
  if (!file.size)
    throw new DataValidationError(
      "File kosong. Tambahkan data terlebih dahulu.",
    );
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  if (extension !== "csv" && extension !== "xlsx")
    throw new DataValidationError(
      "Jenis file belum didukung. Gunakan file .csv atau .xlsx.",
    );
  try {
    if (extension === "csv") {
      const parsed = Papa.parse<Record<string, unknown>>(await file.text(), {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(),
      });
      if (parsed.errors.length)
        throw new DataValidationError(
          "CSV tidak dapat dibaca. Periksa jumlah kolom pada setiap baris.",
        );
      if (!parsed.data.length)
        throw new DataValidationError("File belum berisi data.");
      return {
        name: file.name,
        sheets: [inferSheet("Penjualan", parsed.data)],
      };
    }
    const buffer = await file.arrayBuffer();
    const signature = new Uint8Array(buffer.slice(0, 4));
    if (signature[0] !== 0x50 || signature[1] !== 0x4b)
      throw new DataValidationError("File bukan workbook XLSX yang valid.");
    const book = XLSX.read(buffer, {
      type: "array",
      sheetRows: MAX_ROWS + 2,
      cellDates: false,
    });
    if (book.SheetNames.length > 16)
      throw new DataValidationError("Maksimal 16 sheet per workbook.");
    const sheets = book.SheetNames.map((name, i) =>
      inferSheet(
        name,
        XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[name], {
          defval: "",
          raw: true,
        }),
        String(i),
      ),
    );
    return { name: file.name, sheets };
  } catch (e) {
    if (e instanceof DataValidationError) throw e;
    throw new DataValidationError(
      "File tidak dapat dibaca. Periksa apakah file rusak atau dilindungi kata sandi.",
    );
  }
}
export const schemaMetadata = (document: ImportDocument) => ({
  sheets: document.sheets.map((s) => ({
    id: s.id,
    name: isPii(s.name) ? `Sheet ${s.id}` : s.name.slice(0, 200),
    columns: s.columns
      .filter((c) => !isPii(c))
      .map((name) => {
        const values = s.rows
          .slice(0, 5)
          .map((r) => r[name])
          .filter((v) => v !== "" && v != null);
        let inferredType: "date" | "number" | "string" = "string";
        if (
          values.length &&
          values.every(
            (v) =>
              (typeof v === "string" &&
                /^(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}\/\d{4})$/.test(
                  v,
                )) ||
              (typeof v === "number" &&
                aliases.date.some(
                  (a) => normalizeHeader(a) === normalizeHeader(name),
                )),
          )
        )
          inferredType = "date";
        else if (
          values.length &&
          values.every((v) => Number.isFinite(Number(v)))
        )
          inferredType = "number";
        // No cell values are transmitted, even for columns that appear non-sensitive.
        return { name, inferredType };
      }),
  })),
});
export const mappingResponseSchema = z
  .object({
    sheets: z
      .array(
        z
          .object({
            id: z.string().max(20),
            sheetType: z.enum([
              "transactions",
              "products",
              "expenses",
              "unknown",
            ]),
            mapping: z
              .array(
                z
                  .object({
                    source: z.string().max(200),
                    target: z.enum([
                      ...(Object.keys(fields) as [Field, ...Field[]]),
                      "",
                    ]),
                    confidence: z.number().min(0).max(1),
                  })
                  .strict(),
              )
              .max(100),
          })
          .strict(),
      )
      .max(16),
  })
  .strict();
export function applySuggestions(
  document: ImportDocument,
  value: unknown,
): ImportDocument {
  const response = mappingResponseSchema.parse(value);
  if (response.sheets.some((s) => !document.sheets.some((d) => d.id === s.id)))
    throw new Error("Unknown sheet");
  return {
    ...document,
    sheets: document.sheets
      .map((sheet) => {
        const suggestions = response.sheets.filter((s) => s.id === sheet.id);
        if (suggestions.length > 1) throw new Error("Duplicate sheet");
        const suggested = suggestions[0];
        if (!suggested) return sheet;

        const seen = new Set<string>(),
          targets = new Set<string>();
        for (const m of suggested.mapping) {
          if (
            !sheet.columns.includes(m.source) ||
            isPii(m.source) ||
            seen.has(m.source) ||
            (m.target &&
              (!allowedFields[suggested.sheetType].includes(m.target) ||
                targets.has(m.target)))
          )
            throw new Error("Invalid mapping");
          seen.add(m.source);
          if (m.target) targets.add(m.target);
        }
        return {
          ...sheet,
          sheetType: suggested.sheetType,
          mapping: sheet.columns.map(
            (source): ColumnMapping =>
              suggested.mapping.find((m) => m.source === source) ?? {
                source,
                target: "",
                confidence: 0,
              },
          ),
        };
      })
      .map((s) => s),
  };
}
export function normalizeImport(
  document: ImportDocument,
  expensesComplete = false,
): UploadedData {
  const transactions: Record<string, unknown>[] = [],
    productRows: Record<string, unknown>[] = [],
    expenseRows: Record<string, unknown>[] = [];
  for (const sheet of document.sheets) {
    if (sheet.sheetType === "unknown" || !sheet.rows.length) continue;
    const targets = sheet.mapping.filter((m) => m.target).map((m) => m.target);
    if (new Set(targets).size !== targets.length)
      throw new DataValidationError(
        `Sheet ${sheet.name}: satu kolom tujuan hanya boleh dipilih sekali.`,
      );
    if (sheet.mapping.some((m) => m.target && isPii(m.source)))
      throw new DataValidationError(
        "Kolom data pribadi tidak digunakan untuk analisis.",
      );
    if (
      targets.some((t) => !allowedFields[sheet.sheetType].includes(t as Field))
    )
      throw new DataValidationError("Pilihan kolom belum sesuai jenis data.");
    const rows = sheet.rows.map((r) =>
      Object.fromEntries(
        sheet.mapping
          .filter((m) => m.target)
          .map((m) => [m.target, r[m.source]]),
      ),
    );
    (sheet.sheetType === "transactions"
      ? transactions
      : sheet.sheetType === "products"
        ? productRows
        : expenseRows
    ).push(...rows);
  }
  if (!transactions.length)
    throw new DataValidationError(
      "Beberapa informasi penting belum ditemukan. Pilih sheet penjualan dan kolom tanggal serta pendapatan, atau jumlah dan harga.",
    );
  const parsed = parseTransactions(transactions, true),
    products = parseProducts(productRows);
  const supplemental = parsed.inlineProducts.filter(
    (p) =>
      !products.some(
        (q) =>
          (p.id && q.id === p.id) ||
          normalizeName(p.name) === normalizeName(q.name),
      ),
  );
  const expenses = parseExpenses(expenseRows);
  const dates = [
    ...parsed.transactions.map((t) => t.date),
    ...expenses.map((e) => e.date),
  ].sort();
  const hasExpenses = document.sheets.some((s) => s.sheetType === "expenses");
  return {
    transactions: parsed.transactions,
    products: [...products, ...supplemental],
    expenses,
    expenseCoverage:
      expensesComplete && hasExpenses
        ? { start: dates[0], end: dates.at(-1)! }
        : undefined,
    source: {
      name: document.name,
      kind: "upload",
      loadedAt: new Date().toISOString(),
    },
  };
}
