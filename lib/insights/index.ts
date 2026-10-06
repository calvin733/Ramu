import type { BusinessInsight, BusinessMetrics, Intent } from "@/lib/types";
import {
  getBusinessOverview,
  getHighestMarginProduct,
  getMostProfitableProduct,
  getTopSellingProduct,
} from "@/lib/analytics";
import {
  formatDate,
  formatNumber,
  formatPercentage,
  formatRupiah,
} from "@/lib/utils";

export function generateInsights(m: BusinessMetrics): BusinessInsight[] {
  const insights: BusinessInsight[] = [];
  if (m.revenueGrowth !== null && Math.abs(m.revenueGrowth) > 10) {
    const up = m.revenueGrowth > 0;
    insights.push({
      id: "growth",
      kind: up ? "opportunity" : "warning",
      title: up ? "Penjualan bergerak naik" : "Penjualan perlu perhatian",
      body: `Pendapatan ${up ? "tumbuh" : "turun"} ${formatPercentage(Math.abs(m.revenueGrowth))} dibanding ${m.period.days} hari sebelumnya.`,
      action: up
        ? "Tinjau produk yang tumbuh untuk menentukan fokus promosi berikutnya."
        : "Tinjau perubahan penjualan per produk sebelum menambah biaya promosi.",
    });
  }
  const top = m.products[0];
  if (top)
    insights.push({
      id: "top",
      kind: top.contribution > 40 ? "warning" : "performance",
      title:
        top.contribution > 40
          ? "Penjualan terkonsentrasi"
          : "Andalan bisnis Anda",
      body: `${top.name} menyumbang ${formatPercentage(top.contribution)} pendapatan, dengan ${formatNumber(top.units)} unit terjual.`,
      action:
        top.contribution > 40
          ? "Jaga kualitas produk andalan dan uji promosi produk lain untuk mengurangi ketergantungan."
          : "Pastikan produk andalan tetap tersedia saat permintaan meningkat.",
    });
  const withMargins = m.products.filter((p) => p.margin !== null);
  const low = [...withMargins].sort((a, b) => a.margin! - b.margin!)[0];
  const avg = withMargins.length
    ? withMargins.reduce((sum, p) => sum + p.margin!, 0) / withMargins.length
    : 0;
  if (low && (low.margin! < avg - 10 || low.margin! < 20))
    insights.push({
      id: "margin",
      kind: "warning",
      title: "Margin yang perlu ditinjau",
      body: `Margin kotor ${low.name} sebesar ${formatPercentage(low.margin!)}; rata-rata margin produk dengan biaya tersedia adalah ${formatPercentage(avg)}.`,
      action:
        "Tinjau biaya bahan dan diskon produk ini sebelum menjalankan promosi.",
    });
  if (m.cogs === null)
    insights.push({
      id: "cost",
      kind: "warning",
      title: "Lengkapi biaya produk",
      body: `COGS tersedia untuk ${formatPercentage(m.cogsCoverage)} unit terjual. Laba kotor total belum dapat dihitung.`,
      action:
        "Tambahkan biaya per unit pada kolom cogs di sheet products untuk melihat profitabilitas.",
    });
  const strong = withMargins.find(
    (p) => p.margin! >= 45 && p.contribution >= 15,
  );
  if (strong && insights.length < 4)
    insights.push({
      id: "strong",
      kind: "opportunity",
      title: "Peluang dari produk bermargin kuat",
      body: `${strong.name} memiliki margin ${formatPercentage(strong.margin!)} dan menyumbang ${formatPercentage(strong.contribution)} pendapatan.`,
      action:
        "Pertimbangkan menonjolkan produk ini pada katalog atau penawaran paket.",
    });
  return insights.slice(0, 4);
}
export const getBusinessWarnings = (m: BusinessMetrics) =>
  generateInsights(m).filter((i) => i.kind === "warning");

