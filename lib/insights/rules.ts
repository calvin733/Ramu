import { entityLabel } from "@/lib/copy/entity-label";
import type { BusinessInsight, BusinessMetrics } from "@/lib/types";
import { formatPercentage } from "@/lib/utils";

export function generateInsights(m: BusinessMetrics): BusinessInsight[] {
  const insights: BusinessInsight[] = [];
  if (m.revenueGrowth !== null && Math.abs(m.revenueGrowth) > 10) {
    const up = m.revenueGrowth > 0;
    insights.push({
      id: "growth",
      kind: up ? "opportunity" : "warning",
      title: up ? "Penjualan sedang naik" : "Penjualan sedang turun",
      body: `Pendapatan ${up ? "naik" : "turun"} ${formatPercentage(Math.abs(m.revenueGrowth))} dibanding ${m.period.days} hari sebelumnya.`,
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
          ? "Bergantung pada produk utama"
          : "Andalan bisnis Anda",
      body: `${entityLabel(top.name)} menyumbang ${formatPercentage(top.contribution)} penjualan.`,
      action:
        top.contribution > 40
          ? "Coba tawarkan produk lain bersama produk utama agar penjualan lebih seimbang."
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
      title: "Cek margin produk ini",
      body: `Margin kotor ${entityLabel(low.name)} ${formatPercentage(low.margin!)}; rata-rata produk yang biayanya sudah lengkap ${formatPercentage(avg)}.`,
      action:
        "Cek biaya bahan dan harga jual sebelum memberikan diskon tambahan.",
    });
  if (m.cogs === null)
    insights.push({
      id: "cost",
      kind: "warning",
      title: "Lengkapi biaya produk",
      body: `${m.capabilities.units ? "Biaya produk" : "Jumlah terjual"} belum lengkap, jadi laba kotor belum bisa dihitung dengan akurat.`,
      action:
        "Tambahkan biaya per unit dan jumlah terjual agar keuntungan bisa dihitung.",
    });
  const strong = withMargins.find(
    (p) => p.margin! >= 45 && p.contribution >= 15,
  );
  if (strong && insights.length < 4)
    insights.push({
      id: "strong",
      kind: "opportunity",
      title: "Peluang untuk mendorong keuntungan",
      body: `${entityLabel(strong.name)} memiliki margin ${formatPercentage(strong.margin!)} dan menyumbang ${formatPercentage(strong.contribution)} penjualan.`,
      action:
        "Pertimbangkan menonjolkan produk ini pada katalog atau penawaran paket.",
    });
  return insights.slice(0, 4);
}
export const getBusinessWarnings = (m: BusinessMetrics) =>
  generateInsights(m).filter((i) => i.kind === "warning");
