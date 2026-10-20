import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { analyzeBusiness } from "@/lib/analytics";
import {
  inferSheet,
  inspectFile,
  schemaMetadata,
  type ImportDocument,
} from "@/lib/mapping";
import {
  assessAutomaticImport,
  prepareImportedData,
  resolveImportIssue,
} from "@/lib/mapping/automatic";
import { getImportedPrivateNames } from "@/lib/chat/import-privacy";
const doc = (
  rows: Record<string, unknown>[],
  name = "Penjualan",
): ImportDocument => ({ name: "bisnis.csv", sheets: [inferSheet(name, rows)] });
const ready = (d: ImportDocument) => {
  const result = assessAutomaticImport(d);
  expect(result.kind).toBe("ready");
  if (result.kind !== "ready") throw new Error(JSON.stringify(result));
  return result.data;
};
describe("conservative automatic import", () => {
  it("automatically accepts a real CSV with clear aliases and full validation", async () => {
    const d = await inspectFile(
      new File(
        [
          "Tanggal,Total Penjualan,No Invoice,Produk,Qty,Harga,Channel\n2026-09-20,200,A,Roti,2,100,Toko",
        ],
        "jualan.csv",
      ),
    );
    const m = analyzeBusiness(ready(d))!;
    expect(m.revenue).toBe(200);
    expect(m.orders).toBe(1);
    expect(m.channels[0].name).toBe("Toko");
  });
  it("automatically accepts an unambiguous Excel workbook with products and expenses", async () => {
    const book = XLSX.utils.book_new();
    for (const [name, rows] of Object.entries({
      Transactions: [
        {
          date: "2026-09-20",
          product_name: "Roti",
          quantity: 2,
          unit_price: 100,
        },
      ],
      Products: [{ product_name: "Roti", cogs: 30 }],
      Expenses: [{ date: "2026-09-20", category: "Sewa", amount: 20 }],
    }))
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), name);
    const d = await inspectFile(
      new File(
        [XLSX.write(book, { type: "array", bookType: "xlsx" })],
        "jualan.xlsx",
      ),
    );
    const data = ready(d);
    expect(analyzeBusiness(data)!.grossProfit).toBe(140);
    expect(data.expenses[0].amount).toBe(20);
    expect(data.expenseCoverage).toBeUndefined();
    expect(analyzeBusiness(data)!.capabilities.expenses).toBe(false);
    expect(prepareImportedData(d, true).expenseCoverage).toEqual({
      start: "2026-09-20",
      end: "2026-09-20",
    });
  });
  it("preserves limited analytics and real zeros for revenue-only data", () => {
    const m = analyzeBusiness(
      ready(doc([{ Tanggal: "2026-09-20", Omzet: 0 }])),
    )!;
    expect(m.revenue).toBe(0);
    expect(m.grossProfit).toBeNull();
    expect(m.capabilities.orders).toBe(false);
    expect(m.products).toEqual([]);
  });
  it("uses the existing quantity × price minus discount calculation", () => {
    expect(
      analyzeBusiness(
        ready(doc([{ tgl: "2026-09-20", qty: 3, harga: 100, diskon: 10 }])),
      )!.revenue,
    ).toBe(290);
  });
  it("asks for one choice when critical aliases conflict", () => {
    const d = doc([{ date: "2026-09-20", revenue: 100, sales: 200 }]);
    const r = assessAutomaticImport(d);
    expect(r.kind).toBe("clarify");
    if (r.kind !== "clarify") throw new Error();
    expect(r.issue.field).toBe("revenue");
    const chosen = resolveImportIssue(d, r.issue, "revenue", new Set());
    const resolved = assessAutomaticImport(chosen.document, chosen.confirmed);
    expect(resolved.kind).toBe("ready");
    if (resolved.kind === "ready")
      expect(resolved.data.transactions[0].revenue).toBe(100);
    expect(
      d.sheets[0].mapping.filter((m) => m.target === "revenue"),
    ).toHaveLength(2);
  });
  it("does not trust exact alias confidence for a generic total", () => {
    const d = doc([{ date: "2026-09-20", Total: 100 }]);
    expect(
      d.sheets[0].mapping.find((m) => m.target === "revenue")!.confidence,
    ).toBe(1);
    const r = assessAutomaticImport(d);
    expect(r.kind).toBe("clarify");
    if (r.kind === "clarify") {
      expect(r.issue.kind).toBe("meaning");
      expect(r.issue.detail).toContain("pencairan");
    }
  });
  it.each(["payout.csv", "settlements.xlsx"])(
    "does not automatically read a payout file as sales: %s",
    (name) => {
      const d = { ...doc([{ date: "2026-09-20", revenue: 100 }]), name };
      const r = assessAutomaticImport(d);
      expect(r.kind).toBe("clarify");
      if (r.kind === "clarify") expect(r.issue.question).toContain("pencairan");
    },
  );
  it("does not silently discard a second financial amount", () => {
    const r = assessAutomaticImport(
      doc([{ date: "2026-09-20", revenue: 100, Payout: 80 }]),
    );
    expect(r.kind).toBe("clarify");
    if (r.kind === "clarify") expect(r.issue.source).toBe("Payout");
  });
  it("asks specifically for a missing date, retaining the original document", () => {
    const d = doc([{ Kapan: "2026-09-20", revenue: 100 }]);
    const r = assessAutomaticImport(d);
    if (r.kind !== "clarify") throw new Error();
    expect(r.issue.field).toBe("date");
    const fixed = resolveImportIssue(d, r.issue, "Kapan", new Set());
    expect(assessAutomaticImport(fixed.document, fixed.confirmed).kind).toBe(
      "ready",
    );
    expect(d.sheets[0].rows[0].Kapan).toBe("2026-09-20");
  });
  it("requires an explicit decision for every nonempty unknown sheet", () => {
    const d = doc([{ date: "2026-09-20", revenue: 100 }]);
    d.sheets.push(inferSheet("Arsip", [{ Nilai: 500 }], "1"));
    const r = assessAutomaticImport(d);
    if (r.kind !== "clarify") throw new Error();
    expect(r.issue.kind).toBe("sheet");
    const fixed = resolveImportIssue(d, r.issue, "unknown", new Set());
    expect(assessAutomaticImport(fixed.document, fixed.confirmed).kind).toBe(
      "ready",
    );
  });
  it("never automatically combines summary and transaction sheets", () => {
    const d = doc([{ date: "2026-09-20", revenue: 100 }]);
    d.sheets.push(
      inferSheet("Rekap", [{ date: "2026-09-20", revenue: 100 }], "1"),
    );
    const r = assessAutomaticImport(d);
    if (r.kind !== "clarify") throw new Error();
    expect(r.issue.kind).toBe("sales-sheets");
    const fixed = resolveImportIssue(d, r.issue, "0", new Set());
    const accepted = assessAutomaticImport(fixed.document, fixed.confirmed);
    expect(accepted.kind).toBe("ready");
    if (accepted.kind === "ready")
      expect(analyzeBusiness(accepted.data)!.revenue).toBe(100);
  });
  it("requires explicit permission to combine distinct transaction sheets", () => {
    const d = doc([{ date: "2026-09-20", revenue: 100 }]);
    d.sheets.push(
      inferSheet("Transaksi lain", [{ date: "2026-09-20", revenue: 200 }], "1"),
    );
    const r = assessAutomaticImport(d);
    if (r.kind !== "clarify") throw new Error();
    const fixed = resolveImportIssue(d, r.issue, "combine", new Set());
    const accepted = assessAutomaticImport(fixed.document, fixed.confirmed);
    if (accepted.kind !== "ready") throw new Error();
    expect(analyzeBusiness(accepted.data)!.revenue).toBe(300);
  });
  it("rejects subtotal rows even during manual confirmation", () => {
    const d = doc([
      { date: "2026-09-20", product_name: "Roti", revenue: 100 },
      { date: "2026-09-20", product_name: "TOTAL", revenue: 100 },
    ]);
    expect(assessAutomaticImport(d).kind).toBe("invalid");
    expect(() => prepareImportedData(d)).toThrow("dua kali");
  });
  it.each([
    { date: "2026-02-30", revenue: 100 },
    { date: "2026-09-20", revenue: "Rp100" },
    { date: "2026-09-20", quantity: 0, unit_price: 100 },
  ])("validates every normalized row %j", (row) => {
    expect(assessAutomaticImport(doc([row])).kind).toBe("invalid");
  });
  it("does not mistake a payment method for a sales channel", () => {
    const d = doc([{ date: "2026-09-20", revenue: 100, channel: "QRIS" }]);
    const r = assessAutomaticImport(d);
    if (r.kind !== "clarify") throw new Error();
    expect(r.issue.field).toBe("channel");
    const fixed = resolveImportIssue(d, r.issue, "ignore", new Set());
    const accepted = assessAutomaticImport(fixed.document, fixed.confirmed);
    if (accepted.kind !== "ready") throw new Error();
    expect(accepted.data.transactions[0].channel).toBeUndefined();
  });
  it("confirms per-unit meaning for a generic product cost", () => {
    const r = assessAutomaticImport(
      doc([{ date: "2026-09-20", quantity: 2, unit_price: 100, HPP: 30 }]),
    );
    if (r.kind !== "clarify") throw new Error();
    expect(r.issue.field).toBe("cogs");
  });
  it("registers imported personal names in automatic and manual paths without transmitting them", () => {
    const d = doc([
      {
        date: "2026-09-20",
        revenue: 100,
        nama_pelanggan: "Siti Nurhaliza",
        email: "secret@example.com",
        phone: "081234567890",
      },
    ]);
    const auto = ready(d),
      manual = prepareImportedData(d);
    for (const data of [auto, manual]) {
      expect(getImportedPrivateNames(data)).toContain("Siti Nurhaliza");
      expect(JSON.stringify(data)).not.toContain("secret@example.com");
      expect(JSON.stringify(data)).not.toContain("Siti Nurhaliza");
    }
    const payload = JSON.stringify(schemaMetadata(d));
    expect(payload).not.toMatch(
      /secret|081234|Siti|nama_pelanggan|email|phone/,
    );
  });
  it("allows manually resolved unusual columns through existing normalization", () => {
    const d = doc([{ Kapan: "2026-09-20", Angka: 100 }]);
    d.sheets[0].mapping = [
      { source: "Kapan", target: "date", confidence: 1 },
      { source: "Angka", target: "revenue", confidence: 1 },
    ];
    expect(analyzeBusiness(prepareImportedData(d))!.revenue).toBe(100);
    expect(assessAutomaticImport(d).kind).toBe("clarify");
  });
  it("does not offer a rejected payout column as sales again", () => {
    const d = doc([{ date: "2026-09-20", Total: 100 }]);
    const r = assessAutomaticImport(d);
    if (r.kind !== "clarify") throw new Error();
    const rejected = resolveImportIssue(d, r.issue, "ignore", new Set());
    const next = assessAutomaticImport(rejected.document, rejected.confirmed);
    if (next.kind !== "clarify") throw new Error();
    expect(next.issue.options.map((o) => o.value)).not.toContain("Total");
  });
  it("does not automatically resolve conflicting inline and master costs", () => {
    const d = doc([
      {
        date: "2026-09-20",
        product_name: "Roti",
        quantity: 2,
        unit_price: 100,
        cogs: 30,
      },
    ]);
    d.sheets.push(
      inferSheet("Products", [{ product_name: "Roti", cogs: 50 }], "1"),
    );
    const r = assessAutomaticImport(d);
    expect(r.kind).toBe("invalid");
    if (r.kind === "invalid")
      expect(r.message).toContain("berbeda dari daftar produk");
    expect(analyzeBusiness(prepareImportedData(d))!.grossProfit).toBe(100);
  });
  it("validates rows beyond the content sample", () => {
    const rows = Array.from({ length: 101 }, () => ({
      date: "2026-09-20",
      revenue: "100",
    }));
    rows[100].revenue = "bukan angka";
    expect(assessAutomaticImport(doc(rows)).kind).toBe("invalid");
  });
  it("does not automatically trust provider confidence on unfamiliar financial headings", () => {
    const d = doc([{ date: "2026-09-20", Rezeki: 100 }]);
    d.sheets[0].mapping.find((m) => m.source === "Rezeki")!.target = "revenue";
    d.sheets[0].mapping.find((m) => m.source === "Rezeki")!.confidence = 1;
    expect(assessAutomaticImport(d).kind).toBe("clarify");
  });
  it("does not silently treat transaction-like product sheets as a master list", () => {
    const d = doc([{ date: "2026-09-20", revenue: 100 }]);
    d.sheets.push(
      inferSheet(
        "Products",
        [
          {
            date: "2026-09-20",
            product_name: "Roti",
            quantity: 2,
            unit_price: 100,
          },
        ],
        "1",
      ),
    );
    const r = assessAutomaticImport(d);
    expect(r.kind).toBe("clarify");
    if (r.kind === "clarify") expect(r.issue.sheetId).toBe("1");
  });
  it("automatically recognizes known marketplace values under platform aliases", () => {
    expect(
      assessAutomaticImport(
        doc([{ date: "2026-09-20", revenue: 100, Platform: "Shopee" }]),
      ).kind,
    ).toBe("ready");
  });
  it("does not treat an expense or returns report filename as proof of sales", () => {
    const d = {
      ...doc([{ date: "2026-09-20", revenue: 100 }]),
      name: "pengeluaran.csv",
    };
    expect(assessAutomaticImport(d).kind).toBe("clarify");
  });
});
