import type { Product, Transaction, UploadedData } from "@/lib/types";
import { DAY_MS, isoDay } from "@/lib/utils";

export const demoProducts: Product[] = [
  {
    id: "P01",
    name: "Fudgy Brownie",
    category: "Brownie",
    sellingPrice: 48000,
    cogs: 21000,
  },
  {
    id: "P02",
    name: "Choco Cookie",
    category: "Cookie",
    sellingPrice: 26000,
    cogs: 9500,
  },
  {
    id: "P03",
    name: "Ladyfinger",
    category: "Biskuit",
    sellingPrice: 30000,
    cogs: 24500,
  },
  {
    id: "P04",
    name: "Cheese Brownie",
    category: "Brownie",
    sellingPrice: 56000,
    cogs: 27500,
  },
  {
    id: "P05",
    name: "Almond Brownie",
    category: "Brownie",
    sellingPrice: 62000,
    cogs: 29000,
  },
  {
    id: "P06",
    name: "Classic Cookie",
    category: "Cookie",
    sellingPrice: 22000,
    cogs: 10500,
  },
];

export function createDemoData(): UploadedData {
  // Fixed seed makes the example reproducible without perfectly linear trends.
  let seed = 733;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const transactions: Transaction[] = [];
  const start = Date.UTC(2026, 3, 1),
    end = Date.UTC(2026, 8, 30);
  for (let time = start, day = 0; time <= end; time += DAY_MS, day++) {
    const date = isoDay(time),
      weekday = new Date(time).getUTCDay(),
      month = new Date(time).getUTCMonth() - 3;
    const weekend = weekday === 0 || weekday === 6;
    const promo =
      new Date(time).getUTCDate() === new Date(time).getUTCMonth() + 1;
    const orderCount = Math.floor(
      (11 + month * 1.5 + random() * 8) *
        (weekend ? 1.45 : 1) *
        (promo ? 1.7 : 1),
    );
    for (let order = 0; order < orderCount; order++) {
      const lines = random() > 0.65 ? 2 : 1;
      const chosen = new Set<number>();
      for (let line = 0; line < lines; line++) {
        const r = random();
        let index =
          r < 0.25
            ? 0
            : r < 0.48 + month * 0.027
              ? 1
              : r < 0.64
                ? 2
                : r < 0.79
                  ? 3
                  : r < 0.91
                    ? 4
                    : 5;
        if (chosen.has(index)) index = (index + 1) % 6;
        chosen.add(index);
        const p = demoProducts[index];
        const quantity = 1 + Math.floor(random() * 3);
        const discount = promo ? quantity * p.sellingPrice! * 0.1 : 0;
        transactions.push({
          date,
          orderId: `RAM-${day}-${order}`,
          productId: p.id,
          productName: p.name,
          quantity,
          unitPrice: p.sellingPrice!,
          discount,
          channel:
            random() < 0.45
              ? "WhatsApp"
              : random() < 0.55
                ? "Shopee"
                : "Offline",
        });
      }
    }
  }
  const expenses = Array.from({ length: 6 }, (_, i) => [
    {
      date: `2026-${String(i + 4).padStart(2, "0")}-01`,
      category: "Sewa",
      description: "Sewa dapur",
      amount: 1800000,
    },
    {
      date: `2026-${String(i + 4).padStart(2, "0")}-25`,
      category: "Operasional",
      description: "Listrik dan kemasan",
      amount: 850000 + i * 50000,
    },
  ]).flat();
  return {
    transactions,
    products: demoProducts.map((p) => ({ ...p })),
    expenses,
    source: {
      kind: "demo",
      name: "Demo · Ramu Bakery",
      loadedAt: new Date().toISOString(),
    },
  };
}
