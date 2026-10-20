"use client";
import Link from "next/link";
import { useBusiness } from "@/components/business-provider";
import { Button } from "@/components/ui/button";
import { GoalPreview } from "@/components/dashboard/goal-preview";
import { relevantGoals } from "@/lib/dashboard/decisions";
export function DashboardGoals({ coachedGoalId }: { coachedGoalId?: string }) {
  const { goalProgress } = useBusiness();
  const preview = relevantGoals(goalProgress).slice(0, 1);
  return (
    <section
      className="panel dashboard-goals"
      aria-label="Ringkasan target bisnis"
    >
      <div className="executive-heading">
        <div>
          <h2>Target Bisnis</h2>
        </div>
        <Button variant="secondary" asChild>
          <Link href="/goals">
            {goalProgress.length ? "Lihat Target" : "Buat Target"}
          </Link>
        </Button>
      </div>
      {goalProgress.length ? (
        <div className="goal-grid">
          {preview.map((p) => (
            <GoalPreview
              key={p.goal.id}
              progress={p}
              showPace={p.goal.id !== coachedGoalId}
            />
          ))}
        </div>
      ) : (
        <p>
          Tetapkan target agar RAMU dapat membantu memantau kemajuan bisnis
          Anda.
        </p>
      )}
    </section>
  );
}
