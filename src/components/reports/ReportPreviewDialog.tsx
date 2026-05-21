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
        <DialogHeader className="p-5 pb-3 border-b bg-muted/30 flex flex-row items-center justify-between shrink-0">
          <div>
            <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{rows.length} data ditemukan</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onExportCSV}
              className="gap-1.5 text-xs h-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
              <FileDown className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={onExportPDF}
              className="gap-1.5 text-xs h-8 border-rose-300 text-rose-600 hover:bg-rose-50">
              <FileText className="h-3.5 w-3.5" /> PDF
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          {rows.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              Tidak ada data untuk ditampilkan
            </div>
          ) : (
            <Table>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:bg-muted [&_th]:z-10">
                <TableRow>
                  <TableHead className="font-semibold text-center whitespace-nowrap w-12">No</TableHead>
                  {headers.map((h) => (
                    <TableHead key={h} className="font-semibold text-left whitespace-nowrap">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 100).map((row, i) => (
                  <TableRow key={i} className="hover:bg-muted/50 transition-colors text-sm">
                    <TableCell className="text-center text-muted-foreground py-1.5">{i + 1}</TableCell>
                    {row.map((cell, j) => (
                      <TableCell key={j} className="text-slate-900 py-1.5 truncate max-w-[200px]">{cell}</TableCell>
                    ))}
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
