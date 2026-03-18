// lib/export.ts

/** Convierte un array de objetos a CSV, respetando el orden de columns */
export function toCSV(rows: any[], columns: string[]): string {
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    // Escapar comillas dobles y envolver en comillas si hay comas/saltos
    const needsQuotes = /[",\n\r]/.test(s);
    const escaped = s.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };

  const header = columns.map(esc).join(",");
  const body = rows.map(r => columns.map(c => esc(r[c])).join(",")).join("\n");
  return [header, body].filter(Boolean).join("\n");
}

/** Descarga un archivo en el navegador (añade BOM si es CSV para Excel/Numbers) */
export function downloadFile(content: string, filename: string, mime: string) {
  const withBOM = mime.includes("csv") ? "\uFEFF" + content : content;
  const blob = new Blob([withBOM], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Exporta filas visibles como CSV/JSON */
export function exportRowsAsCSV(rows: any[], columns: string[], filename = "export.csv") {
  const csv = toCSV(rows, columns);
  downloadFile(csv, filename, "text/csv");
}
export function exportRowsAsJSON(rows: any[], filename = "export.json") {
  downloadFile(JSON.stringify(rows, null, 2), filename, "application/json");
}