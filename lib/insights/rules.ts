import type { BusinessInsight, BusinessMetrics } from "@/lib/types";
import { formatNumber, formatPercentage } from "@/lib/utils";

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
      body: `${top.name} menyumbang ${formatPercentage(top.contribution)} pendapatan, ${m.capabilities.units ? `dengan ${formatNumber(top.units)} unit terjual` : "jumlah unit belum tersedia"}.`,
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
