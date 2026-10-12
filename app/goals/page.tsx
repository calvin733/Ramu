"use client";
import Link from "next/link";
import { useState } from "react";
import { Plus, Target } from "lucide-react";
import { useBusiness } from "@/components/business-provider";
import { Button } from "@/components/ui/button";
import { GlassButton } from "@/components/glass/glass-button";
import { GoalCard } from "@/components/goals/goal-card";
import { GoalForm } from "@/components/goals/goal-form";
import {
  formatGoalValue,
  metricLabels,
  periodLabels,
  type BusinessGoal,
} from "@/lib/goals";

export default function GoalsPage() {
  const { data, goals, goalProgress, setGoals } = useBusiness();
  const [editing, setEditing] = useState<BusinessGoal | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  function add() {
    setEditing(null);
    setShowForm(true);
  }
  function edit(goal: BusinessGoal) {
    setEditing(goal);
    setShowForm(true);
  }
  function remove(goal: BusinessGoal) {
    if (
      !window.confirm(
        `Hapus target ${metricLabels[goal.metric]} ${periodLabels[goal.period]}?`,
      )
    )
      return;
    try {
      setGoals(goals.filter((g) => g.id !== goal.id));
      setError("");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Target belum dapat dihapus.",
      );
    }
  }
  function toggle(goal: BusinessGoal) {
    try {
      setGoals(
        goals.map((g) =>
          g.id === goal.id ? { ...g, enabled: !g.enabled } : g,
        ),
      );
      setError("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Status target belum dapat disimpan.",
      );
    }
  }
  return (
    <div className="page goals-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">LANGKAH MENUJU TUJUAN</span>
          <h1>Target Bisnis</h1>
          <p>Tetapkan tujuan dan pantau kemajuan bisnis Anda.</p>
        </div>
        <GlassButton onClick={add}>
          <Plus size={18} />
          Tambah Target
        </GlassButton>
      </div>
      {error && (
        <p className="upload-error" role="alert">
          {error}
        </p>
      )}
      {!data && (
        <div className="goal-data-note">
          <p>Tambahkan data bisnis untuk melihat progress target.</p>
          <Link href="/data" className="text-button">
            Tambahkan Data
          </Link>
        </div>
      )}
      {showForm && (
        <GoalForm
          key={editing?.id ?? "new"}
          initial={editing}
          onCancel={() => setShowForm(false)}
          onSave={(goal) => {
            if (
              goals.some(
                (g) =>
                  g.id !== goal.id &&
                  g.metric === goal.metric &&
                  g.period === goal.period,
              )
            )
              throw new Error(
                "Target dengan jenis dan periode ini sudah ada. Edit target tersebut agar tidak duplikat.",
              );
            setGoals(
              editing
                ? goals.map((g) => (g.id === goal.id ? goal : g))
                : [...goals, goal],
            );
            setShowForm(false);
            setError("");
          }}
        />
      )}
      {!goals.length && (
        <section className="panel goals-empty">
          <Target size={32} />
          <h2>Belum ada target bisnis.</h2>
          <p>
            Tambahkan target agar RAMU dapat membantu memantau kemajuan bisnis
            Anda.
          </p>
          <Button onClick={add}>Buat Target Pertama</Button>
        </section>
      )}
      {goalProgress.length > 0 && (
        <section aria-label="Target aktif">
          <div className="goal-grid">
            {goalProgress.map((p) => (
              <GoalCard
                key={`${p.goal.id}:${p.target}:${p.actual}:${p.referenceDate}`}
                progress={p}
                onEdit={edit}
                onDelete={remove}
                onToggle={toggle}
              />
            ))}
          </div>
        </section>
      )}
      {goals.some((g) => !g.enabled) && (
        <section className="paused-goals" aria-label="Target nonaktif">
          <h2>Target Nonaktif</h2>
          <p className="supporting">
            Aktifkan kembali untuk menampilkan progress dan menyertakannya dalam
            insight RAMU.
          </p>
          <div className="goal-grid">
            {goals
              .filter((g) => !g.enabled)
              .map((goal) => (
                <article className="panel paused-goal-card" key={goal.id}>
                  <h3>
                    {metricLabels[goal.metric]} {periodLabels[goal.period]}
                  </h3>
                  <p>Target: {formatGoalValue(goal.metric, goal.target)}</p>
                  <span className="small-badge">Nonaktif</span>
                  <div className="form-actions">
                    <Button variant="secondary" onClick={() => toggle(goal)}>
                      Aktifkan Target
                    </Button>
                    <Button variant="ghost" onClick={() => edit(goal)}>
                      Edit Target
                    </Button>
                    <Button variant="ghost" onClick={() => remove(goal)}>
                      Hapus Target
                    </Button>
                  </div>
                </article>
              ))}
          </div>
        </section>
      )}
      {goalProgress.length > 0 && data && (
        <div className="goal-chat-link">
          <Link href="/ask" className="text-button">
            Tanya RAMU tentang target →
          </Link>
        </div>
      )}
      <p className="supporting">
        Target tersimpan di browser ini. Data transaksi hanya tersedia di sesi
        ini. Progress mengikuti perhitungan RAMU dengan toleransi jalur ±5 poin
        persentase.
      </p>
    </div>
  );
}
