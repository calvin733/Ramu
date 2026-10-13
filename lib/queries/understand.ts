import type { BusinessMetrics } from "@/lib/types";
import type { BusinessQuery } from "./model";

export const normalizeQuery = (s: string) =>
  s
    .normalize("NFKC")
    .toLocaleLowerCase("id-ID")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
export function detectEntities(question: string, names: string[]) {
  let remaining = ` ${normalizeQuery(question)} `;
  return [...new Set(names)]
    .sort((a, b) => b.length - a.length)
    .filter((name) => {
      const needle = ` ${normalizeQuery(name)} `;
      if (needle.trim() && remaining.includes(needle)) {
        remaining = remaining.replaceAll(needle, " ");
        return true;
      }
      return false;
    })
    .slice(0, 8);
}
export function unsupportedReason(question: string): string | null {
  const q = normalizeQuery(question);
  if (/pelanggan|customer|pembeli|customer lifetime|retensi|loyalitas/.test(q))
    return "RAMU belum memiliki data pelanggan pada dataset ini, jadi pelanggan terbaik atau perilaku pelanggan belum dapat ditentukan.";
  if (
    /prediksi|forecast|ramal|besok|bulan depan|tahun depan|next month/.test(q)
  )
    return "RAMU saat ini belum melakukan forecasting. Saya dapat membantu menjelaskan tren historis yang tersedia; target yang dipantau memakai periode acuan data saat ini.";
  if (/\bstok\b|inventory|persediaan/.test(q))
    return "Data persediaan belum tersedia. Jumlah unit terjual bukan jumlah stok yang masih tersedia.";
  if (/pajak|\btax\b|ppn|pph/.test(q))
    return "RAMU belum memiliki data atau perhitungan pajak. Laba kotor yang tersedia belum memperhitungkan pajak.";
  if (/laba bersih|net profit/.test(q) && !/target|goal|tujuan/.test(q))
    return "Ringkasan bisnis belum menyediakan laba bersih terverifikasi. Pantau target laba bersih di Target Bisnis jika HPP dan cakupan pengeluaran periode target lengkap.";
  return null;
}

