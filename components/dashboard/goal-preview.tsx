import {
  GoalPaceMessage,
  GoalProgressBar,
} from "@/components/goals/goal-progress";
import {
  formatGoalValue,
  metricLabels,
  periodLabels,
  type GoalProgress,
} from "@/lib/goals";
import { formatPercentage } from "@/lib/utils";

export function GoalPreview({
  progress: p,
  showPace = true,
}: {
  progress: GoalProgress;
  showPace?: boolean;
}) {
  return (
    <article className="goal-preview-card">
      <h3>
        {metricLabels[p.goal.metric]} {periodLabels[p.goal.period]}
      </h3>
      <div className="goal-preview-values">
        <strong>
          {p.actual === null
            ? "Data belum tersedia"
            : formatGoalValue(p.goal.metric, p.actual)}
        </strong>
        <span> / {formatGoalValue(p.goal.metric, p.target)}</span>
      </div>
      <GoalProgressBar progress={p} />
      {p.progressPercentage !== null && (
        <p className="goal-preview-stats">
          <strong>{formatPercentage(p.progressPercentage)}</strong>
          <span>Sisa {formatGoalValue(p.goal.metric, p.remaining!)}</span>
          <span>{p.daysRemaining} hari tersisa</span>
        </p>
      )}
      {showPace && <GoalPaceMessage progress={p} />}
    </article>
  );
}
