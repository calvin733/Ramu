"use client";
import { useState, type CSSProperties } from "react";
import {
  ArrowUpRight,
  Lightbulb,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import type { BusinessInsight, BusinessMetrics } from "@/lib/types";
import { buildVerifiedContext } from "@/lib/insights";
import { Button } from "@/components/ui/button";
import { requestExplanation } from "@/lib/ai/client";

const categories = {
  opportunity: { label: "Peluang", icon: Lightbulb },
  warning: { label: "Perlu Diperhatikan", icon: TriangleAlert },
  performance: { label: "Performa", icon: TrendingUp },
};
export function InsightSection({
  metrics,
  insights,
}: {
  metrics: BusinessMetrics;
  insights: BusinessInsight[];
}) {
  const [explanation, setExplanation] = useState<{
      text: string;
      mode: string;
    } | null>(null),
    [loading, setLoading] = useState(false);
  async function explain() {
    setLoading(true);
    try {
      setExplanation(
        await requestExplanation("explain", buildVerifiedContext(metrics)),
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="insights-section">
      <div className="section-heading">
        <div>
          <div className="heading-with-icon">
            <Sparkles size={21} />
            <h2>Insight RAMU</h2>
            <span className="small-badge">Dari data Anda</span>
          </div>
          <p>Temukan hal yang penting. Tentukan langkah berikutnya.</p>
        </div>
        <Button variant="ghost" onClick={explain} disabled={loading}>
          {loading ? (
            <LoaderCircle size={15} className="spin" />
          ) : (
            <Sparkles size={15} />
          )}
          {loading
            ? "RAMU sedang menganalisis data..."
            : "Jelaskan dengan RAMU"}
          <ArrowUpRight size={15} />
        </Button>
      </div>
      <div
        className="insight-grid"
        style={{ "--insight-count": insights.length } as CSSProperties}
      >
        {insights.map((i) => {
          const { label, icon: Icon } = categories[i.kind];
          return (
            <article className={`insight-card ${i.kind}`} key={i.id}>
              <div className="insight-kind">
                <Icon size={15} />
                <span>{label}</span>
              </div>
              <h3>{i.title}</h3>
              <p>{i.body}</p>
              <div className="insight-action">{i.action}</div>
            </article>
          );
        })}
      </div>
      {explanation && (
        <div className="ai-explanation" aria-live="polite">
          <div>
            <Sparkles size={19} />
            <strong>Penjelasan RAMU</strong>
            <span className="small-badge">
              {explanation.mode === "gemini" ? "Dibantu AI" : "Analisis dasar"}
            </span>
          </div>
          <p>{explanation.text}</p>
          {explanation.mode === "basic" && (
            <small>
              RAMU menggunakan analisis dasar karena layanan AI sedang tidak
              tersedia.
            </small>
          )}
        </div>
      )}
      <div className="insight-assurance">
        <ShieldCheck size={13} /> Angka dihitung dari data bisnis Anda. RAMU
        membantu menjelaskannya.
      </div>
    </section>
  );
}
