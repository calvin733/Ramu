import Link from "next/link";
import { Activity, ArrowUpRight } from "lucide-react";
import type { BusinessMetrics, BusinessInsight } from "@/lib/types";
import { type GoalProgress, metricLabels, statusLabels } from "@/lib/goals";
import { channelPerformance } from "@/lib/queries/aggregates";
import { formatPercentage } from "@/lib/utils";

export function BusinessPulse({
  metrics,
  insights,
  goals,
}: {
  metrics: BusinessMetrics;
  insights: BusinessInsight[];
  goals: GoalProgress[];
}) {
  const channel = channelPerformance(metrics).find(
    (c) => c.name !== "Tanpa kanal",
  );
  const product = metrics.products[0];
  const goal = goals.find(
    (p) => p.goal.enabled && p.progressPercentage !== null,
  );
  const warning = insights.find((i) => i.kind === "warning");
  return (
    <section className="panel business-pulse" aria-label="Business Pulse">
      <div className="executive-heading">
        <h2>
          <Activity size={18} /> Business Pulse
        </h2>
        <span className="pulse-live">Dari data Anda</span>
      </div>
      <dl className="signal-list">
        {goal && (
          <div>
            <dt>Target {metricLabels[goal.goal.metric]}</dt>
            <dd>
              <strong>{formatPercentage(goal.progressPercentage!)}</strong>
              <span>{statusLabels[goal.paceStatus!]}</span>
            </dd>
          </div>
        )}
        {channel && (
          <div>
            <dt>Channel teratas</dt>
            <dd>
              <strong>{channel.name}</strong>
              <span>
                {channel.contribution === null
                  ? "Kontribusi belum tersedia"
                  : `${formatPercentage(channel.contribution)} pendapatan`}
              </span>
            </dd>
          </div>
        )}
        {product && (
          <div>
            <dt>Produk utama</dt>
            <dd>
              <strong>{product.name}</strong>
              <span>
                {metrics.revenue > 0
                  ? `${formatPercentage(product.contribution)} pendapatan`
                  : "Kontribusi belum tersedia"}
              </span>
            </dd>
          </div>
        )}
        {warning && (
          <div className="pulse-warning">
            <dt>Perhatian</dt>
            <dd>
              <span>{warning.body}</span>
            </dd>
          </div>
        )}
        {!goal && !channel && !product && !warning && (
          <div>
            <dt>Data aktif</dt>
            <dd>
              <span>
                Pendapatan tersedia. Tambahkan detail untuk membaca sinyal
                bisnis lainnya.
              </span>
            </dd>
          </div>
        )}
      </dl>
      <Link className="executive-link" href="/ask">
        Bahas dengan RAMU <ArrowUpRight size={15} />
      </Link>
    </section>
  );
}
