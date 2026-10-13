"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight, CheckCircle2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BusinessMetrics, UploadedData } from "@/lib/types";
import { formatDate, formatNumber, normalizeName } from "@/lib/utils";
import { downloadWorkbook } from "@/lib/templates";
import { useContentNavigation } from "@/components/hooks/use-content-navigation";

export function ActiveDataCard({
  data,
  metrics,
  replacing,
  viewingMapping,
  onReplace,
  onViewMapping,
  onDelete,
}: {
  data: UploadedData;
  metrics: BusinessMetrics;
  replacing: boolean;
  viewingMapping: boolean;
  onReplace: (trigger: HTMLButtonElement) => void;
  onViewMapping: () => void;
  onDelete: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const navigateTo = useContentNavigation();
  useEffect(() => {
    navigateTo(heading);
  }, [data.source.loadedAt, navigateTo]);
  const productCount = new Set(
    data.transactions
      .filter((t) => t.productName)
      .map((t) => t.productId ?? normalizeName(t.productName)),
  ).size;
  const loaded = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(data.source.loadedAt));
  return (
    <section className="panel active-data" aria-label="Data Bisnis Aktif">
      <div className="panel-heading">
        <div>
          <h2 ref={heading} tabIndex={-1} className="content-navigation-target">
            Data Bisnis Aktif
          </h2>
          <p className="processed-status" role="status">
            <CheckCircle2 size={18} /> Data berhasil diproses
          </p>
        </div>
        <span className="small-badge">
          {data.source.kind === "demo" ? "Data demo" : "Data Anda"}
        </span>
      </div>
      <h3 className="active-filename">{data.source.name}</h3>
      <dl className="data-summary-grid">
        <div>
          <dt>Transaksi</dt>
          <dd>{formatNumber(data.transactions.length)} baris transaksi</dd>
        </div>
        <div>
          <dt>Produk</dt>
          <dd>
            {productCount
              ? `${formatNumber(productCount)} produk`
              : "Data belum tersedia"}
          </dd>
        </div>
        <div>
          <dt>Periode data</dt>
          <dd>
            {formatDate(metrics.dataPeriod.start)} –{" "}
            {formatDate(metrics.dataPeriod.end)}
          </dd>
        </div>
        <div>
          <dt>Terakhir dimuat</dt>
          <dd>{loaded}</dd>
        </div>
      </dl>
      <div className="data-source-actions">
        <Button
          variant="secondary"
          aria-expanded={replacing}
          aria-controls="replace-data"
          onClick={(event) => onReplace(event.currentTarget)}
        >
          Ganti Data
        </Button>
        <Button
          variant="ghost"
          aria-expanded={viewingMapping}
          aria-controls="active-mapping"
          onClick={onViewMapping}
        >
          Lihat Mapping
        </Button>
        <Button variant="ghost" onClick={onDelete}>
          Hapus Data
        </Button>
        {data.source.kind === "demo" && (
          <Button variant="ghost" onClick={() => downloadWorkbook(data)}>
            <Download size={16} />
            Unduh data demo
          </Button>
        )}
      </div>
      <div className="active-data-bottom">
        <span>
          Data ini menjadi dasar Dashboard, Target Bisnis, dan Tanya RAMU.
        </span>
        <Button asChild>
          <Link href="/dashboard">
            Lihat Dashboard <ArrowRight size={16} />
          </Link>
        </Button>
      </div>
    </section>
  );
}
