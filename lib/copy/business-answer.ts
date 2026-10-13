import type { BusinessMetrics } from "@/lib/types";
import type { BusinessFact, VerifiedBusinessAnswer } from "@/lib/queries/model";
import {
  formatDate,
  formatNumber,
  formatPercentage,
  formatRupiah,
} from "@/lib/utils";
import { entityLabel } from "./entity-label";

const names: Partial<Record<BusinessFact["field"], string>> = {
  revenue: "penjualan",
  units: "jumlah terjual",
  orders: "pesanan",
  aov: "rata-rata nilai transaksi",
  grossProfit: "laba kotor",
  margin: "margin kotor",
  growth: "pertumbuhan penjualan",
  orderGrowth: "pesanan",
  aovGrowth: "rata-rata nilai transaksi",
  profitGrowth: "laba kotor",
  contribution: "kontribusi penjualan",
};
const display = (f: BusinessFact) =>
  f.value === null
    ? "belum tersedia"
    : f.format === "currency"
      ? formatRupiah(f.value)
      : f.format === "percent"
        ? formatPercentage(f.value)
        : formatNumber(f.value);
const change = (f: BusinessFact) =>
  `${f.field === "growth" ? "penjualan" : names[f.field]} ${f.value === 0 ? "tidak berubah" : `${f.value! > 0 ? "naik" : "turun"} ${formatPercentage(Math.abs(f.value!))}`} dibanding periode sebelumnya`;

