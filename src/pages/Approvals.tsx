import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Check, X } from "lucide-react";
import { format } from "date-fns";

export default function Approvals() {
  const { employee, user, isAdminOrHr, hasRole } = useAuth();
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ type: "leave" as "leave" | "permission", start_date: "", end_date: "", reason: "" });

  const fetchData = async () => {
    const { data } = await supabase
      .from("approvals")
      .select("*, employees(name, unit_id)")
      .order("created_at", { ascending: false });
    setApprovals(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

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

  const handleApprove = async (id: string, currentStatus: string) => {
    if (!user) return;
    const isUnitLeader = hasRole("unit_leader");
    let newStatus: string;
    const updates: Record<string, any> = {};

    if (currentStatus === "pending" && isUnitLeader) {
      newStatus = "approved_unit_leader";
      updates.approved_by_unit_leader = user.id;
      updates.status = newStatus;
    } else if ((currentStatus === "pending" || currentStatus === "approved_unit_leader") && isAdminOrHr) {
      newStatus = "approved_hr";
      updates.approved_by_hr = user.id;
      updates.status = newStatus;
    } else return;

    await supabase.from("approvals").update(updates).eq("id", id);
    toast.success("Disetujui");
    fetchData();
  };

  const handleReject = async (id: string) => {
    await supabase.from("approvals").update({ status: "rejected" }).eq("id", id);
    toast.success("Ditolak");
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
    <DashboardLayout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Persetujuan</h1>
          <p className="page-description">Pengajuan izin dan cuti</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Ajukan</Button>
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
              <Button type="submit" className="w-full">Kirim</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Karyawan</TableHead>
              <TableHead>Jenis</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Alasan</TableHead>
              <TableHead>Status</TableHead>
              {(isAdminOrHr || hasRole("unit_leader")) && <TableHead>Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>
            ) : approvals.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Tidak ada data</TableCell></TableRow>
            ) : (
              approvals.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.employees?.name ?? "—"}</TableCell>
                  <TableCell>{a.type === "leave" ? "Cuti" : "Izin"}</TableCell>
                  <TableCell>{format(new Date(a.start_date), "dd/MM/yy")} - {format(new Date(a.end_date), "dd/MM/yy")}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{a.reason}</TableCell>
                  <TableCell>{statusBadge(a.status)}</TableCell>
                  {(isAdminOrHr || hasRole("unit_leader")) && (
                    <TableCell>
                      {a.status !== "approved_hr" && a.status !== "rejected" && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleApprove(a.id, a.status)}>
                            <Check className="h-4 w-4 text-primary" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleReject(a.id)}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </DashboardLayout>
  );
}
