"use client";
import { useState } from "react";
import { useBusiness } from "@/components/business-provider";
import { Button } from "@/components/ui/button";
import { buildVerifiedContext } from "@/lib/insights";
import { requestExplanation } from "@/lib/ai/client";
import { formatDate, formatPercentage } from "@/lib/utils";
import { GoalPaceMessage, GoalProgressBar } from "./goal-progress";
import { GlassPill } from "@/components/glass/glass-pill";
import {
  formatGoalValue,
  goalInsight,
  metricLabels,
  periodLabels,
  statusLabels,
  type BusinessGoal,
  type GoalProgress,
} from "@/lib/goals";
export function GoalCard({
  progress: p,
  onEdit,
  onDelete,
  onToggle,
}: {
  progress: GoalProgress;
  onEdit?: (g: BusinessGoal) => void;
  onDelete?: (g: BusinessGoal) => void;
  onToggle?: (g: BusinessGoal) => void;
}) {
  const { metrics } = useBusiness();
  const [explanation, setExplanation] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <article className="panel goal-card">
      <div className="goal-card-heading">
        <h3>
          {metricLabels[p.goal.metric]} {periodLabels[p.goal.period]}
        </h3>
        {p.paceStatus && (
          <GlassPill
            className={`goal-badge ${p.paceStatus}`}
            tone={p.paceStatus === "behind" ? "amber" : "sage"}
          >
            {statusLabels[p.paceStatus]}
          </GlassPill>
        )}
      </div>
      <p className="supporting">
        {formatDate(p.periodStart)} – {formatDate(p.periodEnd)}
      </p>
      {p.missing ? (
        <>
          <p>Target: {formatGoalValue(p.goal.metric, p.target)}</p>
          <p className="goal-missing">{p.missing}</p>
        </>
      ) : (
        <>
          <div className="goal-values">
            <strong>{formatGoalValue(p.goal.metric, p.actual!)}</strong>
            <span> / {formatGoalValue(p.goal.metric, p.target)}</span>
          </div>
          <GoalProgressBar progress={p} />
          <p>
            <strong>{formatPercentage(p.progressPercentage!)} tercapai</strong>{" "}
            · Sisa {formatGoalValue(p.goal.metric, p.remaining!)}
          </p>
          <p>
            {p.daysRemaining} hari tersisa ·{" "}
            {formatPercentage(p.expectedProgressToDate)} periode berjalan
          </p>
          <GoalPaceMessage progress={p} />
          {p.supportingProducts[0] && (
            <p>
              {p.supportingProducts[0].name} menyumbang{" "}
              {formatPercentage(p.supportingProducts[0].contribution)}{" "}
              pendapatan periode target.
            </p>
          )}
        </>
      )}
      <details className="goal-coaching">
        <summary>Insight target</summary>
        <p>{goalInsight(p)}</p>
        <p className="supporting">
          Progress dihitung berdasarkan data terakhir:{" "}
          {p.latestDataDate ? formatDate(p.latestDataDate) : "belum tersedia"}.
          Tanggal acuan: {formatDate(p.referenceDate)}.
        </p>
      </details>
      <div className="form-actions">
        {onEdit && (
          <Button variant="secondary" onClick={() => onEdit(p.goal)}>
            Edit Target
          </Button>
        )}
        {onDelete && (
          <Button variant="ghost" onClick={() => onDelete(p.goal)}>
            Hapus Target
          </Button>
        )}
        {onToggle && (
          <Button variant="ghost" onClick={() => onToggle(p.goal)}>
            Nonaktifkan Target
          </Button>
        )}
        {metrics && onEdit && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const context = buildVerifiedContext(
                metrics,
                "Bagaimana progress target saya?",
                [p],
              );
              const result = await requestExplanation("goals", context);
              setExplanation(result.text);
              setBusy(false);
            }}
          >
            {busy
              ? "RAMU sedang menjelaskan..."
              : "Jelaskan Target dengan RAMU"}
          </Button>
        )}
      </div>
      {explanation && (
        <p className="goal-explanation" role="status">
          {explanation}
        </p>
      )}
    </article>
  );
}
