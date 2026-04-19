import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { supabaseFetchWithTimeout } from "@/utils/supabase-fetch";

interface LeaveRequestWidgetProps {
  employee: any;
}

export function LeaveRequestWidget({ employee }: LeaveRequestWidgetProps) {
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ type: "leave" as "leave" | "permission" | "overtime", start_date: "", end_date: "", start_time: "", end_time: "", reason: "" });

  const fetchData = async () => {
    if (!employee) return;
    try {
      const res = await supabaseFetchWithTimeout<any>(
        supabase
          .from("approvals")
          .select("*")
          .eq("employee_id", employee.id)
          .order("created_at", { ascending: false })
      );
      if (res.error) throw res.error;
      setApprovals(res.data ?? []);
    } catch (err) {
      console.error("LeaveRequestWidget: Fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [employee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    const { error } = await supabase.from("approvals").insert({
      employee_id: employee.id,
      type: form.type,
      start_date: form.start_date,
      end_date: form.type === "overtime" ? form.start_date : form.end_date,
      start_time: form.type === "overtime" ? form.start_time : null,
      end_time: form.type === "overtime" ? form.end_time : null,
      reason: form.reason,
    });
    if (error) { toast.error("Gagal mengajukan: " + error.message); return; }
    toast.success("Pengajuan berhasil");
    setDialogOpen(false);
    setForm({ type: "leave", start_date: "", end_date: "", start_time: "", end_time: "", reason: "" });
    fetchData();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
      pending: { variant: "secondary", label: "Pending" },
      approved_unit_leader: { variant: "default", label: "Disetujui Ketua Unit" },
      approved_hr: { variant: "default", label: "Disetujui HR" },
      rejected: { variant: "destructive", label: "Ditolak" },
    };
    const m = map[status] ?? { variant: "secondary" as const, label: status };
    return <Badge variant={m.variant}>{m.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-muted/20 border rounded-lg mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-700 whitespace-nowrap">Riwayat Pengajuan Saya</h3>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 shadow-md shadow-primary/10 bg-primary hover:bg-primary/90 transition-all transform active:scale-95 font-medium">
              <Plus className="h-4 w-4" /> Ajukan Pengajuan
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
            <DialogHeader className="p-6 border-b bg-muted/30">
              <DialogTitle className="text-xl font-bold tracking-tight">Formulir Pengajuan</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground/90 font-bold">Jenis Pengajuan</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}>
                    <SelectTrigger className="h-9 text-sm text-slate-900 shadow-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leave">Cuti</SelectItem>
                      <SelectItem value="permission">Izin</SelectItem>
                      <SelectItem value="overtime">Lembur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground/90 font-bold">{form.type === "overtime" ? "Tanggal Lembur" : "Tanggal Mulai"}</Label>
                    <Input className="h-9 text-sm text-slate-900 shadow-sm" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
                  </div>
                  {form.type !== "overtime" && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground/90 font-bold">Tanggal Selesai</Label>
                      <Input className="h-9 text-sm text-slate-900 shadow-sm" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required />
                    </div>
                  )}
                </div>
                {form.type === "overtime" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground/90 font-bold">Waktu Mulai Lembur</Label>
                      <Input className="h-9 text-sm text-slate-900 shadow-sm" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground/90 font-bold">Waktu Selesai (Estimasi)</Label>
                      <Input className="h-9 text-sm text-slate-900 shadow-sm" type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground/90 font-bold">Alasan</Label>
                  <Textarea className="text-sm text-slate-900 shadow-sm min-h-[80px]" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
                </div>
              </div>
              <div className="p-6 border-t bg-muted/30 flex justify-end gap-3">
                <Button type="button" variant="outline" className="min-w-[120px] h-10 text-sm" onClick={() => setDialogOpen(false)}>Batal</Button>
                <Button type="submit" className="min-w-[140px] h-10 shadow-md bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all transform active:scale-95 px-6">Simpan Pengajuan</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative border rounded-md bg-white flex flex-col">
        <div className="overflow-x-auto overflow-y-visible flex-1 h-auto relative">
          <table className="w-full caption-bottom text-sm relative border-separate border-spacing-0 min-w-[700px]">
            <TableHeader className="z-20 transition-none [&_th]:sticky [&_th]:top-0 [&_th:not(.sticky)]:z-30 [&_th:not(.sticky)]:bg-muted">
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className="font-semibold border-r border-gray-200 w-[60px] text-center bg-muted">No.</TableHead>
                <TableHead className="font-semibold border-r border-gray-200 w-[120px] bg-muted">Jenis</TableHead>
                <TableHead className="font-semibold border-r border-gray-200 w-[180px] bg-muted">Tanggal</TableHead>
                <TableHead className="font-semibold border-r border-gray-200 bg-muted">Alasan</TableHead>
                <TableHead className="font-semibold border-gray-200 w-[180px] text-center bg-muted">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground border-b border-gray-200">Memuat...</TableCell></TableRow>
              ) : approvals.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground border-b border-gray-200">Belum ada riwayat pengajuan</TableCell></TableRow>
              ) : (
                approvals.map((a, index) => (
                  <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50 transition-colors h-11 group border-b border-gray-200 text-sm">
                    <TableCell className="text-slate-500 py-1.5 text-center">{index + 1}</TableCell>
                    <TableCell className="text-slate-900 py-1.5 font-medium">
                      {a.type === "leave" ? "Cuti" : a.type === "overtime" ? "Lembur" : "Izin"}
                      {a.type === "overtime" && a.start_time && <span className="block text-xs text-muted-foreground">{a.start_time.slice(0,5)} - {a.end_time?.slice(0,5)}</span>}
                    </TableCell>
                    <TableCell className="text-slate-900 py-1.5">
                      {a.type === "overtime" || (a.start_date === a.end_date) 
                        ? format(new Date(a.start_date), "dd/MM/yyyy")
                        : `${format(new Date(a.start_date), "dd/MM/yyyy")} - ${format(new Date(a.end_date), "dd/MM/yyyy")}`}
                    </TableCell>
                    <TableCell className="text-slate-900 py-1.5 truncate max-w-[250px]" title={a.reason}>{a.reason}</TableCell>
                    <TableCell className="text-slate-900 py-1.5 text-center">{statusBadge(a.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </table>
        </div>
      </div>
    </div>
  );
}
