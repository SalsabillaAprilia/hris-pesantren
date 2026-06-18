import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatError } from "@/utils/error-handler";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Clock, Info } from "lucide-react";

interface AttendanceDayEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: any | null;
  onSuccess: () => void;
}

// Status yang mengharuskan jam masuk diisi
const STATUS_REQUIRES_CHECKIN = ["Hadir", "Terlambat", "WFA", "Lembur", "Hadir (Tanpa Shift)"];
// Status yang berarti tidak masuk — tidak perlu jam masuk/pulang
const STATUS_NO_SHOW = ["Mangkir", "Izin", "Cuti", "Sakit"];

export function AttendanceDayEditDialog({ open, onOpenChange, record, onSuccess }: AttendanceDayEditDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [shiftData, setShiftData] = useState<any>(null);
  const [overtimeApproval, setOvertimeApproval] = useState<any>(null);
  const [isFetchingShift, setIsFetchingShift] = useState(false);

  const [form, setForm] = useState({
    daily_status: "",
    check_in_time: "",
    check_out_time: "",
    late_minutes: 0,
    overtime_minutes: 0,
    notes: "",
  });

  // ─── Reset & load data saat dialog dibuka ───────────────────────────────────
  useEffect(() => {
    if (record && open) {
      setForm({
        daily_status: record.daily_status || "",
        check_in_time: record.check_in ? record.check_in.slice(11, 16) : "",
        check_out_time: record.check_out ? record.check_out.slice(11, 16) : "",
        late_minutes: record.late_minutes ?? 0,
        overtime_minutes: record.overtime_minutes ?? 0,
        notes: "",
      });
      setShiftData(null);
      setOvertimeApproval(null);
      fetchShiftAndApproval();
    }
  }, [record, open]);

  // ─── Fetch data shift karyawan & approval lembur ───────────────────────────
  const fetchShiftAndApproval = async () => {
    if (!record?.employees?.id && !record?.employee_id) return;
    const empId = record.employee_id;
    setIsFetchingShift(true);
    try {
      // Fetch employee's shift
      const { data: emp } = await (supabase as any)
        .from("employees")
        .select("shift_id")
        .eq("id", empId)
        .single();

      if (emp?.shift_id) {
        const { data: shift } = await (supabase as any)
          .from("work_shifts")
          .select("start_time, end_time, late_tolerance_minutes")
          .eq("id", emp.shift_id)
          .single();
        setShiftData(shift ?? null);
      }

      // Fetch overtime approval for this date
      const { data: approval } = await supabase
        .from("approvals")
        .select("id, start_time, end_time")
        .eq("employee_id", empId)
        .eq("type", "overtime")
        .eq("start_date", record.date)
        .in("status", ["approved_unit_leader", "approved_hr"])
        .maybeSingle();
      setOvertimeApproval(approval ?? null);
    } catch (err) {
      console.error("Failed to fetch shift/approval:", err);
    } finally {
      setIsFetchingShift(false);
    }
  };

  // ─── Auto-kalkulasi ketika jam masuk berubah ────────────────────────────────
  const handleCheckInChange = (time: string) => {
    let lateMins = 0;
    let newStatus = form.daily_status;

    if (time && shiftData?.start_time) {
      const shiftStart = new Date(`${record.date}T${shiftData.start_time}`);
      const checkIn = new Date(`${record.date}T${time}:00`);
      const tolerance = shiftData.late_tolerance_minutes ?? 0;
      const toleranceDt = new Date(shiftStart.getTime() + tolerance * 60000);

      if (checkIn > toleranceDt) {
        lateMins = Math.max(0, Math.round((checkIn.getTime() - shiftStart.getTime()) / 60000));
        if (STATUS_REQUIRES_CHECKIN.includes(newStatus) && newStatus !== "Lembur") {
          newStatus = "Terlambat";
        }
      } else {
        lateMins = 0;
        if (newStatus === "Terlambat") newStatus = "Hadir";
      }
    }

    setForm(prev => ({
      ...prev,
      check_in_time: time,
      late_minutes: lateMins,
      daily_status: newStatus,
    }));
  };

  // ─── Auto-kalkulasi ketika jam pulang berubah ───────────────────────────────
  const handleCheckOutChange = (time: string) => {
    let overtimeMins = 0;

    if (time && shiftData?.end_time) {
      const shiftEnd = new Date(`${record.date}T${shiftData.end_time}`);
      const checkOut = new Date(`${record.date}T${time}:00`);
      if (checkOut > shiftEnd) {
        overtimeMins = Math.max(0, Math.round((checkOut.getTime() - shiftEnd.getTime()) / 60000));
      }
    }

    setForm(prev => ({ ...prev, check_out_time: time, overtime_minutes: overtimeMins }));
  };

  // ─── Handler ketika status berubah dari dropdown ────────────────────────────
  const handleStatusChange = (newStatus: string) => {
    let updates: any = { daily_status: newStatus };

    // Jika diubah ke Hadir dan ada data shift, otomatis set jam masuk ke jam shift (tepat waktu)
    if (newStatus === "Hadir" && shiftData?.start_time) {
      const shiftStartTime = shiftData.start_time.slice(0, 5);
      // Jika jam masuk saat ini kosong atau menunjukkan dia terlambat, 
      // paksa reset jam masuk ke jam shift agar konsisten dengan status "Hadir"
      if (!form.check_in_time || form.late_minutes > 0) {
        updates.check_in_time = shiftStartTime;
        updates.late_minutes = 0;
      }
    }

    setForm(prev => ({ ...prev, ...updates }));
  };

  // ─── Validasi & Simpan ──────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;

    if (!form.notes.trim()) {
      toast.error("Catatan koreksi wajib diisi sebagai audit trail.");
      return;
    }

    // Jam masuk wajib diisi untuk status hadir
    if (STATUS_REQUIRES_CHECKIN.includes(form.daily_status) && !form.check_in_time) {
      toast.error("Jam datang wajib diisi untuk status kehadiran ini.");
      return;
    }

    try {
      setIsSaving(true);

      const buildTimestamp = (date: string, time: string) => {
        if (!time) return null;
        return `${date}T${time}:00`;
      };

      // Jika status tidak hadir → kosongkan jam masuk/pulang
      const isNoShow = STATUS_NO_SHOW.includes(form.daily_status);

      const { error } = await supabase
        .from("attendance")
        .update({
          daily_status: form.daily_status || null,
          check_in: isNoShow ? null : buildTimestamp(record.date, form.check_in_time),
          check_out: isNoShow ? null : buildTimestamp(record.date, form.check_out_time),
          late_minutes: isNoShow ? null : (form.late_minutes || null),
          overtime_minutes: isNoShow ? null : (form.overtime_minutes || null),
          admin_notes: form.notes.trim(),
        })
        .eq("id", record.id);

      if (error) throw error;
      toast.success("Data kehadiran berhasil dikoreksi");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(formatError(err, "Gagal menyimpan koreksi"));
    } finally {
      setIsSaving(false);
    }
  };

  if (!record) return null;

  const isNoShow = STATUS_NO_SHOW.includes(form.daily_status);
  const requiresCheckIn = STATUS_REQUIRES_CHECKIN.includes(form.daily_status);
  const hasOvertimeButNoApproval = form.overtime_minutes > 0 && !overtimeApproval;

  // Format menit jadi "X jam Y menit" untuk tampilan
  const formatMinutes = (mins: number) => {
    if (!mins || mins <= 0) return "—";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h}j ${m}m`;
    return `${m} menit`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
        <DialogHeader className="p-6 border-b bg-muted/30">
          <DialogTitle className="text-xl font-bold tracking-tight">Koreksi Kehadiran</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {record.employees?.name} —{" "}
            {format(new Date(record.date), "EEEE, dd MMMM yyyy", { locale: localeId })}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">

            {/* Status Kehadiran */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground/90 font-bold">Status Kehadiran</Label>
              <Select
                value={form.daily_status}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger className="h-9 text-sm text-slate-900 shadow-sm border-primary/20">
                  <SelectValue placeholder="Pilih status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hadir" className="text-sm">Hadir</SelectItem>
                  <SelectItem value="Terlambat" className="text-sm">Terlambat</SelectItem>
                  <SelectItem value="WFA" className="text-sm">WFA (Work From Anywhere)</SelectItem>
                  <SelectItem value="Mangkir" className="text-sm">Mangkir</SelectItem>
                  <SelectItem value="Izin" className="text-sm">Izin</SelectItem>
                  <SelectItem value="Cuti" className="text-sm">Cuti</SelectItem>
                  <SelectItem value="Sakit" className="text-sm">Sakit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Info shift */}
            {shiftData && !isNoShow && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
                <Clock className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-700 leading-tight">
                  Jam shift:{" "}
                  <strong>{shiftData.start_time?.slice(0, 5)} – {shiftData.end_time?.slice(0, 5)}</strong>
                  {shiftData.late_tolerance_minutes > 0 && (
                    <> &nbsp;·&nbsp; Toleransi terlambat: <strong>{shiftData.late_tolerance_minutes} menit</strong></>
                  )}
                </p>
              </div>
            )}

            {!shiftData && !isFetchingShift && !isNoShow && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700 leading-tight">
                  Karyawan ini tidak memiliki shift — kalkulasi otomatis tidak tersedia.
                </p>
              </div>
            )}

            {/* Jam Masuk & Keluar — hanya tampil jika status hadir */}
            {!isNoShow && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground/90 font-bold">
                    Jam Datang {requiresCheckIn && <span className="text-rose-500">*</span>}
                  </Label>
                  <Input
                    type="time"
                    value={form.check_in_time}
                    onChange={(e) => handleCheckInChange(e.target.value)}
                    className="h-9 text-sm text-slate-900 shadow-sm border-primary/20"
                    required={requiresCheckIn}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground/90 font-bold">Jam Keluar</Label>
                  <Input
                    type="time"
                    value={form.check_out_time}
                    onChange={(e) => handleCheckOutChange(e.target.value)}
                    className="h-9 text-sm text-slate-900 shadow-sm border-primary/20"
                  />
                </div>
              </div>
            )}

            {/* Hasil kalkulasi otomatis — read-only */}
            {!isNoShow && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground/90 font-bold">Menit Terlambat</Label>
                  <div className={`h-9 flex items-center px-3 rounded-md text-sm border ${
                    form.late_minutes > 0
                      ? "bg-muted/40 border-muted-foreground/30 text-slate-800 font-semibold"
                      : "bg-muted/40 border text-slate-500"
                  }`}>
                    {form.late_minutes > 0 ? `${form.late_minutes} menit` : "—"}
                    {!shiftData && <span className="text-[10px] ml-1 text-muted-foreground">(no shift)</span>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground/90 font-bold">Lembur</Label>
                  <div className={`h-9 flex items-center px-3 rounded-md text-sm border ${
                    form.overtime_minutes > 0
                      ? "bg-muted/40 border-muted-foreground/30 text-slate-800 font-semibold"
                      : "bg-muted/40 border text-slate-500"
                  }`}>
                    {formatMinutes(form.overtime_minutes)}
                    {!shiftData && <span className="text-[10px] ml-1 text-muted-foreground">(no shift)</span>}
                  </div>
                </div>
              </div>
            )}

            {/* Peringatan lembur tanpa approval */}
            {hasOvertimeButNoApproval && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700 leading-tight">
                  <strong>Perhatian:</strong> Lembur <strong>{formatMinutes(form.overtime_minutes)}</strong> akan dicatat, namun{" "}
                  <strong>tidak ditemukan approval lembur</strong> yang disetujui untuk tanggal ini. Pastikan ini merupakan koreksi yang disengaja.
                </p>
              </div>
            )}

            {/* Catatan Koreksi */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground/90 font-bold">
                Catatan Koreksi <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                placeholder="Tuliskan alasan koreksi data ini..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="text-sm text-slate-900 shadow-sm border-primary/20 min-h-[80px] resize-none"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Catatan ini disimpan sebagai audit trail untuk pertanggungjawaban koreksi.
              </p>
            </div>
          </div>

          <div className="p-6 border-t bg-muted/30 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              className="min-w-[140px] h-10 text-sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="min-w-[140px] h-10 shadow-md bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all transform active:scale-95 px-6"
            >
              {isSaving ? "Menyimpan..." : "Simpan Koreksi"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
