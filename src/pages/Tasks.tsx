import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, ClipboardCheck, Pencil, Trash2, Search } from "lucide-react";
import { format, isWithinInterval, parseISO } from "date-fns";
import { supabaseFetchWithTimeout } from "@/utils/supabase-fetch";

const EMPTY_FORM = { title: "", description: "", assigned_to: "", due_date: "" };

export default function Tasks() {
  const { user, isAdminOrHr, isEmployee, hasRole, employee: currentUser } = useAuth();
  const isUnitLeader = hasRole("unit_leader");

  // ── Role flags ──────────────────────────────────────────────────────────────
  // Super Admin & HR  → monitoring only (read-only, date range filter)
  // Unit Leader       → full CRUD, filter/search, hanya unitnya
  // Employee          → hanya tugas sendiri, ubah status

  const [tasks,     setTasks]     = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]); // untuk form create/edit
  const [loading,   setLoading]   = useState(true);
  const [isSaving,  setIsSaving]  = useState(false);

  // Create / Edit dialog (unit_leader only)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Delete dialog (unit_leader only)
  const [deleteOpen,   setDeleteOpen]   = useState(false);
  const [deletingTask, setDeletingTask] = useState<any | null>(null);
  const [isDeleting,   setIsDeleting]   = useState(false);

  // Filter — Unit Leader
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Filter — Admin/HR (date range)
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    try {
      const [taskRes, empRes, rolesRes] = await supabaseFetchWithTimeout(
        Promise.all([
          supabase
            .from("tasks")
            .select("*, employees!tasks_assigned_to_fkey(name, user_id, unit_id)")
            .order("created_at", { ascending: false }),
          supabase.from("employees").select("id, name, user_id, unit_id").eq("status", "active"),
          supabase.from("user_roles").select("user_id, role"),
        ])
      );
      if (taskRes.error) throw taskRes.error;
      if (empRes.error)  throw empRes.error;

      const rolesMap = Object.fromEntries(
        (rolesRes.data ?? []).map((r: any) => [r.user_id, r.role])
      );
      let allTasks = taskRes.data ?? [];

      // Unit leader hanya melihat tugas anggota unitnya
      if (isUnitLeader && currentUser?.unit_id) {
        allTasks = allTasks.filter(
          (t: any) => t.employees?.unit_id === currentUser.unit_id
        );
      }
      // Karyawan biasa hanya melihat tugas sendiri
      if (isEmployee && !isUnitLeader) {
        allTasks = allTasks.filter((t: any) => t.employees?.user_id === user?.id);
      }
      setTasks(allTasks);

      // Daftar karyawan untuk form (unit leader: hanya unitnya; exclude admin/HR)
      let filteredEmp = (empRes.data ?? []).filter((emp: any) => {
        const role = rolesMap[emp.user_id];
        return !role || !["super_admin", "hr"].includes(role);
      });
      if (isUnitLeader && currentUser?.unit_id) {
        filteredEmp = filteredEmp.filter((e: any) => e.unit_id === currentUser.unit_id);
      }
      setEmployees(filteredEmp);
    } catch (err) {
      console.error("Tasks: Fetch error", err);
      toast.error("Gagal memuat data tugas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ── Filtered tasks (client-side) ────────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (isAdminOrHr) {
      // Admin/HR: filter rentang waktu berdasarkan created_at
      if (dateFrom) {
        result = result.filter((t) =>
          parseISO(t.created_at) >= parseISO(dateFrom)
        );
      }
      if (dateTo) {
        result = result.filter((t) =>
          parseISO(t.created_at) <= new Date(`${dateTo}T23:59:59`)
        );
      }
    }

    if (isUnitLeader) {
      // Unit Leader: filter status + search judul / nama karyawan
      if (filterStatus !== "all") {
        result = result.filter((t) => t.status === filterStatus);
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        result = result.filter(
          (t) =>
            t.title?.toLowerCase().includes(q) ||
            t.employees?.name?.toLowerCase().includes(q)
        );
      }
    }

    return result;
  }, [tasks, isAdminOrHr, isUnitLeader, dateFrom, dateTo, filterStatus, search]);

  // ── CRUD handlers (unit_leader only) ───────────────────────────────────────

  const openCreate = () => { setDialogMode("create"); setEditingId(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit   = (t: any) => {
    setDialogMode("edit");
    setEditingId(t.id);
    setForm({ title: t.title ?? "", description: t.description ?? "", assigned_to: t.assigned_to ?? "", due_date: t.due_date ?? "" });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    try {
      if (dialogMode === "create") {
        const { error } = await supabase.from("tasks").insert({
          title: form.title, description: form.description || null,
          assigned_to: form.assigned_to, assigned_by: user.id, due_date: form.due_date || null,
        });
        if (error) throw error;
        toast.success("Tugas berhasil dibuat.");
      } else {
        const { error } = await supabase.from("tasks").update({
          title: form.title, description: form.description || null,
          assigned_to: form.assigned_to, due_date: form.due_date || null,
        }).eq("id", editingId!);
        if (error) throw error;
        toast.success("Tugas berhasil diperbarui.");
      }
      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan tugas.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTask) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", deletingTask.id);
      if (error) throw error;
      toast.success("Tugas berhasil dihapus.");
      setDeleteOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus tugas.");
    } finally {
      setIsDeleting(false);
      setDeletingTask(null);
    }
  };

  // ── Status update (unit_leader + employee) ──────────────────────────────────

  const updateStatus = async (taskId: string, newStatus: string, assignedUserId: string) => {
    const isOwner = user?.id === assignedUserId;
    if (!isUnitLeader) {
      if (!isOwner) { toast.error("Anda hanya bisa mengubah status tugas milik Anda."); return; }
      if (!["in_progress", "pending_review"].includes(newStatus)) {
        toast.error("Anda hanya bisa mengubah ke 'Dikerjakan' atau 'Ajukan Selesai'."); return;
      }
    }
    const { error } = await supabase.from("tasks").update({ status: newStatus as any }).eq("id", taskId);
    if (error) { toast.error("Gagal mengubah status."); return; }
    if (newStatus === "pending_review") toast.info("Tugas dikirim untuk dikonfirmasi.");
    else if (newStatus === "done")       toast.success("Tugas dikonfirmasi selesai! ✅");
    else if (newStatus === "in_progress") toast.warning("Tugas dikembalikan — belum selesai.");
    fetchData();
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const renderStatusBadge = (status: string) => {
    const cfg: Record<string, string> = {
      todo:           "text-slate-600 bg-slate-100 border-slate-200",
      in_progress:    "text-amber-600 bg-amber-50 border-amber-200",
      pending_review: "text-blue-600 bg-blue-50 border-blue-200",
      done:           "text-emerald-700 bg-emerald-50 border-emerald-200",
      cancelled:      "text-red-600 bg-red-50 border-red-200",
    };
    const label: Record<string, string> = {
      todo: "To Do", in_progress: "Dikerjakan", pending_review: "Menunggu Konfirmasi",
      done: "Selesai", cancelled: "Dibatalkan",
    };
    return (
      <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border rounded-md inline-flex items-center gap-1 ${cfg[status] ?? "text-slate-600 bg-slate-100 border-slate-200"}`}>
        {status === "pending_review" && <ClipboardCheck className="h-3 w-3" />}
        {label[status] ?? status}
      </span>
    );
  };

  const getStatusOptions = (task: any) => {
    const isOwner = user?.id === task.employees?.user_id;
    if (isUnitLeader) return (
      <>
        <SelectItem value="todo">To Do</SelectItem>
        <SelectItem value="in_progress">Dikerjakan</SelectItem>
        <SelectItem value="pending_review">Menunggu Konfirmasi</SelectItem>
        <SelectItem value="done">Selesai ✅</SelectItem>
        <SelectItem value="cancelled">Dibatalkan</SelectItem>
      </>
    );
    if (isOwner) return (
      <>
        <SelectItem value="in_progress">Dikerjakan</SelectItem>
        <SelectItem value="pending_review">Ajukan Selesai 📋</SelectItem>
      </>
    );
    return null;
  };

  const pendingCount = isUnitLeader
    ? tasks.filter((t) => t.status === "pending_review").length
    : 0;

  const colSpan = isAdminOrHr ? 6 : isUnitLeader ? 7 : 5;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      {/* ── Header ── */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-3">
            Tugas
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                <ClipboardCheck className="h-3.5 w-3.5" /> {pendingCount} menunggu konfirmasi
              </span>
            )}
          </h1>
          <p className="page-description">
            {isAdminOrHr
              ? "Monitoring semua tugas karyawan"
              : isUnitLeader
              ? "Kelola tugas anggota unit Anda"
              : "Tugas yang diberikan kepada Anda"}
          </p>
        </div>
        {/* Tombol Buat Tugas hanya untuk Unit Leader */}
        {isUnitLeader && (
          <Button size="sm" onClick={openCreate}
            className="gap-2 shadow-md shadow-primary/10 bg-primary hover:bg-primary/90 transition-all transform active:scale-95 font-medium">
            <Plus className="h-4 w-4" /> Buat Tugas
          </Button>
        )}
      </div>

      {/* ── Toolbar filter ── */}
      {(isAdminOrHr || isUnitLeader) && (
        <div className="flex flex-wrap gap-3 mb-4">
          {/* Admin/HR: rentang waktu */}
          {isAdminOrHr && (
            <>
              <div className="flex items-center gap-2">
                <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Dari</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 text-sm w-[145px] shadow-sm" />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Sampai</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 text-sm w-[145px] shadow-sm" />
              </div>
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground"
                  onClick={() => { setDateFrom(""); setDateTo(""); }}>
                  Reset
                </Button>
              )}
            </>
          )}

          {/* Unit Leader: search + filter status */}
          {isUnitLeader && (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Cari judul / nama karyawan..."
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  className="h-9 text-sm pl-8 w-[240px] shadow-sm" />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 text-sm w-[175px] shadow-sm">
                  <SelectValue placeholder="Semua status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">Dikerjakan</SelectItem>
                  <SelectItem value="pending_review">Menunggu Konfirmasi</SelectItem>
                  <SelectItem value="done">Selesai</SelectItem>
                  <SelectItem value="cancelled">Dibatalkan</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      )}

      {/* ── Tabel ── */}
      <div className="relative border rounded-md bg-white flex flex-col">
        <div className="overflow-x-auto">
          <Table className="w-full text-sm border-separate border-spacing-0 min-w-[680px]">
            <TableHeader>
              <TableRow className="h-10 border-b border-gray-200">
                <TableHead className="w-[50px] text-center font-semibold border-r border-gray-200 bg-muted">No.</TableHead>
                <TableHead className="font-semibold border-r border-gray-200 bg-muted">Judul</TableHead>
                <TableHead className="font-semibold border-r border-gray-200 bg-muted w-[140px]">Ditugaskan Ke</TableHead>
                {isAdminOrHr && <TableHead className="font-semibold border-r border-gray-200 bg-muted w-[100px]">Tgl Dibuat</TableHead>}
                <TableHead className="font-semibold border-r border-gray-200 bg-muted w-[95px]">Tenggat</TableHead>
                <TableHead className={`font-semibold bg-muted w-[175px] ${(isUnitLeader || (!isAdminOrHr && !isUnitLeader)) ? "border-r border-gray-200" : ""}`}>Status</TableHead>
                {isUnitLeader && <TableHead className="font-semibold border-r border-gray-200 bg-muted w-[165px]">Ubah Status</TableHead>}
                {isUnitLeader && <TableHead className="font-semibold bg-muted w-[80px] text-center">Aksi</TableHead>}
                {(!isAdminOrHr && !isUnitLeader) && <TableHead className="font-semibold bg-muted w-[165px]">Ubah Status</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={colSpan} className="text-center py-10 text-muted-foreground">Memuat...</TableCell></TableRow>
              ) : filteredTasks.length === 0 ? (
                <TableRow><TableCell colSpan={colSpan} className="text-center py-10 text-muted-foreground">Tidak ada tugas.</TableCell></TableRow>
              ) : (
                filteredTasks.map((t, index) => {
                  const isOwner          = user?.id === t.employees?.user_id;
                  const isPending        = t.status === "pending_review";
                  const isDone           = t.status === "done";
                  const isCancelled      = t.status === "cancelled";
                  const empCanChange     = isOwner && !isDone && !isCancelled;

                  return (
                    <TableRow key={t.id}
                      className={`hover:bg-muted/50 transition-colors h-11 border-b border-gray-200 ${isPending ? "bg-blue-50/40" : ""}`}>
                      <TableCell className="text-center text-slate-500 py-1.5">{index + 1}</TableCell>
                      <TableCell className="font-medium text-slate-900 py-1.5 max-w-[200px] truncate" title={t.title}>{t.title}</TableCell>
                      <TableCell className="text-slate-700 py-1.5">{t.employees?.name ?? "—"}</TableCell>
                      {isAdminOrHr && (
                        <TableCell className="text-slate-700 py-1.5 text-xs">
                          {t.created_at ? format(new Date(t.created_at), "dd/MM/yy") : "—"}
                        </TableCell>
                      )}
                      <TableCell className="text-slate-700 py-1.5">{t.due_date ? format(new Date(t.due_date), "dd/MM/yy") : "—"}</TableCell>
                      <TableCell className="py-1.5">{renderStatusBadge(t.status)}</TableCell>

                      {/* Unit Leader: dropdown ubah status */}
                      {isUnitLeader && (
                        <TableCell className="py-1.5">
                          <Select value={t.status} onValueChange={(v) => updateStatus(t.id, v, t.employees?.user_id)}>
                            <SelectTrigger className={`h-8 text-xs font-semibold shadow-sm w-[155px] ${isPending ? "border-blue-300 text-blue-700" : "border-slate-200"}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>{getStatusOptions(t)}</SelectContent>
                          </Select>
                        </TableCell>
                      )}

                      {/* Unit Leader: tombol edit & hapus */}
                      {isUnitLeader && (
                        <TableCell className="py-1.5 text-center">
                          <div className="flex justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => openEdit(t)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => { setDeletingTask(t); setDeleteOpen(true); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}

                      {/* Employee biasa: dropdown terbatas */}
                      {!isAdminOrHr && !isUnitLeader && (
                        <TableCell className="py-1.5">
                          {empCanChange ? (
                            <Select value={t.status} onValueChange={(v) => updateStatus(t.id, v, t.employees?.user_id)}>
                              <SelectTrigger className="h-8 text-xs font-semibold shadow-sm border-slate-200 w-[155px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>{getStatusOptions(t)}</SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs text-muted-foreground italic pl-1">
                              {isDone ? "Sudah selesai" : isCancelled ? "Dibatalkan" : isPending ? "Menunggu konfirmasi" : "—"}
                            </span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Dialog Create/Edit (Unit Leader only) ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[440px] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 border-b bg-muted/30">
            <DialogTitle className="text-xl font-bold tracking-tight">
              {dialogMode === "create" ? "Buat Tugas Baru" : "Edit Tugas"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground/90 font-bold">Judul Tugas</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-9 text-sm shadow-sm" required />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground/90 font-bold">Deskripsi</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="text-sm shadow-sm resize-none" rows={3} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground/90 font-bold">Ditugaskan Kepada</Label>
                <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                  <SelectTrigger className="h-9 text-sm shadow-sm"><SelectValue placeholder="Pilih karyawan" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground/90 font-bold">Tenggat Waktu</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="h-9 text-sm shadow-sm" />
              </div>
            </div>
            <div className="p-6 border-t bg-muted/30 flex justify-end gap-3">
              <Button type="button" variant="outline" className="min-w-[100px] h-10 text-sm" onClick={() => setDialogOpen(false)} disabled={isSaving}>Batal</Button>
              <Button type="submit" disabled={isSaving} className="min-w-[140px] h-10 shadow-md bg-primary hover:bg-primary/90 text-white text-sm font-bold px-6">
                {isSaving ? "Menyimpan..." : dialogMode === "create" ? "Simpan" : "Simpan Perubahan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Hapus ── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="shadow-2xl border-none p-0 overflow-hidden">
          <div className="p-6">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold">Hapus Tugas?</AlertDialogTitle>
              <AlertDialogDescription className="pt-2 text-slate-600 leading-relaxed">
                Tugas <strong className="text-slate-900">"{deletingTask?.title}"</strong> akan dihapus permanen.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="p-6 pt-0 gap-3 sm:gap-2">
            <AlertDialogCancel className="h-10 text-sm flex-1 sm:flex-none min-w-[100px] border-slate-200">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={isDeleting}
              className="h-10 text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold flex-1 sm:flex-none min-w-[120px]">
              {isDeleting ? "Menghapus..." : "Ya, Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
