"use client";
import { useState } from "react";
import Link from "next/link";
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
import { GlassSurface } from "@/components/glass/glass-surface";

const categories = {
  opportunity: { label: "Peluang", icon: Lightbulb },
  warning: { label: "Perhatian", icon: TriangleAlert },
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
  const preview = insights.slice(0, 2);
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
  if (!preview.length) return null;
  return (
    <GlassSurface className="insights-section insight-unified">
      <div className="section-heading">
        <div>
          <div className="heading-with-icon">
            <Sparkles size={21} />
            <h2>Pertimbangan Lain</h2>
          </div>
        </div>
        <Button variant="ghost" asChild>
          <Link href="/ask">
            Tanya RAMU
            <ArrowUpRight size={15} />
          </Link>
        </Button>
      </div>
      <div className="insight-grid">
        {preview.map((i) => {
          const { label, icon: Icon } = categories[i.kind];
          return (
            <article className={`insight-card ${i.kind}`} key={i.id}>
              <div className="insight-kind">
                <Icon size={15} />
                <span>{label}</span>
              </div>

              <div className="insight-text">
                <h3>{i.title}</h3>
                <p>{i.body}</p>
              </div>
              <details className="insight-next-step">
                <summary>Saran tindakan</summary>
                <div className="insight-action">{i.action}</div>
              </details>
            </article>
          );
        })}
      </div>
      <details className="insight-explanation-disclosure">
        <summary>Penjelasan tambahan</summary>
        <Button variant="ghost" onClick={explain} disabled={loading}>
          {loading ? (
            <LoaderCircle size={15} className="spin" />
          ) : (
            <Sparkles size={15} />
          )}
          {loading
            ? "RAMU sedang menganalisis data..."
            : "Jelaskan dengan RAMU"}
        </Button>
        {explanation && (
          <div className="ai-explanation" aria-live="polite">
            <div>
              <Sparkles size={19} />
              <strong>Penjelasan RAMU</strong>
              <span className="small-badge">
                {explanation.mode === "gemini"
                  ? "Dibantu AI"
                  : "Analisis dasar"}
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
      </details>
      <div className="insight-assurance">
        <ShieldCheck size={13} /> Angka dihitung dari data bisnis Anda. RAMU
        membantu menjelaskannya.
      </div>
    </GlassSurface>
  );
}
