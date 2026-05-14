import { useState } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
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
  if (status === "Hadir" || (!status && record.check_in)) {
    return (
      <span className="text-[11px] font-semibold text-[hsl(142,45%,25%)] bg-[hsl(142,45%,96%)] px-2 py-0.5 rounded border border-[hsl(142,45%,90%)] whitespace-nowrap">
        Hadir
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
  if (["Izin", "Cuti", "Sakit", "WFA"].includes(status)) {
    return (
      <span className="text-[11px] font-semibold text-[hsl(38,55%,30%)] bg-[hsl(38,55%,94%)] px-2 py-0.5 rounded border border-[hsl(38,55%,88%)] whitespace-nowrap">
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
            <DialogTitle className="text-xl font-bold tracking-tight">Rekam Kehadiran</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {employeeName} — {records.length} rekam pada periode ini
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {sorted.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                Tidak ada rekam kehadiran pada periode ini
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700 whitespace-nowrap">Tanggal</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-slate-700 whitespace-nowrap">Status</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-slate-700 whitespace-nowrap">Masuk</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-slate-700 whitespace-nowrap">Keluar</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-slate-700 whitespace-nowrap">Telat</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700 whitespace-nowrap">Catatan</th>
                    <th className="w-12 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-muted/40 transition-colors group">
                      <td className="px-4 py-2.5 text-slate-700 font-medium whitespace-nowrap">
                        {format(new Date(r.date), "EEE, dd MMM", { locale: localeId })}
                      </td>
                      <td className="px-4 py-2.5 text-center">{getStatusBadge(r)}</td>
                      <td className="px-4 py-2.5 text-center text-slate-600 font-mono text-xs">
                        {r.check_in ? r.check_in.slice(11, 16) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center text-slate-600 font-mono text-xs">
                        {r.check_out ? r.check_out.slice(11, 16) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {r.late_minutes > 0 ? (
                          <span className="text-red-500 font-medium">{r.late_minutes}mnt</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2.5 max-w-[180px]">
                        {r.admin_notes ? (
                          <span className="text-xs text-slate-500 italic line-clamp-2" title={r.admin_notes}>
                            {r.admin_notes}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-primary hover:bg-primary/10"
                          onClick={() => {
                            setEditingRecord(r);
                            setEditDialogOpen(true);
                          }}
                          title="Koreksi rekam ini"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
