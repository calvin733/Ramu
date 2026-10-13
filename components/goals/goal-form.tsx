"use client";
import { useState, type Ref } from "react";
import { Button } from "@/components/ui/button";
import {
  goalSchema,
  parseGoalTarget,
  periodLabels,
  metricLabels,
  type BusinessGoal,
} from "@/lib/goals";

export function GoalForm({
  initial,
  onSave,
  onCancel,
  headingRef,
}: {
  initial: BusinessGoal | null;
  onSave: (g: BusinessGoal) => void;
  onCancel: () => void;
  headingRef?: Ref<HTMLHeadingElement>;
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
      id="goal-form"
      aria-labelledby="goal-form-title"
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
            enabled: initial?.enabled ?? true,
          });
          onSave(goal);
        } catch (e) {
          setError(
            e instanceof Error && !e.message.startsWith("[")
              ? e.message
              : "Masukkan target lebih dari nol. Untuk pesanan atau jumlah terjual, gunakan angka tanpa pecahan.",
          );
        }
      }}
    >
      <h2
        id="goal-form-title"
        ref={headingRef}
        tabIndex={-1}
        className="content-navigation-target"
      >
        {initial ? "Edit Target Bisnis" : "Tambah Target Bisnis"}
      </h2>
      {initial && (
        <p className="supporting">
          {metricLabels[initial.metric]} · {periodLabels[initial.period]}
        </p>
      )}
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
