"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Database,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Package,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  UploadCloud,
} from "lucide-react";
import { useBusiness } from "@/components/business-provider";
import { Button } from "@/components/ui/button";
import {
  DataValidationError,
  parseFile,
  REQUIRED_COLUMNS,
} from "@/lib/parsers";
import { downloadCsvTemplate, downloadWorkbook } from "@/lib/templates";
import { cn, formatDate, formatNumber, normalizeName } from "@/lib/utils";

export default function DataPage() {
  const { data, metrics, setData, loadDemo } = useBusiness(),
    router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false),
    [dragging, setDragging] = useState(false),
    [error, setError] = useState<string | null>(null),
    [success, setSuccess] = useState(false);
  const processing = useRef(false);
  async function upload(file?: File) {
    if (!file || processing.current) return;
    processing.current = true;
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      await new Promise((resolve) => setTimeout(resolve, 20));
      const parsed = await parseFile(file);
      setData(parsed);
      setSuccess(true);
    } catch (error) {
      setError(
        error instanceof DataValidationError
          ? error.message
          : "Data tidak dapat diproses. Silakan periksa isi file dan coba lagi.",
      );
    } finally {
      processing.current = false;
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  const productCount = data
    ? new Set(
        data.transactions.map(
          (t) => t.productId ?? normalizeName(t.productName),
        ),
      ).size
    : 0;
  return (
    <div className="page data-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SATUKAN ANGKA, TEMUKAN CERITA</span>
          <h1>
            Data Bisnis<span className="title-dot">.</span>
          </h1>
          <p>Langkah pertama untuk memahami bisnis Anda lebih baik.</p>
        </div>
        <span className="page-label">
          <ShieldCheck size={15} />
          Privat di sesi browser Anda
        </span>
      </div>
      <section className="data-intro">
        <span className="step-number">01</span>
        <div>
          <h2>Tambahkan Data Bisnis</h2>
          <p>Gunakan data Anda sendiri, atau kenali RAMU dengan data demo.</p>
        </div>
      </section>
      <div className="upload-grid">
        <section
          className={cn("panel upload-panel", dragging && "drag-active")}
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            if (!e.currentTarget.contains(e.relatedTarget as Node))
              setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files.length !== 1)
              setError("Unggah satu file Excel atau CSV dalam satu waktu.");
            else void upload(e.dataTransfer.files[0]);
          }}
          aria-busy={busy}
        >
          <div className="upload-dropzone">
            <span className="upload-icon">
              {busy ? (
                <LoaderCircle size={30} className="spin" />
              ) : (
                <UploadCloud size={30} strokeWidth={1.5} />
              )}
            </span>
            <h3>
              {busy
                ? "RAMU sedang menganalisis data..."
                : "Data Anda, peluang Anda."}
            </h3>
            <p>
              {busy
                ? "Memvalidasi transaksi dan menghitung metrik bisnis."
                : "Tarik file ke sini atau pilih dari perangkat Anda."}
            </p>
            <Button disabled={busy} onClick={() => input.current?.click()}>
              <FileSpreadsheet size={17} />
              Upload Excel / CSV
            </Button>
            <input
              ref={input}
              data-testid="file-input"
              type="file"
              accept=".xlsx,.csv"
              className="sr-only"
              aria-label="Pilih file Excel atau CSV"
              disabled={busy}
              onChange={(e) => void upload(e.target.files?.[0])}
            />
            <span className="upload-restrictions">
              .xlsx atau .csv · Maks. 10 MB · 50.000 baris per sheet
            </span>
          </div>
          <div className="upload-footnote">
            <ShieldCheck size={15} />
            <span>
              File diproses di perangkat Anda. File mentah tidak dikirim ke AI.
            </span>
          </div>
        </section>
        <section className="demo-panel">
          <span className="demo-eyebrow">
            <Sparkles size={15} />
            COBA TANPA FILE
          </span>
          <div className="bakery-visual" aria-hidden="true">
            <span className="bakery-cookie cookie-one">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="bakery-cookie cookie-two">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="bakery-brownie">
              <i />
              <i />
              <i />
            </span>
            <span className="bakery-label">
              Ramu Bakery<small>DIPANGGANG DENGAN CERITA</small>
            </span>
          </div>
          <h3>
            Kenali bisnis lewat
            <br />
            Ramu Bakery.
          </h3>
          <p>
            Enam bulan transaksi, enam produk, dan banyak peluang yang bisa Anda
            temukan.
          </p>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              loadDemo();
              router.push("/dashboard");
            }}
          >
            <Sparkles size={16} />
            Gunakan Data Demo
            <ArrowRight size={16} />
          </Button>
          <span className="demo-note">
            Data ilustrasi · April–September 2026
          </span>
        </section>
      </div>
      {error && (
        <div className="upload-error" role="alert">
          <TriangleAlert size={22} />
          <div>
            <h3>Format data belum sesuai template RAMU.</h3>
            <p>{error}</p>
            <p>
              Kolom minimum: <code>{REQUIRED_COLUMNS.join(", ")}</code>
            </p>
            <span>Data yang sebelumnya digunakan tetap tersedia.</span>
          </div>
        </div>
      )}
      {success && (
        <div className="success-toast" role="status">
          <CheckCircle2 size={18} />
          Data berhasil dianalisis.
        </div>
      )}
      {data && metrics && (
        <section className="panel active-data">
          <div className="panel-heading">
            <div>
              <h2>
                <span className="status-dot loaded" />
                Data yang Digunakan
              </h2>
              <p>Data ini menjadi dasar dashboard dan jawaban RAMU.</p>
            </div>
            <button
              className="icon-button danger"
              aria-label="Hapus data sesi"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Hapus data dari sesi ini? Anda dapat mengunggahnya kembali.",
                  )
                ) {
                  setData(null);
                  setSuccess(false);
                  setError(null);
                }
              }}
            >
              <Trash2 size={17} />
            </button>
          </div>
          <div className="data-summary-grid">
            <div>
              <FileSpreadsheet size={17} />
              <span>Nama File</span>
              <strong>{data.source.name}</strong>
            </div>
            <div>
              <Database size={17} />
              <span>Jumlah Transaksi</span>
              <strong>{formatNumber(data.transactions.length)} baris</strong>
            </div>
            <div>
              <Package size={17} />
              <span>Jumlah Produk</span>
              <strong>{productCount} produk</strong>
            </div>
            <div>
              <CalendarDays size={17} />
              <span>Periode Data</span>
              <strong>
                {formatDate(metrics.dataPeriod.start)} –{" "}
                {formatDate(metrics.dataPeriod.end)}
              </strong>
            </div>
          </div>
          <div className="active-data-bottom">
            <span>
              <Check size={15} />
              Siap dianalisis ·{" "}
              {data.expenses.length
                ? `${formatNumber(data.expenses.length)} catatan pengeluaran`
                : "Tanpa data pengeluaran"}
            </span>
            <div>
              {data.source.kind === "demo" && (
                <Button variant="ghost" onClick={() => downloadWorkbook(data)}>
                  <Download size={15} />
                  Unduh data demo
                </Button>
              )}
              <Button asChild>
                <Link href="/dashboard">
                  Lihat Dashboard
                  <ArrowRight size={16} />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}
      <section className="panel format-guide">
        <div className="panel-heading">
          <div>
            <h2>Format sederhana, insight bermakna.</h2>
            <p>Mulai dari template berikut. Tak perlu mengubah nama kolom.</p>
          </div>
          <div className="template-actions">
            <Button variant="secondary" onClick={() => downloadWorkbook()}>
              <Download size={15} />
              Template Excel
            </Button>
            <Button variant="ghost" onClick={downloadCsvTemplate}>
              <Download size={15} />
              Template CSV
            </Button>
          </div>
        </div>
        <div className="sheet-guide">
          <div>
            <span className="sheet-label">WAJIB</span>
            <h3>transactions</h3>
            <p>Setiap baris adalah satu produk dalam pesanan.</p>
            <div className="column-chips">
              {REQUIRED_COLUMNS.map((c) => (
                <code key={c}>{c}</code>
              ))}
            </div>
            <small>
              Opsional: product_id, discount, revenue, channel, cogs.
            </small>
          </div>
          <div>
            <span className="sheet-label optional">OPSIONAL</span>
            <h3>products</h3>
            <p>Tambahkan biaya per unit untuk menghitung laba kotor.</p>
            <div className="column-chips">
              <code>product_name</code>
              <code>cogs</code>
            </div>
            <small>Opsional: product_id, category, selling_price.</small>
          </div>
          <div>
            <span className="sheet-label optional">OPSIONAL</span>
            <h3>expenses</h3>
            <p>Catat biaya operasional secara terpisah dari COGS.</p>
            <div className="column-chips">
              <code>date</code>
              <code>category</code>
              <code>amount</code>
            </div>
            <small>Opsional: description.</small>
          </div>
        </div>
        <details className="format-details">
          <summary>
            Hal yang perlu diperhatikan
            <ChevronDown size={16} />
          </summary>
          <ul>
            <li>
              Gunakan tanggal YYYY-MM-DD atau DD/MM/YYYY. Tanggal asli Excel
              juga didukung.
            </li>
            <li>
              Tulis angka tanpa Rp atau pemisah ribuan. Quantity harus bilangan
              bulat positif; diskon adalah nilai total per baris.
            </li>
            <li>
              Jika revenue diisi, nilai tersebut digunakan. Jika kosong, RAMU
              menghitung quantity × unit_price − discount.
            </li>
            <li>
              CSV dibaca sebagai transaksi. Laba kotor tersedia jika kolom cogs
              (biaya per unit) diisi.
            </li>
            <li>
              XLSX memerlukan sheet transactions. Nama sheet tidak membedakan
              huruf besar dan kecil; sheet lainnya diabaikan.
            </li>
            <li>
              Unggahan baru menggantikan data sebelumnya. Data hilang setelah
              halaman dimuat ulang.
            </li>
          </ul>
        </details>
      </section>
    </div>
  );
}
