import { CheckCircle2, TriangleAlert } from "lucide-react";
import type { BusinessMetrics, UploadedData } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function DataCapabilities({
  metrics,
  data,
}: {
  metrics: BusinessMetrics;
  data: UploadedData;
}) {
  const statuses = [
    { name: "Pendapatan", available: true },
    { name: "Pesanan", available: metrics.capabilities.orders },
    { name: "Produk", available: metrics.capabilities.products },
    { name: "Jumlah Terjual", available: metrics.capabilities.units },
    { name: "Biaya produk", available: metrics.cogs !== null },
    { name: "Pengeluaran", available: metrics.capabilities.expenses },
  ];
  return (
    <section
      className="panel data-capabilities"
      aria-label="Informasi bisnis yang tersedia"
    >
      <div className="panel-heading">
        <div>
          <h2>Data yang berhasil dikenali</h2>
          <p>
            Untuk ringkasan {formatDate(metrics.period.start)} –{" "}
            {formatDate(metrics.period.end)}. Kemajuan target dihitung sesuai
            periode masing-masing target.
          </p>
        </div>
      </div>
      <ul className="capability-statuses">
        {statuses.map(({ name, available }) => (
          <li key={name} className={available ? "available" : "unavailable"}>
            {available ? (
              <CheckCircle2 size={18} />
            ) : (
              <TriangleAlert size={18} />
            )}
            <strong>{name}</strong>
            <span>{available ? "Tersedia" : "Belum tersedia"}</span>
          </li>
        ))}
      </ul>
      <div className="capability-explanations">
        {!metrics.capabilities.orders && (
          <p>
            Tambahkan nomor pesanan untuk melihat jumlah pesanan dan rata-rata
            nilainya.
          </p>
        )}
        {metrics.cogs === null && (
          <p>
            Biaya produk atau jumlah terjual belum lengkap, jadi laba kotor
            belum bisa dihitung dengan akurat.
          </p>
        )}
        {!metrics.capabilities.expenses && (
          <p>
            {data.expenses.length
              ? "Pengeluaran sudah terbaca, tetapi belum dikonfirmasi lengkap untuk periode analisis."
              : "Data pengeluaran belum tersedia."}{" "}
            Lengkapi biaya produk dan pengeluaran untuk melihat laba bersih pada
            periode target.
          </p>
        )}
        <p className="supporting">
          Data yang tersedia tetap dapat dianalisis. Anda dapat melengkapinya
          nanti.
        </p>
      </div>
    </section>
  );
}
