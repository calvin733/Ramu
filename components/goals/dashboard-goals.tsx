"use client";
import Link from "next/link";
import { useBusiness } from "@/components/business-provider";
import { Button } from "@/components/ui/button";
import { GoalPreview } from "@/components/dashboard/goal-preview";
export function DashboardGoals() {
  const { goalProgress } = useBusiness();
  return (
    <section className="dashboard-goals" aria-label="Ringkasan target bisnis">
      <div className="panel-heading">
        <div>
          <h2>Target Bisnis</h2>
        </div>
        <Button variant="secondary" asChild>
          <Link href="/goals">
            {goalProgress.length ? "Lihat Semua Target" : "Buat Target"}
          </Link>
        </Button>
      </div>
      {goalProgress.length ? (
        <div className="goal-grid">
          {goalProgress.slice(0, 3).map((p) => (
            <GoalPreview key={p.goal.id} progress={p} />
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