export function detectIntent(question: string): Intent {
  const q = question.toLowerCase();
  if (
    /prediksi|forecast|besok|bulan depan|tahun depan|stok|pelanggan|segmen|pajak|laba bersih|net profit/.test(
      q,
    )
  )
    return "unknown";
  if (
    /paling menguntungkan|paling untung|produk.*(laba|profit|keuntungan)/.test(
      q,
    )
  )
    return "profitable";
  if (/margin/.test(q)) return "margin";
  if (/terlaris|paling laris|best seller|bestseller/.test(q))
    return "bestseller";
  if (/perlu diperhatikan|perhatian|peringatan|risiko/.test(q))
    return "warnings";
  if (/meningkat|naik|turun|pertumbuhan|tumbuh|growth/.test(q)) return "growth";
  if (/performa|kinerja|ringkasan|kabar bisnis/.test(q)) return "overview";
  if (/profit|laba|keuntungan/.test(q)) return "profit";
  if (/pendapatan|omzet|revenue/.test(q)) return "revenue";
  return "unknown";
}
export function answerQuestion(question: string, m: BusinessMetrics): string {
  const period = `${formatDate(m.period.start)}–${formatDate(m.period.end)}`;
  const growthText =
    m.revenueGrowth === null
      ? "Data pembanding belum cukup untuk menghitung pertumbuhan pendapatan."
      : `Pendapatan ${m.revenueGrowth >= 0 ? "naik" : "turun"} ${formatPercentage(Math.abs(m.revenueGrowth))} dibanding ${m.period.days} hari sebelumnya (${formatDate(m.period.previousStart!)}–${formatDate(m.period.previousEnd!)}).`;
  const intent = detectIntent(question);
  if (intent === "bestseller") {
    const p = getTopSellingProduct(m);
    return p
      ? `Produk paling laris adalah ${p.name}, dengan ${formatNumber(p.units)} unit terjual pada ${period}. Pendapatannya ${formatRupiah(p.revenue)}.`
      : "Belum ada produk terjual pada periode ini.";
  }
  if (intent === "profitable" || intent === "margin") {
    const p =
      intent === "margin"
        ? getHighestMarginProduct(m)
        : getMostProfitableProduct(m);
    return p
      ? `${p.name} memiliki ${intent === "margin" ? `margin tertinggi, ${formatPercentage(p.margin!)}` : `laba kotor terbesar, ${formatRupiah(p.grossProfit!)}`}, di antara produk dengan COGS tersedia pada ${period}.${m.cogs === null ? " Sebagian produk belum memiliki data biaya, sehingga peringkat ini belum mencakup seluruh produk." : ""}`
      : "Data biaya belum tersedia. Tambahkan COGS per produk agar RAMU dapat membandingkan profitabilitas.";
  }
  if (intent === "growth") return growthText;
  if (intent === "revenue")
    return `Pendapatan pada ${period} adalah ${formatRupiah(m.revenue)}, dari ${formatNumber(m.orders)} pesanan. ${growthText}`;
  if (intent === "profit")
    return m.grossProfit === null
      ? "Data biaya belum tersedia untuk seluruh produk. RAMU belum dapat menghitung laba kotor total. Tambahkan COGS pada data produk terlebih dahulu."
      : `Laba kotor pada ${period} adalah ${formatRupiah(m.grossProfit)}${m.grossMargin !== null ? ` dengan margin ${formatPercentage(m.grossMargin)}` : ""}. Laba kotor belum dikurangi biaya operasional${m.expenses ? ` sebesar ${formatRupiah(m.expenses)}` : ""}.`;
  if (intent === "warnings") {
    const warnings = getBusinessWarnings(m);
    return warnings.length
      ? warnings.map((i) => `${i.body} ${i.action}`).join("\n\n")
      : "Tidak ada peringatan yang terpicu oleh aturan analisis pada periode ini. Tetap pantau perubahan pendapatan dan margin produk.";
  }
  if (intent === "overview") {
    const top = getTopSellingProduct(m),
      warning = getBusinessWarnings(m)[0];
    return `Pada ${period}, bisnis Anda menghasilkan pendapatan ${formatRupiah(m.revenue)} dari ${formatNumber(m.orders)} pesanan. Rata-rata pesanan ${formatRupiah(m.aov)}.\n\n${growthText}${top ? ` Produk terlaris adalah ${top.name} (${formatNumber(top.units)} unit).` : ""}${warning ? `\n\nPerlu diperhatikan: ${warning.body}` : ""}`;
  }
  return "Data yang tersedia belum cukup untuk menjawab pertanyaan tersebut. Coba tanyakan pendapatan, laba kotor, produk terlaris, margin, atau pertumbuhan penjualan.";
}

export function buildVerifiedContext(m: BusinessMetrics, question?: string) {
  const intent = question ? detectIntent(question) : "overview";
  return {
    overview: getBusinessOverview(m),
    expenses: m.expenses,
    intent,
    products: (intent === "bestseller"
      ? [getTopSellingProduct(m)]
      : intent === "profitable"
        ? [getMostProfitableProduct(m)]
        : intent === "margin"
          ? [getHighestMarginProduct(m)]
          : m.products.slice(0, 8)
    ).filter((p) => p !== null),
    insights: generateInsights(m),
    fallback: question
      ? answerQuestion(question, m)
      : generateInsights(m)
          .map((i) => `${i.body} ${i.action}`)
          .join("\n\n"),
  };
}
export type VerifiedContext = ReturnType<typeof buildVerifiedContext>;
