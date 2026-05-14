import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CalendarDays, Plus, Pencil, Trash2, CheckCircle2, XCircle, Search } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

const EMPTY_FORM = { date: format(new Date(), "yyyy-MM-dd"), time: format(new Date(), "HH:mm"), activity: "" };

export default function Agendas() {
  const { employee, user, isAdminOrHr, hasRole } = useAuth();
  const isUnitLeader = hasRole("unit_leader");

  // ── Role flags ──────────────────────────────────────────────────────────────
  // isAdminOrHr     → read-only, lihat semua agenda + filter
  // isUnitLeader    → CRUD sendiri + approve agenda unitnya + filter
  // employee biasa  → CRUD sendiri saja

  const [myAgendas,  setMyAgendas]  = useState<any[]>([]);
  const [allAgendas, setAllAgendas] = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [isSaving,   setIsSaving]   = useState(false);

  // Create / Edit
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [form,       setForm]       = useState(EMPTY_FORM);

  // Delete
  const [deleteOpen,    setDeleteOpen]    = useState(false);
  const [deletingItem,  setDeletingItem]  = useState<any | null>(null);
  const [isDeleting,    setIsDeleting]    = useState(false);

  // Filter (leader/admin)
  const [search,    setSearch]    = useState("");
  const [dateFrom,  setDateFrom]  = useState("");
  const [dateTo,    setDateTo]    = useState("");

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true);
    try {
      // Selalu fetch semua agenda (filter di render)
      const { data: allData, error: allErr } = await supabase
        .from("agendas")
        .select("*, employees(name, unit_id)")
        .order("date", { ascending: false })
        .order("time", { ascending: false });

      if (allErr) throw allErr;
      setAllAgendas(allData ?? []);

      // Fetch agenda pribadi jika ada employee record
      if (employee?.id) {
        const { data: myData, error: myErr } = await supabase
          .from("agendas")
          .select("*")
          .eq("employee_id", employee.id)
          .order("date", { ascending: false })
          .order("time", { ascending: false });
        if (myErr) throw myErr;
        setMyAgendas(myData ?? []);
      }
    } catch (err: any) {
      console.error("Agendas fetch error:", err);
      toast.error("Gagal memuat data agenda.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id]);

  // ── Filtered allAgendas (client-side) ────────────────────────────────────────

  const filteredAll = useMemo(() => {
    let result = [...allAgendas];

    // Unit leader hanya lihat agenda anggota unitnya
    if (isUnitLeader && !isAdminOrHr) {
      result = result.filter((a) => a.employees?.unit_id === employee?.unit_id);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((a) =>
        a.employees?.name?.toLowerCase().includes(q) ||
        a.activity?.toLowerCase().includes(q)
      );
    }
    if (dateFrom) result = result.filter((a) => a.date >= dateFrom);
    if (dateTo)   result = result.filter((a) => a.date <= dateTo);
    return result;
  }, [allAgendas, isUnitLeader, isAdminOrHr, employee?.unit_id, search, dateFrom, dateTo]);

  // ── CRUD (karyawan & unit leader untuk agenda sendiri) ───────────────────────

  const openCreate = () => { setDialogMode("create"); setEditingId(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit   = (item: any) => {
    setDialogMode("edit");
    setEditingId(item.id);
    setForm({ date: item.date, time: item.time.slice(0, 5), activity: item.activity });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setIsSaving(true);
    try {
      if (dialogMode === "create") {
        const { error } = await supabase.from("agendas").insert({
          employee_id: employee.id,
          date: form.date, time: form.time, activity: form.activity, status: "todo",
        });
        if (error) throw error;
        toast.success("Agenda berhasil ditambahkan!");
      } else {
        const { error } = await supabase.from("agendas").update({
          date: form.date, time: form.time, activity: form.activity,
        }).eq("id", editingId!);
        if (error) throw error;
        toast.success("Agenda berhasil diperbarui!");
      }
      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan agenda.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("agendas").delete().eq("id", deletingItem.id);
      if (error) throw error;
      toast.success("Agenda berhasil dihapus.");
      setDeleteOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus agenda.");
    } finally {
      setIsDeleting(false);
      setDeletingItem(null);
    }
  };

  const updateStatus = async (agendaId: string, status: string) => {
    const { error } = await supabase.from("agendas").update({ status: status as any }).eq("id", agendaId);
    if (error) { toast.error("Gagal mengubah status."); return; }
    fetchData();
  };

  // ── Approve / Unapprove (unit leader only) ───────────────────────────────────

  const handleApprove = async (agendaId: string, isApproved: boolean) => {
    const updates = isApproved
      ? { approved_by: null, approved_at: null }
      : { approved_by: user?.id, approved_at: new Date().toISOString() };

    const { error } = await supabase.from("agendas").update(updates as any).eq("id", agendaId);
    if (error) { toast.error("Gagal mengubah status persetujuan."); return; }
    toast.success(isApproved ? "Persetujuan dibatalkan." : "Agenda disetujui! ✅");
    fetchData();
  };

  // ── UI Helpers ───────────────────────────────────────────────────────────────

  const renderStatusBadge = (status: string) => {
    const cfg: Record<string, string> = {
      todo:        "text-slate-600 bg-slate-100 border-slate-200",
      on_progress: "text-amber-600 bg-amber-50 border-amber-200",
      done:        "text-emerald-700 bg-emerald-50 border-emerald-200",
      cancelled:   "text-red-600 bg-red-50 border-red-200",
    };
    const label: Record<string, string> = {
      todo: "To Do", on_progress: "On Progress", done: "Done", cancelled: "Cancelled",
    };
    return (
      <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border rounded-md ${cfg[status] ?? "text-slate-600 bg-slate-100 border-slate-200"}`}>
        {label[status] ?? status}
      </span>
    );
  };

  const renderApprovedBadge = (item: any) =>
    item.approved_by ? (
      <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md flex items-center gap-1 w-fit">
        <CheckCircle2 className="h-3 w-3" /> Disetujui
      </span>
    ) : (
      <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 border border-slate-200 rounded-md">
        Belum
      </span>
    );

  // ── Tabel Agenda Sendiri (karyawan & unit leader) ─────────────────────────────

  const renderMyTable = () => (
    <div className="relative border rounded-md bg-white flex flex-col">
      <div className="overflow-x-auto">
        <Table className="w-full text-sm border-separate border-spacing-0 min-w-[700px]">
          <TableHeader>
            <TableRow className="h-10 border-b border-gray-200">
              <TableHead className="w-[50px] text-center font-semibold border-r border-gray-200 bg-muted">No.</TableHead>
              <TableHead className="font-semibold border-r border-gray-200 bg-muted w-[110px]">Tanggal</TableHead>
              <TableHead className="font-semibold border-r border-gray-200 bg-muted w-[90px]">Hari</TableHead>
              <TableHead className="font-semibold border-r border-gray-200 bg-muted w-[70px]">Jam</TableHead>
              <TableHead className="font-semibold border-r border-gray-200 bg-muted">Aktivitas</TableHead>
              <TableHead className="font-semibold border-r border-gray-200 bg-muted w-[130px] text-center">Status</TableHead>
              <TableHead className="font-semibold border-r border-gray-200 bg-muted w-[110px] text-center">Persetujuan</TableHead>
              <TableHead className="font-semibold bg-muted w-[80px] text-center">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Memuat...</TableCell></TableRow>
            ) : myAgendas.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Belum ada agenda yang dicatat.</TableCell></TableRow>
            ) : (
              myAgendas.map((item, index) => {
                const dateObj = new Date(item.date + "T00:00:00");
                return (
                  <TableRow key={item.id} className="hover:bg-muted/50 transition-colors h-11 border-b border-gray-200">
                    <TableCell className="text-center text-slate-500 py-1.5">{index + 1}</TableCell>
                    <TableCell className="text-slate-900 py-1.5">{format(dateObj, "dd MMM yyyy", { locale: localeId })}</TableCell>
                    <TableCell className="text-slate-700 py-1.5 capitalize">{format(dateObj, "EEEE", { locale: localeId })}</TableCell>
                    <TableCell className="text-slate-900 py-1.5 font-medium">{item.time.slice(0, 5)}</TableCell>
                    <TableCell className="text-slate-900 py-1.5">{item.activity}</TableCell>
                    <TableCell className="text-center py-1.5">
                      <Select value={item.status} onValueChange={(v) => updateStatus(item.id, v)}>
                        <SelectTrigger className="h-8 text-xs font-semibold shadow-sm border-slate-200 w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">To Do</SelectItem>
                          <SelectItem value="on_progress">On Progress</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center py-1.5">{renderApprovedBadge(item)}</TableCell>
                    <TableCell className="text-center py-1.5">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => openEdit(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => { setDeletingItem(item); setDeleteOpen(true); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  // ── Tabel Semua Agenda (unit leader: approve; admin/HR: read-only) ─────────────

  const renderAllTable = () => (
    <div className="relative border rounded-md bg-white flex flex-col">
      <div className="overflow-x-auto">
        <Table className="w-full text-sm border-separate border-spacing-0 min-w-[780px]">
          <TableHeader>
            <TableRow className="h-10 border-b border-gray-200">
              <TableHead className="w-[50px] text-center font-semibold border-r border-gray-200 bg-muted">No.</TableHead>
              <TableHead className="font-semibold border-r border-gray-200 bg-muted w-[140px]">Karyawan</TableHead>
              <TableHead className="font-semibold border-r border-gray-200 bg-muted w-[110px]">Tanggal</TableHead>
              <TableHead className="font-semibold border-r border-gray-200 bg-muted w-[70px]">Jam</TableHead>
              <TableHead className="font-semibold border-r border-gray-200 bg-muted">Aktivitas</TableHead>
              <TableHead className="font-semibold border-r border-gray-200 bg-muted w-[110px] text-center">Status</TableHead>
              <TableHead className={`font-semibold bg-muted w-[130px] text-center ${isUnitLeader ? "border-r border-gray-200" : ""}`}>Persetujuan</TableHead>
              {isUnitLeader && <TableHead className="font-semibold bg-muted w-[90px] text-center">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={isUnitLeader ? 8 : 7} className="text-center py-10 text-muted-foreground">Memuat...</TableCell></TableRow>
            ) : filteredAll.length === 0 ? (
              <TableRow><TableCell colSpan={isUnitLeader ? 8 : 7} className="text-center py-10 text-muted-foreground">Tidak ada agenda ditemukan.</TableCell></TableRow>
            ) : (
              filteredAll.map((item, index) => {
                const isApproved = !!item.approved_by;
                const dateObj = new Date(item.date + "T00:00:00");
                return (
                  <TableRow key={item.id} className={`hover:bg-muted/50 transition-colors h-11 border-b border-gray-200 ${isApproved ? "bg-emerald-50/30" : ""}`}>
                    <TableCell className="text-center text-slate-500 py-1.5">{index + 1}</TableCell>
                    <TableCell className="font-medium text-slate-900 py-1.5">{item.employees?.name ?? "—"}</TableCell>
                    <TableCell className="text-slate-900 py-1.5">{format(dateObj, "dd MMM yyyy", { locale: localeId })}</TableCell>
                    <TableCell className="text-slate-900 py-1.5 font-medium">{item.time.slice(0, 5)}</TableCell>
                    <TableCell className="text-slate-900 py-1.5 max-w-[200px] truncate" title={item.activity}>{item.activity}</TableCell>
                    <TableCell className="text-center py-1.5">{renderStatusBadge(item.status)}</TableCell>
                    <TableCell className="text-center py-1.5">{renderApprovedBadge(item)}</TableCell>
                    {isUnitLeader && (
                      <TableCell className="text-center py-1.5">
                        <Button
                          variant="ghost" size="sm"
                          className={`h-8 px-2 text-xs font-semibold gap-1 ${isApproved ? "text-slate-500 hover:bg-slate-100" : "text-emerald-700 hover:bg-emerald-50"}`}
                          onClick={() => handleApprove(item.id, isApproved)}
                        >
                          {isApproved
                            ? <><XCircle className="h-3.5 w-3.5" /> Batal</>
                            : <><CheckCircle2 className="h-3.5 w-3.5" /> Setujui</>}
                        </Button>
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
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  const showMonitorView = isAdminOrHr || isUnitLeader;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="page-header flex gap-4 flex-col sm:flex-row items-start sm:items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Agenda
          </h1>
        </div>
        {/* Tombol tambah: semua kecuali admin/HR murni */}
        {(!isAdminOrHr || isUnitLeader) && (
          <Button size="sm" onClick={openCreate} className="gap-2 shadow-md shadow-primary/10 bg-primary hover:bg-primary/90 transition-all transform active:scale-95 font-medium">
            <Plus className="h-4 w-4" /> Tambah Agenda
          </Button>
        )}
      </div>

      {/* ── Bagian Agenda Sendiri (karyawan & unit leader) ── */}
      {(!isAdminOrHr || isUnitLeader) && (
        <div className="mb-8">
          {isUnitLeader && (
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Agenda Saya</h2>
          )}
          {renderMyTable()}
        </div>
      )}

      {/* ── Bagian Monitor (unit leader + admin/HR) ── */}
      {showMonitorView && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
              {isUnitLeader ? "Agenda Anggota Unit" : "Semua Agenda Karyawan"}
            </h2>
            {/* Filter toolbar */}
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Cari nama / aktivitas..."
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  className="h-9 text-sm pl-8 w-[220px] shadow-sm" />
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Dari</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 text-sm w-[135px] shadow-sm" />
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">S.d.</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 text-sm w-[135px] shadow-sm" />
              </div>
              {(search || dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground"
                  onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }}>
                  Reset
                </Button>
              )}
            </div>
          </div>
          {renderAllTable()}
        </div>
      )}

      {/* ── Dialog Create/Edit ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[440px] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 border-b bg-muted/30">
            <DialogTitle className="text-xl font-bold tracking-tight">
              {dialogMode === "create" ? "Agenda Baru" : "Edit Agenda"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground/90 font-bold">Tanggal</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-9 text-sm shadow-sm" required />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground/90 font-bold">Waktu / Jam</Label>
                <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="h-9 text-sm shadow-sm" required />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground/90 font-bold">Aktivitas / Agenda</Label>
                <Input placeholder="Contoh: Rapat evaluasi kurikulum" value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })} className="h-9 text-sm shadow-sm" required />
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
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        itemName={deletingItem?.activity}
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </DashboardLayout>
  );
}
