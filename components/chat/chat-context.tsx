import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { BusinessMetrics, UploadedData } from "@/lib/types";
import { formatDate, formatNumber } from "@/lib/utils";

export function ChatContext({
  data,
  metrics,
}: {
  data: UploadedData;
  metrics: BusinessMetrics;
}) {
  return (
    <aside
      className="panel chat-data-context"
      aria-label="Data yang dibaca RAMU"
    >
      <div>
        <span className="supporting">
          <CheckCircle2 size={15} />
          RAMU sedang membaca
        </span>
        <strong>{data.source.name}</strong>
      </div>
      <p>
        {formatDate(metrics.dataPeriod.start)} –{" "}
        {formatDate(metrics.dataPeriod.end)}
        <span>{formatNumber(data.transactions.length)} baris transaksi</span>
      </p>
      <Link href="/data" className="text-button">
        Kelola Data
      </Link>
    </aside>
  );
}
