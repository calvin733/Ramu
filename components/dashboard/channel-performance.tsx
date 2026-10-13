import { entityLabel } from "@/lib/copy/entity-label";
import type { BusinessMetrics } from "@/lib/types";
import { channelPerformance } from "@/lib/queries/aggregates";
import { formatPercentage, formatRupiah } from "@/lib/utils";
export function ChannelPerformance({ metrics }: { metrics: BusinessMetrics }) {
  const channels = channelPerformance(metrics);
  if (!channels.length) return null;
  return (
    <section className="panel channel-panel" aria-label="Channel Penjualan">
      <div className="executive-heading">
        <h2>Channel Penjualan</h2>
        <p>Kontribusi pendapatan</p>
      </div>
      <ol className="channel-ranking">
        {channels.slice(0, 5).map((c, i) => (
          <li key={c.name}>
            <div>
              <strong>{entityLabel(c.name, "channel")}</strong>
              <span>
                {c.contribution === null
                  ? "—"
                  : formatPercentage(c.contribution)}
              </span>
            </div>
            <div className="channel-track" aria-hidden="true">
              <span
                style={{
                  width: `${Math.max(0, Math.min(100, c.contribution ?? 0))}%`,
                }}
              />
            </div>
            <small>
              {formatRupiah(c.revenue)}
              {i === 0 && c.name !== "Tanpa kanal" ? " · Teratas" : ""}
            </small>
          </li>
        ))}
      </ol>
      {channels.length > 5 && (
        <details className="executive-details">
          <summary>{channels.length - 5} channel lainnya</summary>
          {channels.slice(5).map((c) => (
            <p key={c.name}>
              {entityLabel(c.name, "channel")} · {formatRupiah(c.revenue)} ·{" "}
              {c.contribution === null ? "—" : formatPercentage(c.contribution)}
            </p>
          ))}
        </details>
      )}
      <p className="executive-footnote">
        Porsi dari seluruh penjualan, termasuk transaksi yang belum memiliki
        informasi channel.
      </p>
    </section>
  );
}
