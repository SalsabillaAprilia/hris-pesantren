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
  const [form, setForm] = useState({ type: "leave" as "leave" | "permission", start_date: "", end_date: "", reason: "" });

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
      end_date: form.end_date,
      reason: form.reason,
    });
    if (error) { toast.error("Gagal mengajukan: " + error.message); return; }
    toast.success("Pengajuan berhasil");
    setDialogOpen(false);
    setForm({ type: "leave", start_date: "", end_date: "", reason: "" });
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
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Riwayat Pengajuan Saya</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Ajukan Cuti/Izin</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Ajukan Izin/Cuti</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Jenis</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leave">Cuti</SelectItem>
                    <SelectItem value="permission">Izin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tanggal Mulai</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Tanggal Selesai</Label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Alasan</Label>
                <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
              </div>
              <Button type="submit" className="w-full">Kirim Pengajuan</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jenis</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Alasan</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>
            ) : approvals.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Belum ada riwayat pengajuan</TableCell></TableRow>
            ) : (
              approvals.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.type === "leave" ? "Cuti" : "Izin"}</TableCell>
                  <TableCell>{format(new Date(a.start_date), "dd/MM/yy")} - {format(new Date(a.end_date), "dd/MM/yy")}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={a.reason}>{a.reason}</TableCell>
                  <TableCell>{statusBadge(a.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
