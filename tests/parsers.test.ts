import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  parseCsv,
  parseDate,
  parseExpenses,
  parseFile,
  parseProducts,
  parseTransactions,
  parseWorkbook,
} from "@/lib/parsers";
import { calculateTotals } from "@/lib/analytics";

const csv =
  "date,order_id,product_name,quantity,unit_price\n2026-09-30,A,Brownie,2,50000";
const valid = {
  date: "2026-09-30",
  order_id: "A",
  product_name: "Brownie",
  quantity: 2,
  unit_price: 50000,
};
function workbook(
  sheets: Record<string, Record<string, unknown>[]>,
): ArrayBuffer {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets))
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), name);
  return XLSX.write(book, { type: "array", bookType: "xlsx" });
}
describe("CSV and XLSX parsing", () => {
  it("imports minimum CSV columns with optional defaults", () => {
    const data = parseCsv(csv);
    expect(data.transactions).toHaveLength(1);
    expect(data.transactions[0].discount).toBe(0);
    expect(calculateTotals(data.transactions, data.products)).toMatchObject({
      revenue: 100000,
      grossProfit: null,
    });
  });
  it("supports CSV delimiters, BOM, normalized headers, and optional inline COGS", () => {
    const data = parseCsv(
      "\uFEFFDate;Order_ID;Product_Name;Quantity;Unit_Price;cogs\n30/09/2026;A;Brownie;2;50000;20000",
    );
    expect(data.transactions[0].date).toBe("2026-09-30");
    expect(calculateTotals(data.transactions, data.products).grossProfit).toBe(
      60000,
    );
  });
  it("imports case-insensitive workbook sheets, expenses and ignores extra sheets", () => {
    const data = parseWorkbook(
      workbook({
        Transactions: [valid],
        PRODUCTS: [{ product_name: "Brownie", cogs: 20000 }],
        expenses: [{ date: "2026-09-30", category: "Sewa", amount: 10000 }],
        notes: [{ text: "ignored" }],
      }),
    );
    expect(calculateTotals(data.transactions, data.products).grossProfit).toBe(
      60000,
    );
    expect(data.expenses).toHaveLength(1);
  });
  it("allows transactions-only XLSX and blank optional sheets", () => {
    expect(
      parseWorkbook(
        workbook({ transactions: [valid], products: [], expenses: [] }),
      ).products,
    ).toEqual([]);
  });
  it("preserves explicit zero revenue", () =>
    expect(
      parseTransactions([{ ...valid, revenue: 0 }]).transactions[0].revenue,
    ).toBe(0));
  it("accepts Excel serial dates and Indonesian dates", () => {
    expect(parseDate(46295)).toMatch(/^2026-/);
    expect(parseDate("30/09/2026")).toBe("2026-09-30");
    expect(parseDate("2026-9-3")).toBe("2026-09-03");
  });
  it.each(["2026-02-30", "30/02/2026", "2026-13-01", "hari ini", "", -2])(
    "rejects invalid date %s",
    (date) => expect(() => parseDate(date)).toThrow(),
  );
  it.each([
    { quantity: "banyak" },
    { quantity: -1 },
    { quantity: 0 },
    { quantity: 1.5 },
    { unit_price: "Rp50.000" },
    { revenue: "abc" },
    { discount: -100 },
    { discount: 200000 },
    { order_id: "" },
    { product_name: "" },
  ])("rejects malformed transaction %j", (patch) =>
    expect(() => parseTransactions([{ ...valid, ...patch }])).toThrow(),
  );
  it("rejects missing columns, missing transactions sheet, and broken files", () => {
    expect(() => parseCsv("nama,jumlah\nBrownie,2")).toThrow("Kolom");
    expect(() =>
      parseWorkbook(workbook({ products: [{ product_name: "Brownie" }] })),
    ).toThrow("transactions");
    expect(() => parseWorkbook(new ArrayBuffer(8))).toThrow("XLSX");
    expect(() =>
      parseCsv(
        "date,order_id,product_name,quantity,unit_price\n2026-09-30,A,Brownie,2",
      ),
    ).toThrow();
  });
  it("validates COGS, duplicate products, and expense amounts", () => {
    expect(() =>
      parseProducts([{ product_name: "Brownie", cogs: "abc" }]),
    ).toThrow();
    expect(() =>
      parseProducts([
        { product_name: "Brownie" },
        { product_name: " BROWNIE " },
      ]),
    ).toThrow("duplikat");
    expect(() =>
      parseExpenses([{ date: "2026-09-30", category: "Sewa", amount: -1 }]),
    ).toThrow();
    expect(() =>
      parseTransactions([
        { ...valid, cogs: 20000 },
        { ...valid, cogs: 21000 },
      ]),
    ).toThrow("tidak konsisten");
  });
  it("never mixes old demo COGS into uploaded CSV", () =>
    expect(parseCsv(csv).products).toEqual([]));
  it("limits row counts", () =>
    expect(() =>
      parseTransactions(Array.from({ length: 50001 }, () => valid)),
    ).toThrow("terlalu besar"));
  it("enforces file type, size and empty-file restrictions", async () => {
    await expect(parseFile(new File([csv], "data.txt"))).rejects.toThrow(
      "Jenis file",
    );
    await expect(parseFile(new File([], "data.csv"))).rejects.toThrow("kosong");
    await expect(
      parseFile(new File([new Uint8Array(10 * 1024 * 1024 + 1)], "data.csv")),
    ).rejects.toThrow("10 MB");
    await expect(parseFile(new File(["corrupt"], "data.xlsx"))).rejects.toThrow(
      "XLSX",
    );
  });
});