// Select prose from existing facts. Never calculate or change financial values,
// ranking, availability, query interpretation, or the facts sent to Gemini.
export function businessAnswerCopy(
  answer: VerifiedBusinessAnswer,
  m: BusinessMetrics,
): string {
  const { query: q, facts, status } = answer;
  if (
    !q ||
    q.topic === "goals" ||
    !facts.length ||
    status === "unsupported" ||
    status === "clarification"
  )
    return answer.fallbackText;
  const get = (field: BusinessFact["field"], entity?: string) =>
    facts.find((f) => f.field === field && f.entity === entity);
  const period = `${formatDate(m.period.start)}–${formatDate(m.period.end)}`;
  if (q.topic === "products" || q.topic === "channels") {
    const channel = q.topic === "channels";
    const field =
      q.operation === "change" && q.metric === "revenue"
        ? "growth"
        : ((q.metric ?? "revenue") as BusinessFact["field"]);
    const entities = [
      ...new Set(
        facts.map((f) => f.entity).filter((s): s is string => Boolean(s)),
      ),
    ];
    const value = (name: string) => get(field, name);
    if (status === "unavailable") {
      if (field === "grossProfit" || field === "margin")
        return `Saya belum bisa menilai keuntungan produk ini karena ${m.capabilities.units ? "data biaya produk" : "jumlah terjual"} belum lengkap. Lengkapi biaya produk dan jumlah terjual agar saya bisa membandingkannya dengan akurat.`;
      if (field === "growth")
        return "Saya belum bisa membandingkan penjualan produk ini karena penjualan periode sebelumnya belum cukup untuk perbandingan yang akurat.";
      if (field === "contribution")
        return "Porsi penjualan belum bisa dihitung karena belum ada pendapatan pada periode ini.";
      return answer.fallbackText;
    }
    const label = (name: string) =>
      entityLabel(name, channel ? "channel" : "product");
    const evidence = (name: string) => {
      const f = value(name);
      if (!f || f.value === null)
        return `${label(name)}: ${names[field]} belum bisa dihitung`;
      if (field === "growth") return `${label(name)}: ${change(f)}`;
      if (field === "contribution")
        return `${label(name)} menyumbang ${display(f)} penjualan`;
      if (field === "units") return `${label(name)} terjual ${display(f)} unit`;
      if (field === "revenue") return `Penjualan ${label(name)} ${display(f)}`;
      if (field === "grossProfit")
        return `${label(name)} menghasilkan laba kotor ${display(f)}`;
      return `${label(name)} memiliki ${names[field]} ${display(f)}`;
    };
    const best = entities[0];
    const f = value(best);
    let text: string;
    if (q.operation === "compare") {
      const available = entities.filter(
        (name) =>
          value(name)?.value !== null && value(name)?.value !== undefined,
      );
      const sorted = [...available].sort(
        (a, b) => value(b)!.value! - value(a)!.value!,
      );
      const tied =
        sorted.length > 1 &&
        value(sorted[0])!.value === value(sorted[1])!.value;
      text = `${sorted.length > 1 ? (tied ? `${label(sorted[0])} dan ${label(sorted[1])} memiliki ${names[field]} yang sama.` : `${label(sorted[0])} memiliki ${names[field]} lebih ${field === "units" ? "banyak" : "besar"} dibanding ${label(sorted[1])}.`) : "Perbandingan ini belum lengkap."} ${entities.map(evidence).join("; ")}. Periode ${period}.`;
    } else if (q.operation === "top" || q.operation === "bottom" || q.rank) {
      const achievement = q.rank
        ? `berada di peringkat ${q.rank} untuk ${names[field]}`
        : channel
          ? `menjadi channel dengan penjualan ${q.operation === "bottom" ? "terendah" : "terbesar"}`
          : field === "units"
            ? `menjadi produk ${q.operation === "bottom" ? "dengan jumlah terjual paling sedikit" : "paling laris"}`
            : `memiliki ${names[field]} ${q.operation === "bottom" ? "terendah" : "terbesar"}`;
      const amount =
        f?.value !== null && f?.value !== undefined
          ? field === "units"
            ? `, dengan ${display(f)} unit terjual`
            : field === "growth"
              ? `. ${change(f).replace(/^./, (s) => s.toUpperCase())}`
              : field === "contribution"
                ? `, menyumbang ${display(f)} dari penjualan`
                : `, sebesar ${display(f)}`
          : "";
      text =
        channel && label(best) === "Channel belum diketahui"
          ? `Penjualan ${display(get("revenue", best)!)} pada ${period} belum memiliki informasi channel.`
          : `${label(best)} ${achievement}${channel && answer.limitations.includes("unassigned_channel") ? " dari transaksi yang channel-nya sudah teridentifikasi" : ""} pada ${period}${amount}.`;
      const share = get("contribution", best);
      if (
        (field === "revenue" || field === "units") &&
        share?.value !== null &&
        share?.value !== undefined
      )
        text += ` Kontribusinya ${display(share)} dari penjualan.`;
    } else text = `${entities.map(evidence).join("; ")}. Periode ${period}.`;
    if (channel && answer.limitations.includes("unassigned_channel"))
      text += " Sebagian transaksi belum memiliki informasi channel.";
    if (answer.limitations.includes("available_products_only"))
      text +=
        field === "grossProfit" || field === "margin"
          ? ` ${m.capabilities.units ? "Biaya" : "Biaya atau jumlah terjual"} sebagian produk belum lengkap, jadi peringkat ini hanya mencakup produk yang keuntungannya bisa dihitung.`
          : " Sebagian produk belum bisa dibandingkan karena penjualan periode sebelumnya belum cukup.";
    if (q.operation === "top" && f?.value !== null && f?.value !== undefined) {
      if (channel && label(best) === "Channel belum diketahui")
        text +=
          " Lengkapi nama channel agar saya bisa membantu membandingkan tempat penjualan Anda.";
      else if (channel)
        text += ` Pertahankan penjualan di ${label(best)}, lalu bandingkan dengan channel lain sebelum menambah anggaran promosi.`;
      else if (field === "grossProfit" || field === "margin")
        text +=
          f.value > 0
            ? ` Pertimbangkan memprioritaskan ${label(best)} untuk mendorong keuntungan, sambil memantau permintaannya.`
            : " Cek biaya bahan dan harga jual sebelum memberikan diskon tambahan.";
      else if (
        field === "revenue" ||
        field === "units" ||
        field === "contribution"
      )
        text += ` Pastikan ${label(best)} tetap tersedia, lalu coba tawarkan bersama produk lain.`;
    }
    return text;
  }
  const growth = facts.find((f) =>
    ["growth", "orderGrowth", "aovGrowth", "profitGrowth"].includes(f.field),
  );
  if (q.topic === "growth" || q.operation === "change")
    return growth?.value === null || !growth
      ? "Saya belum bisa menilai perubahannya dengan akurat karena angka periode sebelumnya belum cukup untuk dibandingkan."
      : `${change(growth).replace(/^./, (s) => s.toUpperCase())}. ${growth.value < 0 ? "Cek perubahan penjualan per produk sebelum menambah biaya promosi." : "Lihat produk yang sedang tumbuh untuk menentukan fokus promosi berikutnya."}`;
  if (q.topic === "overview") {
    const revenue = get("revenue")!;
    const orders = get("orders");
    const finding =
      growth?.value !== null && growth?.value !== undefined
        ? `${change(growth).replace(/^./, (s) => s.toUpperCase())}. `
        : "";
    return `${finding}Penjualan Anda ${display(revenue)} pada ${period}.${orders?.value !== null && orders?.value !== undefined ? ` Ada ${display(orders)} pesanan pada periode ini.` : ""} ${growth?.value !== null && growth?.value !== undefined && growth.value < 0 ? "Cek produk yang penjualannya turun sebelum menentukan promosi berikutnya." : "Lihat produk dan channel teratas untuk menentukan fokus penjualan berikutnya."}`;
  }
  const main = facts[0];
  if (main.value === null) {
    if (q.topic === "profit")
      return `Keuntungan belum bisa dihitung dengan akurat karena ${m.capabilities.units ? "data biaya produk" : "jumlah terjual"} belum lengkap. Tambahkan biaya per unit dan jumlah terjual agar saya bisa menghitung laba kotor.`;
    if (q.topic === "orders" || q.topic === "aov")
      return `Saya belum bisa menghitung ${q.topic === "orders" ? "jumlah pesanan" : "rata-rata nilai transaksi"} karena nomor transaksi belum tersedia lengkap. Tambahkan nomor transaksi pada data penjualan Anda.`;
    if (q.topic === "units")
      return "Jumlah terjual belum bisa dihitung dengan akurat. Lengkapi jumlah barang yang terjual pada data penjualan Anda.";
    return answer.fallbackText;
  }
  return `${main.field === "units" ? `Anda menjual ${display(main)} unit` : main.field === "orders" ? `Ada ${display(main)} pesanan` : `${names[main.field]!.replace(/^./, (s) => s.toUpperCase())} Anda ${display(main)}`} pada ${period}.${q.topic === "revenue" && growth?.value !== null && growth?.value !== undefined ? ` ${change(growth).replace(/^./, (s) => s.toUpperCase())}.` : ""}${q.topic === "profit" && main.field === "grossProfit" ? " Laba kotor ini belum dikurangi biaya operasional dan pajak." : ""}`;
}
