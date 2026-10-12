import { metricLabels, formatGoalValue, type GoalProgress } from "@/lib/goals";
import { formatPercentage } from "@/lib/utils";

export function GoalProgressBar({ progress: p }: { progress: GoalProgress }) {
  if (p.progressPercentage === null) return null;
  const visualProgress = Math.max(0, Math.min(100, p.progressPercentage));
  return (
    <div
      className="goal-progress"
      role="progressbar"
      aria-label={`Kemajuan target ${metricLabels[p.goal.metric]}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={visualProgress}
      aria-valuetext={`${formatPercentage(p.progressPercentage)} tercapai`}
    >
      <span style={{ width: `${visualProgress}%` }} />
    </div>
  );
}

export function GoalPaceMessage({ progress: p }: { progress: GoalProgress }) {
  if (p.missing) return <p className="goal-missing">{p.missing}</p>;
  return (
    <p className="goal-reminder">
      {p.paceStatus === "completed"
        ? "Target sudah tercapai. Pertahankan kualitas bisnis Anda."
        : p.requiredRemainingPace === null
          ? "Periode sudah selesai. Tidak ada hari tersisa untuk mengejar target ini."
          : `Perlu rata-rata ${formatGoalValue(p.goal.metric, p.requiredRemainingPace)} per hari untuk mencapai target.`}
    </p>
  );
}
