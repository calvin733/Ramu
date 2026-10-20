import Link from "next/link";
import { Activity, ArrowUpRight } from "lucide-react";
import type { DashboardDecision } from "@/lib/dashboard/decisions";
export function BusinessPulse({ decision }: { decision: DashboardDecision }) {
  return (
    <section
      className={`panel business-pulse decision-priority ${decision.kind}`}
      aria-labelledby="priority-title"
      data-decision={decision.id}
    >
      <div className="executive-heading">
        <h2 id="priority-title">
          <Activity size={18} /> Yang Perlu Anda Perhatikan
        </h2>
        <Link
          className="executive-link"
          href={decision.topic === "goal" ? "/goals" : "/ask"}
        >
          {decision.topic === "goal" ? "Tinjau Target" : "Bahas dengan RAMU"}{" "}
          <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="decision-content">
        <div>
          <h3>{decision.title}</h3>
          <p>{decision.body}</p>
        </div>
        <ul className="decision-evidence" aria-label="Angka pendukung">
          {decision.evidence.slice(0, 2).map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
        <div className="decision-next-step">
          <strong>Langkah berikutnya</strong>
          <p>{decision.action}</p>
        </div>
      </div>
    </section>
  );
}
