"use client";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useBusiness } from "@/components/business-provider";
import { ActiveDataCard } from "@/components/data/active-data-card";
import { DataCapabilities } from "@/components/data/data-capabilities";
import { MappingSummary } from "@/components/data/mapping-summary";
import { UploadDataSection } from "@/components/data/upload-data-section";

export default function DataPage() {
  const {
    data,
    metrics,
    setData,
    loadDemo,
    mappingSummary,
    setMappingSummary,
  } = useBusiness();
  const [replacing, setReplacing] = useState(false);
  const [viewingMapping, setViewingMapping] = useState(false);
  function complete() {
    setReplacing(false);
    setViewingMapping(false);
  }
  return (
    <div className="page data-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SUMBER DATA BISNIS</span>
          <h1>
            Data Bisnis<span className="title-dot">.</span>
          </h1>
          <p>
            {data
              ? "Lihat data yang digunakan RAMU dan kelola sumbernya."
              : "Tambahkan data agar RAMU dapat mulai memahami bisnis Anda."}
          </p>
        </div>
        <span className="page-label">
          <ShieldCheck size={15} />
          Privat di sesi browser Anda
        </span>
      </div>
      {data && metrics && (
        <>
          <ActiveDataCard
            data={data}
            metrics={metrics}
            replacing={replacing}
            viewingMapping={viewingMapping}
            onReplace={() => setReplacing((value) => !value)}
            onViewMapping={() => setViewingMapping((value) => !value)}
            onDelete={() => {
              if (
                window.confirm(
                  "Hapus data dari sesi ini? Target bisnis tetap tersimpan di browser.",
                )
              ) {
                setData(null);
                setMappingSummary(null);
                complete();
              }
            }}
          />
          <DataCapabilities metrics={metrics} data={data} />
          <div id="active-mapping" hidden={!viewingMapping}>
            {viewingMapping && (
              <MappingSummary
                summary={mappingSummary}
                isDemo={data.source.kind === "demo"}
              />
            )}
          </div>
        </>
      )}
      <div id="replace-data" hidden={Boolean(data) && !replacing}>
        {(!data || replacing) && (
          <UploadDataSection
            replacing={Boolean(data)}
            onCancel={() => setReplacing(false)}
            onDemo={() => {
              loadDemo();
              setMappingSummary(null);
              complete();
            }}
            onProcessed={(next, mapping) => {
              setData(next);
              setMappingSummary(mapping);
              complete();
            }}
          />
        )}
      </div>
      {data && (
        <p className="supporting session-note">
          Data transaksi hanya tersedia di sesi ini. Muat ulang data setelah
          refresh; target bisnis tetap tersimpan.
        </p>
      )}
    </div>
  );
}
