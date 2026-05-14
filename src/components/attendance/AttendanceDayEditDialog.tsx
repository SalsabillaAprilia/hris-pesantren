import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AttendanceDayEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: any | null;
  onSuccess: () => void;
}

export function AttendanceDayEditDialog({ open, onOpenChange, record, onSuccess }: AttendanceDayEditDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    daily_status: "",
    check_in_time: "",
    check_out_time: "",
    late_minutes: "",
    overtime_minutes: "",
    notes: "",
  });

  useEffect(() => {
    if (record && open) {
      setForm({
        daily_status: record.daily_status || "",
        check_in_time: record.check_in ? record.check_in.slice(11, 16) : "",
        check_out_time: record.check_out ? record.check_out.slice(11, 16) : "",
        late_minutes: record.late_minutes?.toString() || "0",
        overtime_minutes: record.overtime_minutes?.toString() || "0",
        notes: "",
      });
    }
  }, [record, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;
    if (!form.notes.trim()) {
      toast.error("Catatan koreksi wajib diisi sebagai audit trail.");
      return;
    }

    try {
      setIsSaving(true);

      const buildTimestamp = (date: string, time: string) => {
        if (!time) return null;
        return `${date}T${time}:00`;
      };

      const { error } = await supabase
        .from("attendance")
        .update({
          daily_status: form.daily_status || null,
          check_in: buildTimestamp(record.date, form.check_in_time),
          check_out: buildTimestamp(record.date, form.check_out_time),
          late_minutes: form.late_minutes ? parseInt(form.late_minutes) : null,
          overtime_minutes: form.overtime_minutes ? parseInt(form.overtime_minutes) : null,
          admin_notes: form.notes.trim(),
        })
        .eq("id", record.id);

      if (error) throw error;
      toast.success("Data kehadiran berhasil dikoreksi");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan koreksi");
    } finally {
      setIsSaving(false);
    }
  };

  if (!record) return null;

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
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground/90 font-bold">Status Kehadiran</Label>
              <Select
                value={form.daily_status}
                onValueChange={(v) => setForm({ ...form, daily_status: v })}
              >
                <SelectTrigger className="h-9 text-sm text-slate-900 shadow-sm border-primary/20">
                  <SelectValue placeholder="Pilih status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hadir" className="text-sm">Hadir</SelectItem>
                  <SelectItem value="Mangkir" className="text-sm">Mangkir</SelectItem>
                  <SelectItem value="Izin" className="text-sm">Izin</SelectItem>
                  <SelectItem value="Cuti" className="text-sm">Cuti</SelectItem>
                  <SelectItem value="Sakit" className="text-sm">Sakit</SelectItem>
                  <SelectItem value="WFA" className="text-sm">WFA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground/90 font-bold">Jam Masuk</Label>
                <Input
                  type="time"
                  value={form.check_in_time}
                  onChange={(e) => setForm({ ...form, check_in_time: e.target.value })}
                  className="h-9 text-sm text-slate-900 shadow-sm border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground/90 font-bold">Jam Keluar</Label>
                <Input
                  type="time"
                  value={form.check_out_time}
                  onChange={(e) => setForm({ ...form, check_out_time: e.target.value })}
                  className="h-9 text-sm text-slate-900 shadow-sm border-primary/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground/90 font-bold">Menit Telat</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.late_minutes}
                  onChange={(e) => setForm({ ...form, late_minutes: e.target.value })}
                  className="h-9 text-sm text-slate-900 shadow-sm border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground/90 font-bold">Menit Lembur</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.overtime_minutes}
                  onChange={(e) => setForm({ ...form, overtime_minutes: e.target.value })}
                  className="h-9 text-sm text-slate-900 shadow-sm border-primary/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground/90 font-bold">
                Catatan Koreksi <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder="Wajib diisi — tuliskan alasan koreksi data ini..."
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
