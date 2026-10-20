"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useBusiness } from "@/components/business-provider";
import { ActiveDataCard } from "@/components/data/active-data-card";
import { DataCapabilities } from "@/components/data/data-capabilities";
import { MappingSummary } from "@/components/data/mapping-summary";
import { UploadDataSection } from "@/components/data/upload-data-section";
import { useContentNavigation } from "@/components/hooks/use-content-navigation";

export default function DataPage() {
  const router = useRouter();
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
  const replaceHeading = useRef<HTMLHeadingElement>(null);
  const mappingHeading = useRef<HTMLHeadingElement>(null);
  const replaceOpener = useRef<HTMLButtonElement | null>(null);
  const navigateTo = useContentNavigation();
  function toggleReplacement(trigger: HTMLButtonElement) {
    if (replacing) {
      setReplacing(false);
      return;
    }
    replaceOpener.current = trigger;
    setViewingMapping(false);
    setReplacing(true);
    navigateTo(replaceHeading);
  }
  function toggleMapping() {
    if (viewingMapping) {
      setViewingMapping(false);
      return;
    }
    setReplacing(false);
    setViewingMapping(true);
    navigateTo(mappingHeading);
  }
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
            onReplace={toggleReplacement}
            onViewMapping={toggleMapping}
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
                headingRef={mappingHeading}
              />
            )}
          </div>
        </>
      )}
      <div id="replace-data" hidden={Boolean(data) && !replacing}>
        {(!data || replacing) && (
          <UploadDataSection
            replacing={Boolean(data)}
            headingRef={replaceHeading}
            onCancel={() => {
              setReplacing(false);
              navigateTo(replaceOpener, "center");
            }}
            onDemo={() => {
              loadDemo();
              setMappingSummary(null);
              complete();
            }}
            onProcessed={(next, mapping) => {
              setData(next);
              setMappingSummary(mapping);
              complete();
              router.push("/dashboard");
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
