"use client";
import Link from "next/link";
import { useBusiness } from "@/components/business-provider";
import { Button } from "@/components/ui/button";
import { GoalCard } from "./goal-card";
export function DashboardGoals() {
  const { goalProgress } = useBusiness();
  return (
    <section className="dashboard-goals">
      <div className="panel-heading">
        <div>
          <h2>Target Bisnis</h2>
          <p>Pantau tujuan dan langkah yang masih diperlukan.</p>
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
            <GoalCard key={p.goal.id} progress={p} />
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
