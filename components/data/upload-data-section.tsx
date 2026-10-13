"use client";
import { useRef, useState, type Ref } from "react";
import {
  ArrowRight,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MappingReview } from "@/components/mapping-review";
import { DataValidationError } from "@/lib/parsers";
import {
  inspectFile,
  normalizeImport,
  type ImportDocument,
} from "@/lib/mapping";
import type { UploadedData } from "@/lib/types";
import type { MappingSummaryData } from "./mapping-summary";
import { downloadCsvTemplate, downloadWorkbook } from "@/lib/templates";
import { cn } from "@/lib/utils";
import { GlassSurface } from "@/components/glass/glass-surface";
import { GlassButton } from "@/components/glass/glass-button";

export function UploadDataSection({
  replacing,
  onProcessed,
  onDemo,
  onCancel,
  headingRef,
}: {
  replacing: boolean;
  onProcessed: (data: UploadedData, mapping: MappingSummaryData) => void;
  onDemo: () => void;
  onCancel: () => void;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const processing = useRef(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<ImportDocument | null>(null);
  async function upload(file?: File) {
    if (!file || processing.current) return;
    processing.current = true;
    setBusy(true);
    setError(null);
    setDocument(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 20));
      setDocument(await inspectFile(file));
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
  return (
    <section
      className="upload-data-section"
      aria-labelledby="connect-data-title"
    >
      <div className="section-heading">
        <div>
          <h2
            id="connect-data-title"
            ref={headingRef}
            tabIndex={-1}
            className="content-navigation-target"
          >
            {replacing ? "Ganti Data Bisnis" : "Hubungkan Data Bisnis"}
          </h2>
          <p>RAMU dapat membantu mengenali format kolom Anda.</p>
        </div>
        {replacing && (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Batal Ganti Data
          </Button>
        )}
      </div>
      {replacing && (
        <p className="replacement-note">
          Data aktif tetap digunakan sampai data pengganti berhasil diproses.
        </p>
      )}
      <GlassSurface as="div" className="upload-grid upload-onboarding">
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
              {busy ? "RAMU sedang membaca file..." : "Upload Excel / CSV"}
            </h3>
            <p>
              {busy
                ? "Mengenali sheet dan kolom sebelum Anda mengonfirmasi."
                : "Tarik file ke sini atau pilih dari perangkat Anda."}
            </p>
            <GlassButton disabled={busy} onClick={() => input.current?.click()}>
              <FileSpreadsheet size={17} />
              Upload Excel / CSV
            </GlassButton>
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
              .xlsx atau .csv · Maks. 10 MB
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
          <Button variant="secondary" disabled={busy} onClick={onDemo}>
            <Sparkles size={16} />
            Gunakan Data Demo
            <ArrowRight size={16} />
          </Button>
          <span className="demo-note">
            Data ilustrasi · April–September 2026
          </span>
        </section>
      </GlassSurface>
      {document && (
        <MappingReview
          document={document}
          onChange={(updated) =>
            setDocument((current) => (current === document ? updated : current))
          }
          onCancel={() => {
            setDocument(null);
            setError(null);
          }}
          onConfirm={(complete) => {
            try {
              const data = normalizeImport(document, complete);
              onProcessed(data, {
                loadedAt: data.source.loadedAt,
                sheets: document.sheets.map((sheet) => ({
                  name: sheet.name,
                  sheetType: sheet.sheetType,
                  mapping: sheet.mapping.map(({ source, target }) => ({
                    source,
                    target,
                  })),
                })),
              });
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Periksa pilihan kolom Anda.",
              );
            }
          }}
        />
      )}
      {error && (
        <div className="upload-error" role="alert">
          <TriangleAlert size={22} />
          <div>
            <h3>RAMU belum dapat mengenali beberapa bagian data Anda.</h3>
            <p>{error}</p>
            <p>
              Pilih kolom tanggal dan pendapatan, atau jumlah dan harga. Gunakan
              Atur Kolom untuk melanjutkan.
            </p>
            {replacing && (
              <span>Data yang sebelumnya digunakan tetap tersedia.</span>
            )}
          </div>
        </div>
      )}
      <section className="panel import-help">
        <div className="panel-heading">
          <div>
            <h2>Perlu contoh file?</h2>
            <p>
              Gunakan template, atau unggah file dengan nama kolom Anda sendiri.
            </p>
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
        <details className="format-details">
          <summary>Panduan menyiapkan data</summary>
          <ul>
            <li>
              Tanggal dan pendapatan sudah cukup. Nomor pesanan, produk, jumlah,
              dan harga memperkaya analisis.
            </li>
            <li>
              Gunakan tanggal YYYY-MM-DD atau DD/MM/YYYY; tanggal asli Excel
              juga didukung.
            </li>
            <li>
              Tulis angka tanpa Rp atau pemisah ribuan. Jumlah harus bilangan
              bulat positif; diskon adalah nilai total per baris.
            </li>
            <li>
              Tambahkan biaya produk per unit untuk melihat laba kotor.
              Pengeluaran lengkap diperlukan untuk laba bersih.
            </li>
            <li>
              Nama sheet bebas. Periksa jenis data dan kolom sebelum konfirmasi.
              Batas 50.000 baris per sheet.
            </li>
            <li>
              Data baru menggantikan data sebelumnya setelah berhasil diproses.
              Data transaksi hilang setelah halaman dimuat ulang.
            </li>
          </ul>
        </details>
      </section>
    </section>
  );
}
