import * as XLSX from "xlsx";
import type { UploadedData } from "@/lib/types";

export function downloadWorkbook(data?: UploadedData) {
  const workbook = XLSX.utils.book_new();
  const transactions = data
    ? data.transactions.map((t) => ({
        date: t.date,
        order_id: t.orderId,
        product_id: t.productId ?? "",
        product_name: t.productName,
        quantity: t.quantity,
        unit_price: t.unitPrice,
        discount: t.discount,
        revenue: t.revenue ?? t.quantity * t.unitPrice - t.discount,
        channel: t.channel ?? "",
      }))
    : [
        {
          date: "2026-09-29",
          order_id: "A001",
          product_id: "P01",
          product_name: "Fudgy Brownie",
          quantity: 2,
          unit_price: 50000,
          discount: 0,
          revenue: 100000,
          channel: "WhatsApp",
        },
        {
          date: "2026-09-30",
          order_id: "A002",
          product_id: "P01",
          product_name: "Fudgy Brownie",
          quantity: 1,
          unit_price: 50000,
          discount: 0,
          revenue: 50000,
          channel: "Offline",
        },
      ];
  const products = data
    ? data.products.map((p) => ({
        product_id: p.id ?? "",
        product_name: p.name,
        category: p.category ?? "",
        selling_price: p.sellingPrice ?? "",
        cogs: p.cogs ?? "",
      }))
    : [
        {
          product_id: "P01",
          product_name: "Fudgy Brownie",
          category: "Brownie",
          selling_price: 50000,
          cogs: 20000,
        },
      ];
  const expenses = data?.expenses.length
    ? data.expenses
    : [
        {
          date: "2026-09-30",
          category: "Operasional",
          description: "Kemasan",
          amount: 10000,
        },
      ];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(transactions),
    "transactions",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(products),
    "products",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(expenses),
    "expenses",
  );
  XLSX.writeFile(
    workbook,
    data ? "ramu-demo-bakery.xlsx" : "template-ramu.xlsx",
  );
}
export function downloadCsvTemplate() {
  const content =
    "date,order_id,product_name,quantity,unit_price,discount,channel\n2026-09-29,A001,Fudgy Brownie,2,50000,0,WhatsApp\n2026-09-30,A002,Fudgy Brownie,1,50000,0,Offline\n";
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "template-ramu.csv";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
