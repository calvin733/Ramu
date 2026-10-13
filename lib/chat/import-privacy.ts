import type { UploadedData } from "@/lib/types";

// Private redaction metadata only. It follows the dataset's browser lifetime,
// is never serialized, and changes neither normalized records nor analytics.
const importedNames = new WeakMap<UploadedData, readonly string[]>();
export function registerImportedPrivacy(
  data: UploadedData,
  document: {
    sheets: {
      name: string;
      columns: string[];
      rows: Record<string, unknown>[];
    }[];
  },
) {
  const names = new Set<string>();
  const normalize = (s: string) =>
    s
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  for (const sheet of document.sheets) {
    const customerSheet = /customer|pelanggan|pembeli|buyer/.test(
      normalize(sheet.name),
    );
    const columns = sheet.columns.filter(
      (column) =>
        /^(?:nama pelanggan|nama customer|customer name|customername|buyer name|buyername|nama pembeli|nama lengkap|nama depan|nama belakang|first name|last name|full name|fullname|customer|pelanggan|pembeli)$/.test(
          normalize(column),
        ) ||
        (customerSheet && /^(?:nama|name)$/.test(normalize(column))),
    );
    for (const row of sheet.rows)
      for (const column of columns) {
        const value = row[column];
        if (
          typeof value === "string" &&
          value.trim().length >= 2 &&
          value.trim().length <= 200
        )
          names.add(value.trim());
      }
  }
  importedNames.set(data, [...names]);
}
export const getImportedPrivateNames = (data: UploadedData) =>
  importedNames.get(data) ?? [];
