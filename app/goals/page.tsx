"use client";
import { useState } from "react";
import { Plus, Target } from "lucide-react";
import { useBusiness } from "@/components/business-provider";
import { Button } from "@/components/ui/button";
import { GoalCard } from "@/components/goals/goal-card";
import {
  goalSchema,
  metricLabels,
  parseGoalTarget,
  periodLabels,
  type BusinessGoal,
} from "@/lib/goals";

function GoalForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: BusinessGoal | null;
  onSave: (g: BusinessGoal) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState(
    initial?.metric === "orders" || initial?.metric === "units"
      ? "sales"
      : (initial?.metric ?? "revenue"),
  );
  const [sales, setSales] = useState(
    initial?.metric === "units" ? "units" : "orders",
  );
  const [period, setPeriod] = useState<BusinessGoal["period"]>(
    initial?.period ?? "monthly",
  );
  const [value, setValue] = useState(initial ? String(initial.target) : ""),
    [error, setError] = useState("");
  return (
    <form
      className="panel goal-form"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        try {
          const goal = goalSchema.parse({
            id: initial?.id ?? crypto.randomUUID(),
            metric: kind === "sales" ? sales : kind,
            period,
            target: parseGoalTarget(value),
            createdAt: initial?.createdAt ?? new Date().toISOString(),
            enabled: true,
          });
          onSave(goal);
        } catch (e) {
          setError(
            e instanceof Error && !e.message.startsWith("[")
              ? e.message
              : "Periksa jenis target dan nilai positif. Target pesanan/unit harus berupa bilangan bulat.",
          );
        }
      }}
    >
      <h2>{initial ? "Edit Target" : "Tambah Target"}</h2>
      <label>
        Jenis Target
        <select
          aria-label="Jenis Target"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="revenue">Pendapatan</option>
          <option value="sales">Penjualan</option>
          <option value="grossProfit">Laba Kotor</option>
          <option value="netProfit">Laba Bersih</option>
        </select>
      </label>
      {kind === "sales" && (
        <label>
          Ukur berdasarkan
          <select
            aria-label="Ukur berdasarkan"
            value={sales}
            onChange={(e) => setSales(e.target.value)}
          >
            <option value="orders">Jumlah Pesanan</option>
            <option value="units">Unit Terjual</option>
          </select>
        </label>
      )}
      <label>
        Periode
        <select
          aria-label="Periode"
          value={period}
          onChange={(e) => setPeriod(e.target.value as typeof period)}
        >
          {Object.entries(periodLabels).map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Nilai Target
        <input
          inputMode="decimal"
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={kind === "sales" ? "1500" : "Rp100.000.000"}
        />
      </label>
      <p>
        Target disimpan di browser ini. Laba kotor membutuhkan biaya produk
        lengkap; laba bersih juga membutuhkan biaya operasional yang lengkap
        untuk periode target.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="form-actions">
        <Button type="submit">Simpan Target</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Batal
        </Button>
      </div>
    </form>
  );
}
export default function GoalsPage() {
  const { goals, goalProgress, setGoals } = useBusiness();
  const [editing, setEditing] = useState<BusinessGoal | null>(null),
    [showForm, setShowForm] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="page goals-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">LANGKAH MENUJU TUJUAN</span>
          <h1>Target Bisnis</h1>
          <p>
            Tetapkan tujuan dan lihat seberapa dekat bisnis Anda mencapainya.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          <Plus size={18} />
          Tambah Target
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
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
          <h2>Mulai dengan satu tujuan</h2>
          <p>
            Tetapkan target agar RAMU dapat membantu memantau kemajuan bisnis
            Anda.
          </p>
          <p>
            Anda dapat membuat target tanpa data. Unggah data atau gunakan demo
            untuk melihat progress.
          </p>
        </section>
      )}
      <div className="goal-grid">
        {goalProgress.map((p) => (
          <GoalCard
            key={`${p.goal.id}:${p.target}:${p.actual}:${p.referenceDate}`}
            progress={p}
            onEdit={(g) => {
              setEditing(g);
              setShowForm(true);
            }}
            onDelete={(g) => {
              if (
                !window.confirm(
                  `Hapus target ${metricLabels[g.metric]} ${periodLabels[g.period]}?`,
                )
              )
                return;
              try {
                setGoals(goals.filter((x) => x.id !== g.id));
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Target belum dapat dihapus.",
                );
              }
            }}
          />
        ))}
      </div>
      <p className="supporting">
        Tujuan tersimpan lokal di perangkat ini; data transaksi tetap hanya di
        sesi browser. Progress dihitung oleh RAMU, dengan toleransi jalur target
        ±5 poin persentase.
      </p>
    </div>
  );
}
