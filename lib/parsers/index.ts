import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Expense, Product, Transaction, UploadedData } from "@/lib/types";
import { normalizeName } from "@/lib/utils";

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_ROWS = 50000;
export const REQUIRED_COLUMNS = [
  "date",
  "order_id",
  "product_name",
  "quantity",
  "unit_price",
];
type Row = Record<string, unknown>;
export class DataValidationError extends Error {}
const fail = (message: string): never => {
  throw new DataValidationError(message);
};
const empty = (value: unknown) =>
  value === undefined ||
  value === null ||
  (typeof value === "string" && value.trim() === "");
function text(
  value: unknown,
  field: string,
  row: number,
  required = true,
): string | undefined {
  if (empty(value))
    return required
      ? fail(`Baris ${row}: kolom ${field} belum diisi.`)
      : undefined;
  if (typeof value !== "string" && typeof value !== "number")
    fail(`Baris ${row}: kolom ${field} tidak valid.`);
  const result = String(value).trim();
  if (!result && required) fail(`Baris ${row}: kolom ${field} belum diisi.`);
  if (result.length > 200)
    fail(
      `Baris ${row}: kolom ${field} terlalu panjang (maksimal 200 karakter).`,
    );
  return result || undefined;
}
function number(
  value: unknown,
  field: string,
  row: number,
  optional = false,
): number | undefined {
  if (empty(value))
    return optional
      ? undefined
      : fail(`Baris ${row}: kolom ${field} belum diisi.`);
  if (typeof value !== "number" && typeof value !== "string")
    fail(`Baris ${row}: ${field} harus berupa angka.`);
  const result =
    typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(result) || result < 0 || result > 1e12)
    fail(
      `Baris ${row}: ${field} harus berupa angka positif atau nol, tanpa Rp atau pemisah ribuan.`,
    );
  return result;
}
export function parseDate(value: unknown, row = 2): string {
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed || parsed.y < 1900 || parsed.y > 2100)
      fail(`Baris ${row}: tanggal Excel tidak valid.`);
    value = `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  if (value instanceof Date && Number.isFinite(value.getTime()))
    value = value.toISOString().slice(0, 10);
  if (typeof value !== "string")
    return fail(
      `Baris ${row}: date harus berupa tanggal YYYY-MM-DD atau DD/MM/YYYY.`,
    );
  const date = value.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(date);
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(date);
  if (!iso && !local)
    return fail(`Baris ${row}: gunakan tanggal YYYY-MM-DD atau DD/MM/YYYY.`);
  const year = Number(iso ? iso[1] : local![3]),
    month = Number(iso ? iso[2] : local![2]),
    day = Number(iso ? iso[3] : local![1]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1900 ||
    year > 2100 ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  )
    fail(`Baris ${row}: tanggal tidak valid.`);
  return parsed.toISOString().slice(0, 10);
}
function normalizeRows(rows: Row[]): Row[] {
  if (rows.length > MAX_ROWS)
    fail(
      `Data terlalu besar. Maksimal ${MAX_ROWS.toLocaleString("id-ID")} baris per sheet.`,
    );
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key
          .replace(/^\uFEFF/, "")
          .trim()
          .toLowerCase(),
        value,
      ]),
    ),
  );
}
function requireColumns(rows: Row[], fields: string[], sheet: string) {
  if (!rows.length) fail(`Sheet ${sheet} belum berisi data.`);
  const keys = Object.keys(rows[0]);
  const missing = fields.filter((field) => !keys.includes(field));
  if (missing.length)
    fail(`Kolom yang belum tersedia di ${sheet}: ${missing.join(", ")}.`);
}
export function parseTransactions(input: Row[]): {
  transactions: Transaction[];
  inlineProducts: Product[];
} {
  const rows = normalizeRows(input);
  requireColumns(rows, REQUIRED_COLUMNS, "transactions");
  const inline = new Map<string, Product>();
  const transactions = rows.map((r, i): Transaction => {
    const row = i + 2,
      name = text(r.product_name, "product_name", row)!,
      id = text(r.product_id, "product_id", row, false);
    const quantity = number(r.quantity, "quantity", row)!;
    if (quantity <= 0 || !Number.isInteger(quantity))
      fail(
        `Baris ${row}: quantity harus berupa bilangan bulat lebih dari nol.`,
      );
    const price = number(r.unit_price, "unit_price", row)!,
      discount = number(r.discount, "discount", row, true) ?? 0;
    if (discount > quantity * price)
      fail(`Baris ${row}: discount tidak boleh melebihi nilai penjualan.`);
    const cogs = number(r.cogs, "cogs", row, true);
    if (cogs !== undefined) {
      const key = id ? `id:${id}` : `name:${normalizeName(name)}`;
      if (inline.has(key) && inline.get(key)!.cogs !== cogs)
        fail(`Baris ${row}: COGS produk ${name} tidak konsisten.`);
      inline.set(key, { id, name, cogs, sellingPrice: price });
    }
    return {
      date: parseDate(r.date, row),
      orderId: text(r.order_id, "order_id", row)!,
      productId: id,
      productName: name,
      quantity,
      unitPrice: price,
      discount,
      revenue: number(r.revenue, "revenue", row, true),
      channel: text(r.channel, "channel", row, false),
    };
  });
  return { transactions, inlineProducts: [...inline.values()] };
}
export function parseProducts(input: Row[]): Product[] {
  const rows = normalizeRows(input);
  if (!rows.length) return [];
  requireColumns(rows, ["product_name"], "products");
  const ids = new Set<string>(),
    names = new Set<string>();
  return rows.map((r, i) => {
    const row = i + 2,
      id = text(r.product_id, "product_id", row, false),
      name = text(r.product_name, "product_name", row)!;
    const normalized = normalizeName(name);
    if ((id && ids.has(id)) || names.has(normalized))
      fail(`Baris ${row}: produk ${name} duplikat di sheet products.`);
    if (id) ids.add(id);
    names.add(normalized);
    return {
      id,
      name,
      category: text(r.category, "category", row, false),
      sellingPrice: number(r.selling_price, "selling_price", row, true),
      cogs: number(r.cogs, "cogs", row, true),
    };
  });
}
export function parseExpenses(input: Row[]): Expense[] {
  const rows = normalizeRows(input);
  if (!rows.length) return [];
  requireColumns(rows, ["date", "category", "amount"], "expenses");
  return rows.map((r, i) => ({
    date: parseDate(r.date, i + 2),
    category: text(r.category, "category", i + 2)!,
    description: text(r.description, "description", i + 2, false),
    amount: number(r.amount, "amount", i + 2)!,
  }));
}
export function parseCsv(
  content: string,
  name = "transaksi.csv",
): UploadedData {
  const result = Papa.parse<Row>(content, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) =>
      h
        .replace(/^\uFEFF/, "")
        .trim()
        .toLowerCase(),
  });
  if (result.errors.length)
    fail(
      "CSV tidak dapat dibaca. Pastikan jumlah kolom setiap baris sesuai dengan judul kolom.",
    );
  const { transactions, inlineProducts } = parseTransactions(result.data);
  return {
    transactions,
    products: inlineProducts,
    expenses: [],
    source: { name, kind: "upload", loadedAt: new Date().toISOString() },
  };
}
export function parseWorkbook(
  buffer: ArrayBuffer,
  name = "data-bisnis.xlsx",
): UploadedData {
  const signature = new Uint8Array(buffer.slice(0, 4));
  if (signature[0] !== 0x50 || signature[1] !== 0x4b)
    fail("File bukan workbook XLSX yang valid.");
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: false,
    sheetRows: MAX_ROWS + 2,
  });
  const find = (name: string) =>
    workbook.SheetNames.find((s) => s.trim().toLowerCase() === name);
  const rows = (name: string): Row[] => {
    const key = find(name);
    return key
      ? XLSX.utils.sheet_to_json<Row>(workbook.Sheets[key], {
          defval: "",
          raw: true,
        })
      : [];
  };
  if (!find("transactions"))
    fail("Workbook harus memiliki sheet transactions.");
  const { transactions, inlineProducts } = parseTransactions(
    rows("transactions"),
  );
  const products = parseProducts(rows("products"));
  // Explicit product records take precedence; never inherit another dataset's costs.
  const supplemental = inlineProducts.filter(
    (p) =>
      !products.some(
        (q) =>
          (p.id && q.id === p.id) ||
          normalizeName(p.name) === normalizeName(q.name),
      ),
  );
  return {
    transactions,
    products: [...products, ...supplemental],
    expenses: parseExpenses(rows("expenses")),
    source: { name, kind: "upload", loadedAt: new Date().toISOString() },
  };
}
export async function parseFile(file: File): Promise<UploadedData> {
  if (file.size > MAX_FILE_SIZE)
    fail("Ukuran file melebihi 10 MB. Gunakan file yang lebih kecil.");
  if (file.size === 0)
    fail("File kosong. Tambahkan data transaksi terlebih dahulu.");
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  if (extension !== "csv" && extension !== "xlsx")
    fail("Jenis file belum didukung. Gunakan file .csv atau .xlsx.");
  try {
    return extension === "csv"
      ? parseCsv(await file.text(), file.name)
      : parseWorkbook(await file.arrayBuffer(), file.name);
  } catch (error) {
    if (error instanceof DataValidationError) throw error;
    return fail(
      "Data tidak dapat diproses. Pastikan file tidak rusak atau dilindungi kata sandi.",
    );
  }
}
