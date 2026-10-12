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
    { name: "HPP", available: metrics.cogs !== null },
    { name: "Pengeluaran", available: metrics.capabilities.expenses },
  ];
  return (
    <section
      className="panel data-capabilities"
      aria-label="Kemampuan data aktif"
    >
      <div className="panel-heading">
        <div>
          <h2>Data yang berhasil dikenali</h2>
          <p>
            Untuk ringkasan {formatDate(metrics.period.start)} –{" "}
            {formatDate(metrics.period.end)}. Ketersediaan pada target mengikuti
            periode targetnya.
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
            HPP atau jumlah terjual belum lengkap, sehingga laba kotor belum
            dapat dihitung.
          </p>
        )}
        {!metrics.capabilities.expenses && (
          <p>
            {data.expenses.length
              ? "Pengeluaran sudah terbaca, tetapi belum dikonfirmasi lengkap untuk periode analisis."
              : "Data pengeluaran belum tersedia."}{" "}
            Laba bersih membutuhkan HPP dan pengeluaran lengkap untuk periode
            target.
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
