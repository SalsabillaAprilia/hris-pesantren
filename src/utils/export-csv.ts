/**
 * Generic CSV export utility.
 * Generates a UTF-8 BOM CSV file and triggers download.
 */
export function downloadCSV(
  filename: string,
  headers: string[],
  rows: string[][]
): void {
  const headerLine = headers.map((h) => `"${h}"`).join(",");
  const dataLines = rows.map((row) =>
    row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
  );
  const csvContent = "\uFEFF" + [headerLine, ...dataLines].join("\n");
  
  // Menggunakan Data URI sebagai alternatif yang 100% kebal terhadap 
  // ekstensi pihak ketiga (seperti Internet Download Manager) 
  // yang sering membajak (intercept) file Blob menjadi UUID.
  const dataUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
  
  const link = document.createElement("a");
  link.style.display = "none";
  link.href = dataUri;
  link.download = `${filename}.csv`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
