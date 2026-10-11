"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  aliases,
  allowedFields,
  applySuggestions,
  fields,
  isPii,
  normalizeHeader,
  schemaMetadata,
  type ImportDocument,
  type SheetType,
} from "@/lib/mapping";
export function MappingReview({
  document,
  onChange,
  onConfirm,
  onCancel,
}: {
  document: ImportDocument;
  onChange: (d: ImportDocument) => void;
  onConfirm: (expensesComplete: boolean) => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [complete, setComplete] = useState(false);
  async function assist() {
    setBusy(true);
    setNotice("RAMU sedang mencoba mengenali kolom...");
    try {
      const response = await fetch("/api/ai/map-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schemaMetadata(document)),
        signal: AbortSignal.timeout(16000),
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      onChange(applySuggestions(document, { sheets: result.sheets }));
      setNotice(
        result.mode === "gemini"
          ? "RAMU memberi saran. Periksa pilihan kolom sebelum melanjutkan."
          : "Pengenalan dasar tersedia. Anda dapat mengatur kolom sendiri tanpa AI.",
      );
    } catch {
      setNotice(
        "Bantuan AI belum tersedia. Atur kolom di bawah untuk melanjutkan.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel mapping-review" aria-label="Atur Kolom">
      <div className="panel-heading">
        <div>
          <h2>RAMU mencoba memahami data Anda.</h2>
          <p>Periksa jenis data dan pilih cara membaca kolom file.</p>
        </div>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void assist()}
        >
          Biarkan RAMU Membantu
        </Button>
      </div>
      <p>
        RAMU menggunakan AI hanya untuk membantu mengenali struktur data.
        Perhitungan bisnis tetap dilakukan oleh sistem RAMU.
      </p>
      <p className="supporting">
        File dan isi baris tetap di browser. Bantuan AI hanya menerima judul
        sheet, kolom, dan jenis isi; kolom yang diduga berisi data pribadi
        dikecualikan.
      </p>
      {notice && <p role="status">{notice}</p>}
      {document.sheets.map((sheet, i) => (
        <div className="mapping-sheet" key={sheet.id}>
          <label>
            Jenis data: {sheet.name}
            <select
              aria-label={`Jenis data ${sheet.name}`}
              value={sheet.sheetType}
              disabled={busy}
              onChange={(e) => {
                const sheetType = e.target.value as SheetType;
                onChange({
                  ...document,
                  sheets: document.sheets.map((s, j) =>
                    j !== i
                      ? s
                      : {
                          ...s,
                          sheetType,
                          mapping: s.columns.map((source) => {
                            const target = isPii(source)
                              ? ""
                              : (allowedFields[sheetType].find((f) =>
                                  aliases[f].some(
                                    (a) =>
                                      normalizeHeader(a) ===
                                      normalizeHeader(source),
                                  ),
                                ) ?? "");
                            return {
                              source,
                              target,
                              confidence: target ? 1 : 0,
                            };
                          }),
                        },
                  ),
                });
              }}
            >
              <option value="transactions">Penjualan</option>
              <option value="products">Produk</option>
              <option value="expenses">Biaya Operasional</option>
              <option value="unknown">Abaikan sheet ini</option>
            </select>
          </label>
          {sheet.sheetType !== "unknown" && (
            <div className="table-scroll">
              <table className="mapping-table">
                <thead>
                  <tr>
                    <th>Kolom File</th>
                    <th>Dibaca Sebagai</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.mapping.map((m, k) => (
                    <tr key={m.source}>
                      <td>{m.source}</td>
                      <td>
                        <select
                          aria-label={`Dibaca sebagai ${m.source} (${sheet.name})`}
                          disabled={busy || isPii(m.source)}
                          value={m.target}
                          onChange={(e) =>
                            onChange({
                              ...document,
                              sheets: document.sheets.map((s, j) =>
                                j !== i
                                  ? s
                                  : {
                                      ...s,
                                      mapping: s.mapping.map((x, l) =>
                                        l !== k
                                          ? x
                                          : {
                                              ...x,
                                              target: e.target
                                                .value as typeof m.target,
                                              confidence: 1,
                                            },
                                      ),
                                    },
                              ),
                            })
                          }
                        >
                          <option value="">Abaikan kolom</option>
                          {allowedFields[sheet.sheetType].map((f) => (
                            <option key={f} value={f}>
                              {fields[f]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {isPii(m.source)
                          ? "Data pribadi diabaikan"
                          : m.target &&
                              m.confidence >= 0.9 &&
                              sheet.mapping.filter((x) => x.target === m.target)
                                .length === 1
                            ? "Tinggi"
                            : "Perlu dicek"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
      {document.sheets.some((s) => s.sheetType === "expenses") && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={complete}
            onChange={(e) => setComplete(e.target.checked)}
          />
          Data biaya operasional lengkap untuk periode unggahan, termasuk hari
          tanpa biaya. Diperlukan untuk menghitung laba bersih.
        </label>
      )}
      <div className="form-actions">
        <Button disabled={busy} onClick={() => onConfirm(complete)}>
          Konfirmasi & Analisis Data
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          Batal
        </Button>
      </div>
    </section>
  );
}
