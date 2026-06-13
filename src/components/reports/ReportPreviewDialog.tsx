import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, FileText, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ReportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  headers: string[];
  rows: string[][];
  onExportCSV: () => void;
  onExportPDF: () => void;
}

export function ReportPreviewDialog({
  open, onOpenChange, title, headers, rows, onExportCSV, onExportPDF,
}: ReportPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
        <DialogHeader className="p-6 border-b bg-muted/30 flex flex-row items-center justify-between shrink-0">
          <div>
            <DialogTitle className="text-xl font-bold tracking-tight">{title}</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">{rows.length} data ditemukan</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onExportCSV}
              className="gap-2 bg-white/50 shadow-sm border-emerald-300 transition-all font-medium text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800">
              <FileDown className="h-4 w-4" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={onExportPDF}
              className="gap-2 bg-white/50 shadow-sm border-rose-300 transition-all font-medium text-rose-600 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-800">
              <FileText className="h-4 w-4" /> Export PDF
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          {rows.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              Tidak ada data untuk ditampilkan
            </div>
          ) : (
            <Table className={`w-full caption-bottom text-sm relative border-separate border-spacing-0 ${headers.length <= 5 ? 'min-w-full' : 'min-w-[1200px]'}`}>
              <TableHeader className="z-20 transition-none [&_th]:sticky [&_th]:top-0 [&_th:not(.sticky)]:z-30 [&_th:not(.sticky)]:bg-muted">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="font-semibold text-center whitespace-nowrap w-12 px-4">No</TableHead>
                  {headers.map((h) => {
                    const isCenter = /hadir|telat|lembur|cuti|sakit|izin|mangkir|jumlah|laki-laki|perempuan|total|selesai|proses|belum mulai|skor|^nilai$|predikat|durasi/i.test(h);
                    return (
                      <TableHead key={h} className={`font-semibold whitespace-nowrap px-4 ${isCenter ? 'text-center' : 'text-left'}`}>
                        {h}
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 100).map((row, i) => (
                  <TableRow key={i} className="cursor-pointer hover:bg-muted/50 transition-colors h-11 group border-b border-gray-200 text-sm">
                    <TableCell className="text-center text-slate-500 py-1.5 px-4">{i + 1}</TableCell>
                    {row.map((cell, j) => {
                      const isCenter = /hadir|telat|lembur|cuti|sakit|izin|mangkir|jumlah|laki-laki|perempuan|total|selesai|proses|belum mulai|skor|^nilai$|predikat|durasi/i.test(headers[j]);
                      return (
                        <TableCell key={j} className={`text-slate-900 py-1.5 px-4 truncate max-w-[200px] ${isCenter ? 'text-center' : 'text-left'}`}>
                          {cell}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {rows.length > 100 && (
            <p className="text-center text-xs text-muted-foreground py-3">
              Menampilkan 100 dari {rows.length} data. Ekspor untuk melihat seluruhnya.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
