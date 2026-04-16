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
import { Plus } from "lucide-react";
import { format } from "date-fns";
import type { Tables as DbTables } from "@/integrations/supabase/types";
import { supabaseFetchWithTimeout } from "@/utils/supabase-fetch";

export default function Tasks() {
  const { user, isAdminOrHr, hasRole } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<DbTables<"employees">[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", assigned_to: "", due_date: "" });

  const canCreate = isAdminOrHr || hasRole("unit_leader");

  const fetchData = async () => {
    try {
      const [taskRes, empRes] = await supabaseFetchWithTimeout(
        Promise.all([
          supabase.from("tasks").select("*, employees!tasks_assigned_to_fkey(name)").order("created_at", { ascending: false }),
          supabase.from("employees").select("*").eq("status", "active"),
        ])
      );
      
      if (taskRes.error) throw taskRes.error;
      if (empRes.error) throw empRes.error;

      setTasks(taskRes.data ?? []);
      setEmployees(empRes.data ?? []);
    } catch (err) {
      console.error("Tasks: Fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("tasks").insert({
      title: form.title,
      description: form.description || null,
      assigned_to: form.assigned_to,
      assigned_by: user.id,
      due_date: form.due_date || null,
    });
    if (error) { toast.error("Gagal: " + error.message); return; }
    toast.success("Tugas dibuat");
    setDialogOpen(false);
    setForm({ title: "", description: "", assigned_to: "", due_date: "" });
    fetchData();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("tasks").update({ status: status as any }).eq("id", id);
    fetchData();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
      todo: { variant: "secondary", label: "To Do" },
      in_progress: { variant: "default", label: "Dikerjakan" },
      done: { variant: "default", label: "Selesai" },
      cancelled: { variant: "destructive", label: "Dibatalkan" },
    };
    const m = map[status] ?? { variant: "secondary" as const, label: status };
    return <Badge variant={m.variant}>{m.label}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Tugas</h1>
          <p className="page-description">Kelola penugasan karyawan</p>
        </div>
        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Buat Tugas</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Buat Tugas Baru</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Judul</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Deskripsi</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Ditugaskan Ke</Label>
                  <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                    <SelectTrigger><SelectValue placeholder="Pilih karyawan" /></SelectTrigger>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tenggat</Label>
                  <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                </div>
                <Button type="submit" className="w-full">Simpan</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px] text-center">No.</TableHead>
              <TableHead>Judul</TableHead>
              <TableHead>Ditugaskan Ke</TableHead>
              <TableHead>Tenggat</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">Memuat...</TableCell></TableRow>
            ) : tasks.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">Tidak ada tugas</TableCell></TableRow>
            ) : (
              tasks.map((t, index) => (
                <TableRow key={t.id} className="text-sm">
                  <TableCell className="text-center text-slate-500">{index + 1}</TableCell>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell>{t.employees?.name ?? "—"}</TableCell>
                  <TableCell>{t.due_date ? format(new Date(t.due_date), "dd/MM/yy") : "—"}</TableCell>
                  <TableCell>{statusBadge(t.status)}</TableCell>
                  <TableCell>
                    <Select value={t.status} onValueChange={(v) => updateStatus(t.id, v)}>
                      <SelectTrigger className="w-[140px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todo">To Do</SelectItem>
                        <SelectItem value="in_progress">Dikerjakan</SelectItem>
                        <SelectItem value="done">Selesai</SelectItem>
                        <SelectItem value="cancelled">Batal</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </DashboardLayout>
  );
}
