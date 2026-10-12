import { fields, type Field, type SheetType } from "@/lib/mapping";

// Presentation metadata only. No uploaded rows or new data/storage model.
export interface MappingSummaryData {
  loadedAt: string;
  sheets: {
    name: string;
    sheetType: SheetType;
    mapping: { source: string; target: Field | "" }[];
  }[];
}

const sheetLabels = {
  transactions: "Penjualan",
  products: "Produk",
  expenses: "Pengeluaran",
  unknown: "Sheet diabaikan",
};

export function MappingSummary({
  summary,
  isDemo,
}: {
  summary: MappingSummaryData | null;
  isDemo: boolean;
}) {
  return (
    <section className="panel mapping-summary" aria-label="Mapping data aktif">
      <h2>Cara RAMU membaca data</h2>
      <p className="supporting">
        Ringkasan pilihan kolom yang telah dikonfirmasi.
      </p>
      {summary ? (
        summary.sheets.map((sheet, i) => (
          <div className="mapping-summary-sheet" key={i}>
            <h3>{sheet.name}</h3>
            <p className="supporting">{sheetLabels[sheet.sheetType]}</p>
            {sheet.sheetType !== "unknown" && (
              <dl className="mapping-pairs">
                {sheet.mapping.map((column) => (
                  <div key={column.source}>
                    <dt>{column.source}</dt>
                    <dd>
                      <span aria-hidden="true">→ </span>
                      {column.target ? fields[column.target] : "Diabaikan"}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))
      ) : (
        <p>
          {isDemo
            ? "Data demo sudah terstruktur sebagai penjualan, produk, dan pengeluaran. Tidak memerlukan mapping manual."
            : "Ringkasan mapping tidak tersedia untuk sumber ini. Ganti data untuk meninjau dan mengonfirmasi kolom kembali."}
        </p>
      )}
    </section>
  );
}
