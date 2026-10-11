import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { analyzeBusiness } from "@/lib/analytics";
import { answerQuestion, buildVerifiedContext } from "@/lib/insights";
import {
  applySuggestions,
  inferSheet,
  inspectFile,
  normalizeImport,
  schemaMetadata,
  type ImportDocument,
} from "@/lib/mapping";
const document = (
  row: Record<string, unknown>,
  name = "Penjualan April",
): ImportDocument => ({ name: "data.xlsx", sheets: [inferSheet(name, [row])] });
describe("flexible import", () => {
  it.each([
    {
      Tanggal: "2026-09-20",
      Invoice: "A",
      Barang: "Roti",
      Qty: 2,
      Harga: 100,
      Diskon: 10,
    },
    {
      "Transaction Date": "2026-09-20",
      "Order Number": "A",
      Item: "Roti",
      Units: 2,
      Price: 100,
      Revenue: 190,
    },
    {
      TANGGAL: "2026-09-20",
      "No. Invoice": "A",
      "NAMA BARANG": "Roti",
      "Qty!": 2,
      "Harga Satuan": 100,
      Potongan: 10,
    },
  ])("recognizes multilingual aliases and punctuation %j", (row) => {
    const m = analyzeBusiness(normalizeImport(document(row)))!;
    expect(m.revenue).toBe(190);
    expect(m.orders).toBe(1);
    expect(m.products[0].name).toBe("Roti");
    expect(m.grossProfit).toBeNull();
  });
  it("accepts revenue-only data and does not invent orders, units, products or costs", () => {
    const data = normalizeImport(
      document({ Tanggal: "2026-09-20", "Total Penjualan": 600 }),
    );
    const m = analyzeBusiness(data)!;
    expect(m.revenue).toBe(600);
    expect(m.capabilities).toEqual({
      orders: false,
      units: false,
      products: false,
      expenses: false,
    });
    expect(m.products).toEqual([]);
    expect(m.cogs).toBeNull();
    expect(buildVerifiedContext(m).overview).toMatchObject({
      orders: null,
      aov: null,
      units: null,
    });
    expect(answerQuestion("Berapa pendapatan?", m)).not.toContain("0 pesanan");
    expect(answerQuestion("Produk apa paling laris?", m)).toContain(
      "belum tersedia",
    );
  });
  it("calculates quantity × price without order or product fields", () => {
    const m = analyzeBusiness(
      normalizeImport(document({ tgl: "2026-09-20", jumlah: 3, harga: 40 })),
    )!;
    expect(m.revenue).toBe(120);
    expect(m.units).toBe(3);
    expect(m.capabilities.orders).toBe(false);
  });
  it("accepts products with explicit revenue and missing quantity without inventing cost", () => {
    const m = analyzeBusiness(
      normalizeImport(
        document({
          Tanggal: "2026-09-20",
          Produk: "Roti",
          omzet: 100,
          hpp: 20,
        }),
      ),
    )!;
    expect(m.products[0].revenue).toBe(100);
    expect(m.capabilities.units).toBe(false);
    expect(m.cogs).toBeNull();
  });
  it("calculates inline costs without a product name", () => {
    const m = analyzeBusiness(
      normalizeImport(
        document({ tanggal: "2026-09-20", qty: 2, harga: 100, hpp: 30 }),
      ),
    )!;
    expect(m.grossProfit).toBe(140);
    expect(m.products).toEqual([]);
  });
  it("requires manual review for unknown and duplicate mappings", () => {
    const d = document({ Kapan: "2026-09-20", Nilai: 125 });
    expect(() => normalizeImport(d)).toThrow();
    d.sheets[0].sheetType = "transactions";
    d.sheets[0].mapping = [
      { source: "Kapan", target: "date", confidence: 1 },
      { source: "Nilai", target: "revenue", confidence: 1 },
    ];
    expect(analyzeBusiness(normalizeImport(d))!.revenue).toBe(125);
    const duplicates = document({
      date: "2026-09-20",
      revenue: 100,
      total: 200,
    });
    expect(
      duplicates.sheets[0].mapping.find((m) => m.source === "total")!
        .confidence,
    ).toBe(0.5);
    expect(() => normalizeImport(duplicates)).toThrow("hanya boleh");
  });
  it("keeps all cell values and suspected PII out of AI requests", () => {
    const d = document({
      Tanggal: "2026-09-20",
      Total: 12345,
      Barang: "Secret Product",
      email: "private@example.org",
      "Nama Pelanggan": "Sari",
      NIK: "12345",
      "Bank Account": "12345",
      Phone: "0812345",
      Address: "Rumah",
    });
    const payload = JSON.stringify(schemaMetadata(d));
    for (const value of [
      "2026-09-20",
      "12345",
      "Secret Product",
      "private@example.org",
      "Sari",
      "Nama Pelanggan",
      "Bank Account",
      "email",
      "Phone",
      "Address",
      "NIK",
    ])
      expect(payload).not.toContain(value);
    expect(payload).toContain("inferredType");
  });
  it("rejects invalid AI targets, confidence, unknown sheets, sources, duplicate targets and PII", () => {
    const d = document({
      date: "2026-09-20",
      total: 100,
      email: "private@example.org",
    });
    const suggestion = (mapping: unknown, id = "0") => ({
      sheets: [{ id, sheetType: "transactions", mapping }],
    });
    expect(() =>
      applySuggestions(
        d,
        suggestion([{ source: "total", target: "revenue", confidence: 0.8 }]),
      ),
    ).not.toThrow();
    for (const entry of [
      { source: "total", target: "invented", confidence: 1 },
      { source: "total", target: "revenue", confidence: 2 },
      { source: "absent", target: "revenue", confidence: 1 },
      { source: "email", target: "product_name", confidence: 1 },
    ])
      expect(() => applySuggestions(d, suggestion([entry]))).toThrow();
    expect(() => applySuggestions(d, suggestion([], "unknown"))).toThrow();
    expect(() =>
      applySuggestions(
        d,
        suggestion([
          { source: "date", target: "revenue", confidence: 1 },
          { source: "total", target: "revenue", confidence: 1 },
        ]),
      ),
    ).toThrow();
  });
  it("reads arbitrary XLSX sheet names, ignores irrelevant sheets, and requires expense confirmation", async () => {
    const book = XLSX.utils.book_new();
    for (const [name, rows] of Object.entries({
      "Data Penjualan": [
        { Tanggal: "2026-09-20", Produk: "Roti", Qty: 2, Harga: 100 },
      ],
      "Master Produk": [{ Produk: "Roti", HPP: 30 }],
      Biaya: [{ Tanggal: "2026-09-20", Kategori: "Sewa", Nominal: 20 }],
      Catatan: [{ pesan: "hello" }],
    }))
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), name);
    const d = await inspectFile(
      new File(
        [XLSX.write(book, { type: "array", bookType: "xlsx" })],
        "bisnis.xlsx",
      ),
    );
    const data = normalizeImport(d, true);
    expect(data.expenses[0].amount).toBe(20);
    expect(analyzeBusiness(data)!.grossProfit).toBe(140);
    expect(data.expenseCoverage).toEqual({
      start: "2026-09-20",
      end: "2026-09-20",
    });
    expect(normalizeImport(d).expenseCoverage).toBeUndefined();
  });
  it("enforces upload size/type and valid financial rows", async () => {
    await expect(inspectFile(new File([], "data.csv"))).rejects.toThrow(
      "kosong",
    );
    await expect(inspectFile(new File(["abc"], "data.txt"))).rejects.toThrow(
      "Jenis file",
    );
    await expect(inspectFile(new File(["abc"], "data.xlsx"))).rejects.toThrow(
      "XLSX",
    );
    expect(() =>
      normalizeImport(document({ tanggal: "2026-02-30", total: 100 })),
    ).toThrow();
    expect(() =>
      normalizeImport(document({ tanggal: "2026-09-20", total: -100 })),
    ).toThrow();
  });
});
