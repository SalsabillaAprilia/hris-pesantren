import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface PDFExportOptions {
  filename: string;
  title: string;
  subtitle?: string;
  headers: string[];
  rows: string[][];
  orientation?: "p" | "l";
}

/**
 * Generic PDF export utility using jsPDF + autoTable.
 * Consistent styling matching the system's navy theme.
 */
export function downloadPDF({
  filename,
  title,
  subtitle,
  headers,
  rows,
  orientation = "p",
}: PDFExportOptions): void {
  const doc = new jsPDF(orientation, "pt", "a4");

  // Title
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(title, 40, 35);

  // Subtitle
  let startY = 50;
  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(subtitle, 40, 50);
    startY = 65;
  }

  // Table
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY,
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 4, textColor: [30, 41, 59] },
    headStyles: {
      fillColor: [23, 37, 84], // navy matching --primary: 232 59% 21%
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 40, right: 40 },
  });

  // Footer with date
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `Dicetak: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} — Halaman ${i}/${pageCount}`,
      40,
      doc.internal.pageSize.getHeight() - 20
    );
  }

  // Menggunakan Data URI sebagai alternatif yang 100% kebal terhadap 
  // ekstensi pihak ketiga (seperti IDM) yang membajak file Blob.
  const pdfDataUri = doc.output("datauristring");
  const link = document.createElement("a");
  link.style.display = "none";
  link.href = pdfDataUri;
  link.download = `${filename}.pdf`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