export function understandQuery(
  question: string,
  m: BusinessMetrics,
  previous?: BusinessQuery | null,
): BusinessQuery | null {
  if (unsupportedReason(question)) return null;
  const q = normalizeQuery(question);
  const products = detectEntities(
    q,
    m.products.map((p) => p.name),
  );
  const channels = detectEntities(
    q,
    m.channels.filter((c) => c.name !== "Tanpa kanal").map((c) => c.name),
  );
  const explicitChannel =
    /channel|kanal|platform|marketplace|saluran|datang dari mana/.test(q);
  const explicitProduct =
    /produk|product|item|barang|terlaris|paling laris|bestseller|best seller/.test(
      q,
    );
  let topic: BusinessQuery["topic"] | undefined;
  if (/target|tujuan|goal|penjualan per hari.*dibutuhkan/.test(q))
    topic = "goals";
  else if (/perlu diperhatikan|perhatian|peringatan|risiko|warning/.test(q))
    topic = "warnings";
  else if (explicitChannel) topic = "channels";
  else if (explicitProduct) topic = "products";
  else if (products.length && channels.length) return null;
  else if (products.length) topic = "products";
  else if (channels.length) topic = "channels";
  else if (/rata rata.*(pesanan|transaksi|order)|\baov\b|average order/.test(q))
    topic = "aov";
  else if (/\bunits?\b|jumlah terjual|quantity/.test(q)) topic = "units";
  else if (/pesanan|\borders?\b/.test(q)) topic = "orders";
  else if (/margin/.test(q))
    topic = /tertinggi|terendah|paling|highest|lowest/.test(q)
      ? "products"
      : "profit";
  else if (/laba|profit|keuntungan|untung/.test(q)) topic = "profit";
  else if (
    /meningkat|naik|turun|pertumbuhan|tumbuh|growth|periode sebelumnya|previous period/.test(
      q,
    )
  )
    topic = "growth";
  else if (/pendapatan|omzet|revenue/.test(q)) topic = "revenue";
  else if (
    /performa|kinerja|ringkasan|bisnis|penjualan|sales|performance|overview/.test(
      q,
    )
  )
    topic = "overview";
  const followup =
    /^(kalau|bagaimana dengan|bagaimana kalau|dan |yang |what about|and |how about)/.test(
      q,
    ) || /^(kedua|ketiga|second|third)$/.test(q);
  if (!topic && previous && followup) topic = previous.topic;
  if (!topic) return null;
  let operation: BusinessQuery["operation"] = "summary";
  if (
    /bandingkan|dibanding|compare|\bvs\b|versus/.test(q) &&
    !/periode sebelumnya|previous period/.test(q) &&
    (products.length + channels.length > 0 ||
      /produk|channel|kanal|platform|marketplace/.test(q))
  )
    operation = "compare";
  else if (/per hari|\bpace\b|kejar/.test(q))
    operation = topic === "goals" ? "pace" : "summary";
  else if (
    /berapa lagi|sisa|kurang|remaining|dibutuhkan/.test(q) &&
    topic === "goals"
  )
    operation = "remaining";
  else if (
    /terendah|terlemah|terkecil|paling (lemah|kecil|rendah|sedikit|tertinggal)|bottom|lowest|worst|weakest|smallest/.test(
      q,
    )
  )
    operation = "bottom";
  else if (
    /terbaik|terbesar|tertinggi|terlaris|paling berkontribusi|paling (besar|tinggi|banyak|laris|menguntungkan|untung)|\btop\b|best|highest|most/.test(
      q,
    )
  )
    operation = "top";
  else if (/kontribusi|contribution|share|porsi/.test(q))
    operation = "contribution";
  else if (
    /meningkat|naik|turun|pertumbuhan|growth|berubah|periode sebelumnya|previous period/.test(
      q,
    )
  )
    operation = "change";
  else if (/ranking|peringkat|urutan/.test(q)) operation = "ranking";
  else if (/sesuai|jalur|status|on track/.test(q)) operation = "status";
  if (operation === "summary" && /datang dari mana/.test(q)) operation = "top";
  if (
    operation === "summary" &&
    previous &&
    followup &&
    !products.length &&
    !channels.length
  )
    operation = previous.operation;
  const rankMatch = q.match(/(?:peringkat|urutan|rank)\s*(\d{1,2})\b/);
  const rank = /kedua|\bsecond\b/.test(q)
    ? 2
    : /ketiga|\bthird\b/.test(q)
      ? 3
      : rankMatch
        ? Number(rankMatch[1])
        : undefined;
  if (rank) operation = "ranking";
  let metric: BusinessQuery["metric"];
  if (/margin/.test(q)) metric = "margin";
  else if (/laba bersih|net profit/.test(q)) metric = "netProfit";
  else if (/laba|profit|untung/.test(q)) metric = "grossProfit";
  else if (
    /unit|jumlah terjual|terlaris|paling laris|bestseller|best seller/.test(q)
  )
    metric = "units";
  else if (/kontribusi|contribution|share/.test(q)) metric = "contribution";
  else if (/turun|naik|growth|tumbuh|meningkat/.test(q)) metric = "growth";
  else if (/pesanan|\borders?\b/.test(q)) metric = "orders";
  else if (/pendapatan|omzet|revenue/.test(q)) metric = "revenue";
  if (!metric && followup && previous?.topic === topic)
    metric = previous.metric;
  if (topic === "products" && !metric) metric = "revenue";
  if (topic === "channels" && !metric) metric = "revenue";
  if (/turun.*(paling|terbesar)|penurunan.*(terbesar|paling)/.test(q))
    operation = "bottom";
  if (
    topic === "products" &&
    operation !== "compare" &&
    metric !== "growth" &&
    /turun|naik|growth|tumbuh|meningkat|periode sebelumnya|previous period/.test(
      q,
    )
  )
    operation = "change";
  if (topic === "goals" && explicitProduct) operation = "contribution";
  const goalPeriod = /tahun|year/.test(q)
    ? "yearly"
    : /bulan|month/.test(q)
      ? "monthly"
      : /harian|hari ini|daily/.test(q)
        ? "daily"
        : undefined;
  return {
    topic,
    operation,
    entities:
      topic === "channels" ? channels : topic === "products" ? products : [],
    ...(metric ? { metric } : {}),
    ...(rank ? { rank } : {}),
    ...(topic === "goals" && goalPeriod ? { goalPeriod } : {}),
  };
}
