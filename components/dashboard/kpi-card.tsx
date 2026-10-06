import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  type LucideIcon,
} from "lucide-react";
import { cn, formatPercentage } from "@/lib/utils";
export function KpiCard({
  label,
  value,
  growth,
  icon: Icon,
  days,
  note,
}: {
  label: string;
  value: string;
  growth: number | null;
  icon: LucideIcon;
  days: number;
  note?: string;
}) {
  return (
    <section className="panel kpi-card">
      <div className="kpi-top">
        <span>{label}</span>
        <span className="kpi-icon">
          <Icon size={19} strokeWidth={1.65} />
        </span>
      </div>
      <strong className={cn("kpi-value", note && "kpi-value-missing")}>
        {value}
      </strong>
      <div className="kpi-bottom">
        {growth !== null ? (
          <>
            <span className={cn("growth-pill", growth < 0 && "negative")}>
              {growth > 0 ? (
                <ArrowUpRight size={13} />
              ) : growth < 0 ? (
                <ArrowDownRight size={13} />
              ) : (
                <Minus size={13} />
              )}
              {formatPercentage(Math.abs(growth))}
            </span>
            <span>vs {days} hari sebelumnya</span>
          </>
        ) : (
          <span>{note ?? "Data pembanding belum cukup"}</span>
        )}
      </div>
    </section>
  );
}
