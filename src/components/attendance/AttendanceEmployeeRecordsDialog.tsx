import { useState } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AttendanceDayEditDialog } from "./AttendanceDayEditDialog";

interface AttendanceEmployeeRecordsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  records: any[];
  onRefresh: () => void;
}

const getStatusBadge = (record: any) => {
  const status = record.daily_status;
  if (status === "Hadir" || status === "WFA" || (!status && record.check_in)) {
    return (
      <span className="text-[11px] font-semibold text-[hsl(142,45%,25%)] bg-[hsl(142,45%,96%)] px-2 py-0.5 rounded border border-[hsl(142,45%,90%)] whitespace-nowrap">
        {status || "Hadir"}
      </span>
    );
  }
  if (status === "Mangkir") {
    return (
      <span className="text-[11px] font-semibold text-[hsl(0,55%,35%)] bg-[hsl(0,55%,96%)] px-2 py-0.5 rounded border border-[hsl(0,55%,90%)] whitespace-nowrap">
        Mangkir
      </span>
    );
  }
  if (status === "Terlambat") {
    return (
      <span className="text-[11px] font-semibold text-[hsl(38,55%,30%)] bg-[hsl(38,55%,94%)] px-2 py-0.5 rounded border border-[hsl(38,55%,88%)] whitespace-nowrap">
        Terlambat
      </span>
    );
  }
  if (["Izin", "Cuti", "Sakit"].includes(status)) {
    return (
      <span className="text-[11px] font-semibold text-[hsl(232,59%,21%)] bg-[hsl(232,59%,96%)] px-2 py-0.5 rounded border border-[hsl(232,59%,90%)] whitespace-nowrap">
        {status}
      </span>
    );
  }
  return (
    <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap">
      {status || "—"}
    </span>
  );
};

export function AttendanceEmployeeRecordsDialog({
  open,
  onOpenChange,
  employeeName,
  records,
  onRefresh,
}: AttendanceEmployeeRecordsDialogProps) {
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[860px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 border-b bg-muted/30">
            <DialogTitle className="text-xl font-bold tracking-tight">Rekaman Kehadiran</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {employeeName} — {records.length} rekaman pada periode ini
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6">
            {sorted.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                Tidak ada rekaman kehadiran pada periode ini
              </div>
            ) : (
              <div className="relative border rounded-md bg-white flex flex-col">
                <div className="overflow-x-auto overflow-y-visible flex-1 h-auto relative">
                  <Table className="w-full caption-bottom text-sm relative border-separate border-spacing-0">
                    <TableHeader className="z-20 transition-none [&_th]:sticky [&_th]:top-[var(--sticky-offset)] [&_th:not(.sticky)]:z-30 [&_th:not(.sticky)]:bg-muted">
                      <TableRow className="border-none hover:bg-transparent">
                        <TableHead className="font-semibold whitespace-nowrap text-left">Tanggal</TableHead>
                        <TableHead className="font-semibold whitespace-nowrap text-center">Status</TableHead>
                        <TableHead className="font-semibold whitespace-nowrap text-center">Datang</TableHead>
                        <TableHead className="font-semibold whitespace-nowrap text-center">Keluar</TableHead>
                        <TableHead className="font-semibold whitespace-nowrap text-center">Terlambat</TableHead>
                        <TableHead className="font-semibold whitespace-nowrap text-left">Catatan Admin</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sorted.map((r) => (
                        <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50 transition-colors h-11 group border-b border-gray-200 text-sm">
                          <TableCell className="text-slate-900 py-1.5 whitespace-nowrap">
                            {format(new Date(r.date), "EEE, dd MMM yyyy", { locale: localeId })}
                          </TableCell>
                          <TableCell className="py-1.5 text-center">
                            {getStatusBadge(r)}
                          </TableCell>
                          <TableCell className="text-slate-900 py-1.5 text-center">
                            {r.check_in ? r.check_in.slice(11, 16) : "—"}
                          </TableCell>
                          <TableCell className="text-slate-900 py-1.5 text-center">
                            {r.check_out ? r.check_out.slice(11, 16) : "—"}
                          </TableCell>
                          <TableCell className="py-1.5 text-center text-slate-900">
                            {r.late_minutes > 0 ? (
                              <span>{r.late_minutes}mnt</span>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="py-1.5 truncate max-w-[180px] text-slate-900">
                            {r.admin_notes ? (
                              <span title={r.admin_notes}>
                                {r.admin_notes}
                              </span>
                            ) : (
                              <span>—</span>
                            )}
                          </TableCell>
                          <TableCell className="py-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-primary hover:bg-primary/10"
                              onClick={() => {
                                setEditingRecord(r);
                                setEditDialogOpen(true);
                              }}
                              title="Koreksi rekaman ini"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AttendanceDayEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        record={editingRecord}
        onSuccess={() => {
          onRefresh();
        }}
      />
    </>
  );
}
