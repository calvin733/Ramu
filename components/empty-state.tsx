"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChartNoAxesCombined,
  FileSpreadsheet,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { useBusiness } from "@/components/business-provider";
import { Button } from "@/components/ui/button";

export function EmptyState() {
  const { loadDemo } = useBusiness(),
    router = useRouter();
  return (
    <div className="empty-state panel">
      <div className="empty-illustration" aria-hidden="true">
        <div className="illustration-card">
          <span />
          <span />
          <span />
          <ChartNoAxesCombined size={64} strokeWidth={1.2} />
        </div>
        <div className="illustration-badge">
          <Sparkles size={22} />
        </div>
      </div>
      <span className="eyebrow">LANGKAH KECIL, PELUANG BESAR</span>
      <h2>Belum ada data bisnis</h2>
      <p>
        Tambahkan data transaksi untuk mulai mendapatkan
        <br className="desktop-break" /> insight dari RAMU.
      </p>
      <div className="empty-actions">
        <Button asChild>
          <Link href="/data">
            <Upload size={17} />
            Upload Data
          </Link>
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            loadDemo();
            router.push("/dashboard");
          }}
        >
          <Sparkles size={17} />
          Gunakan Data Demo
          <ArrowRight size={16} />
        </Button>
      </div>
      <div className="empty-features">
        <span>
          <FileSpreadsheet size={16} />
          Excel & CSV
        </span>
        <span>
          <ShieldCheck size={16} />
          Tanpa menyimpan data permanen
        </span>
      </div>
    </div>
  );
}
