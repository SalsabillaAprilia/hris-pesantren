import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { MonthPicker } from "@/components/ui/month-picker";
import { useAuth } from "@/hooks/useAuth";
import { useInstansiFilter } from "@/hooks/useInstansiFilter";
import { toast } from "sonner";
import { Plus, ClipboardCheck, Pencil, Trash2, Search, AlertCircle, CheckSquare, X as XIcon, Loader2, FileText, AlignLeft, User, Calendar, Flag, Target, Briefcase } from "lucide-react";
import { format, isWithinInterval, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { supabaseFetchWithTimeout } from "@/utils/supabase-fetch";
import { TASK_STATUS_MAP, TASK_PRIORITY_MAP, getTaskStatusBadgeClass, getTaskPriorityBadgeClass } from "@/utils/task-mapping";
import { DetailHeader, DetailSection, DetailItem } from "@/components/ui/detail-layout";

type TaskPriority = "Low" | "Medium" | "High";
interface ChecklistItem { title: string; is_done: boolean; }
const EMPTY_FORM = {
  title: "", description: "", assigned_to: "", due_date: "",
  priority: "Medium" as TaskPriority,
  checklists: [] as ChecklistItem[],
  kpi_indicator_id: "",
};

const tasksCache: Record<string, any[]> = {};
const tasksEmployeesCache: Record<string, any[]> = {};

export default function Tasks() {
  const { user, isAdminOrHr, isEmployee, hasRole, employee: currentUser } = useAuth();
  const { effectiveInstansiId } = useInstansiFilter();
  const isUnitLeader = hasRole("unit_leader");

  // Cache key unik per user & instansi — mencegah data bocor antar sesi/role
  const cacheKey = `${effectiveInstansiId ?? "global"}_${user?.id ?? "anon"}`;

  // ── Role flags ──────────────────────────────────────────────────────────────
  // Super Admin & HR  → monitoring only (read-only, date range filter)
  // Unit Leader       → full CRUD, filter/search, hanya unitnya
  // Employee          → hanya tugas sendiri, ubah status

  const [tasks,     setTasks]     = useState<any[]>(tasksCache[cacheKey] || []);
  const [employees, setEmployees] = useState<any[]>(tasksEmployeesCache[cacheKey] || []);
  const [loading,   setLoading]   = useState(!tasksCache[cacheKey]);
  const [isSaving,  setIsSaving]  = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const isFirstFetch = useRef(!tasksCache[cacheKey]);
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Create / Edit dialog (unit_leader only)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [checklistInput, setChecklistInput] = useState("");

  // View detail (untuk tracking checklist & baca deskripsi)
  const [viewOpen, setViewOpen] = useState(false);
  const [viewingTask, setViewingTask] = useState<any | null>(null);

  const [deleteOpen,   setDeleteOpen]   = useState(false);
  const [deletingTask, setDeletingTask] = useState<any | null>(null);
  const [isDeleting,   setIsDeleting]   = useState(false);

  // Revision dialog
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [managerNotes, setManagerNotes] = useState("");
  const [revisionTask, setRevisionTask] = useState<any | null>(null);

  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [quickFilter,  setQuickFilter]  = useState<"all" | "overdue" | "due_today">("all");
  
  // Tabs & Riwayat Filter
  const [activeTab, setActiveTab] = useState<"aktif" | "riwayat">("aktif");
  const [selectedMonth, setSelectedMonth] = useState<string>(
    format(new Date(), "yyyy-MM")
  );

  // Data pendukung form
  const [kpiIndicators,  setKpiIndicators]  = useState<any[]>([]);

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (isFirstFetch.current) setLoading(true);
    try {
      const [taskRes, kpiRes] = await supabaseFetchWithTimeout(
        Promise.all([
          (() => {
            let q = supabase
              .from("tasks")
              .select("*, employees!tasks_assigned_to_fkey!inner(name, user_id, unit_id, units!employees_unit_id_fkey(name)), kpi_indicators(name)");
            
            // 1. Instansi Filter
            if (effectiveInstansiId) q = (q as any).eq("instansi_id", effectiveInstansiId);
            
            // 2. Role Filter (Server-side)
            if (isUnitLeader && !isAdminOrHr && currentUser?.unit_id) {
              q = q.eq("employees.unit_id", currentUser.unit_id);
            } else if (!isAdminOrHr && !isUnitLeader && user?.id) {
              q = q.eq("employees.user_id", user.id);
            }

            // 3. Tab Filter (Aktif vs Riwayat)
            if (activeTab === "aktif") {
              q = q.in("status", ["todo", "in_progress", "pending_review", "revision"] as any[]);
            } else {
              q = q.in("status", ["done", "cancelled"]);
              // Filter Bulan untuk Riwayat (berdasarkan due_date atau created_at)
              if (selectedMonth) {
                const startOfMonth = `${selectedMonth}-01`;
                const [year, month] = selectedMonth.split("-");
                const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
                const endOfMonth = `${selectedMonth}-${lastDay}`;
                // Karena Tasks butuh monitoring ketat, kita filter berdasarkan created_at agar yang tak punya due_date tetap muncul
                q = q.gte("created_at", startOfMonth).lte("created_at", `${endOfMonth}T23:59:59`);
              }
            }

            return q.order("created_at", { ascending: false });
          })(),
          (() => {
            let q = supabase.from("kpi_indicators").select("id, name, kpi_templates!inner(id, name, instansi_id, is_active)").order("name");
            if (effectiveInstansiId) {
              q = q.or(`instansi_id.eq.${effectiveInstansiId},instansi_id.is.null`, { foreignTable: 'kpi_templates' });
            }
            q = q.not("kpi_templates.is_active", "eq", false);
            return q;
          })(),
        ])
      );
      if (taskRes.error) throw taskRes.error;

      // Ambil employee list untuk dropdown Form Create/Edit (hanya untuk Unit Leader)
      let allEmp: any[] = [];
      if (isUnitLeader && currentUser?.unit_id) {
        let empQ = supabase.from("employees").select("id, name, user_id, unit_id").eq("status", "active");
        if (effectiveInstansiId) empQ = empQ.eq("instansi_id", effectiveInstansiId);
        empQ = empQ.eq("unit_id", currentUser.unit_id).neq("user_id", user?.id);
        
        const empRes = await supabaseFetchWithTimeout(empQ);
        if (!empRes.error && empRes.data) {
          allEmp = empRes.data;
        }
      }
      
      const allTasks = taskRes.data ?? [];
      
      if (isMounted.current) {
        setTasks(allTasks);
        setEmployees(allEmp);
        setKpiIndicators(kpiRes.data ?? []);
        tasksCache[cacheKey] = allTasks;
        tasksEmployeesCache[cacheKey] = allEmp;
      }
    } catch (err: any) {
      console.error("Tasks: Fetch error", err);
      if (isMounted.current && err.code !== "PGRST116") toast.error("Gagal memuat data tugas.");
    } finally {
      if (isMounted.current) {
        setLoading(false);
        isFirstFetch.current = false;
      }
    }
  }, [effectiveInstansiId, user?.id, isUnitLeader, isAdminOrHr, isEmployee, currentUser?.unit_id, activeTab, selectedMonth]);

  useEffect(() => {
    fetchData();
    window.addEventListener('app_data_updated', fetchData);
    return () => window.removeEventListener('app_data_updated', fetchData);
  }, [fetchData]);

  // ── Filtered tasks (client-side) ────────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Filter Status (Tersedia untuk Admin/HR & Unit Leader)
    if (filterStatus !== "all") {
      result = result.filter((t) => t.status === filterStatus);
    }

    // Filter Pencarian (Hanya Judul Tugas)
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((t) =>
        t.title?.toLowerCase().includes(q)
      );
    }

    // Quick filter: Batas Waktu (Tersedia untuk semua selain Admin/HR)
    if (quickFilter !== "all") {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayStr = format(today, "yyyy-MM-dd");
      if (quickFilter === "overdue") {
        result = result.filter((t) =>
          t.due_date && new Date(t.due_date) < today && !["done", "cancelled"].includes(t.status)
        );
      } else if (quickFilter === "due_today") {
        result = result.filter((t) => t.due_date === todayStr);
      }
    }

    return result;
  }, [tasks, filterStatus, search, quickFilter]);

  // ── CRUD handlers (unit_leader only) ───────────────────────────────────────

  const openCreate = () => { setDialogMode("create"); setEditingId(null); setForm(EMPTY_FORM); setChecklistInput(""); setDialogOpen(true); };
  const openEdit   = (t: any) => {
    setDialogMode("edit");
    setEditingId(t.id);
    setForm({
      title: t.title ?? "", description: t.description ?? "",
      assigned_to: t.assigned_to ?? "", due_date: t.due_date ?? "",
      priority: t.priority ?? "Medium",
      checklists: Array.isArray(t.checklists) ? t.checklists : [],
      kpi_indicator_id: t.kpi_indicator_id ?? "",
    });
    setChecklistInput("");
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    // Fix Bug 4: strict — tolak jika instansi_id belum tersedia
    if (!effectiveInstansiId) {
      toast.error("Tidak dapat menyimpan tugas: cabang belum dipilih.");
      return;
    }
    setIsSaving(true);
    try {
      const payload: any = {
        title: form.title, description: form.description || null,
        assigned_to: form.assigned_to, due_date: form.due_date || null,
        priority: form.priority, checklists: form.checklists,
        kpi_indicator_id: form.kpi_indicator_id || null,
      };
      if (dialogMode === "create") {
        const { error } = await supabase.from("tasks").insert({
          ...payload, assigned_by: user.id, instansi_id: effectiveInstansiId,
        });
        if (error) throw error;
        toast.success("Tugas berhasil dibuat.");
      } else {
        const { error } = await supabase.from("tasks").update(payload).eq("id", editingId!);
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

  const toggleTaskChecklist = async (index: number) => {
    if (!viewingTask || !viewingTask.checklists) return;
    
    // Pastikan hanya owner yg bisa centang
    const isOwner = user?.id === viewingTask.employees?.user_id;
    if (!isOwner) {
      toast.error("Hanya karyawan yang ditugaskan yang dapat menceklis pekerjaan ini.");
      return;
    }

    const newChecklists = [...viewingTask.checklists];
    newChecklists[index].is_done = !newChecklists[index].is_done;
    
    const updatedTask = { ...viewingTask, checklists: newChecklists };
    setViewingTask(updatedTask); // Optimistic UI
    setTasks(prev => prev.map(t => t.id === viewingTask.id ? updatedTask : t));

    try {
      const { error } = await supabase.from("tasks")
        .update({ checklists: newChecklists } as any)
        .eq("id", viewingTask.id);
      if (error) throw error;
    } catch (err: any) {
      toast.error("Gagal menyimpan progres checklist.");
      // Rollback (opsional)
      fetchData();
    }
  };

  // ── Utils ────────────────────────────────────────────────────────────────────
  const addChecklistItem = () => {
    if (!checklistInput.trim()) return;
    setForm((f) => ({ ...f, checklists: [...f.checklists, { title: checklistInput.trim(), is_done: false }] }));
    setChecklistInput("");
  };
  const toggleChecklistItem = (i: number) =>
    setForm((f) => ({ ...f, checklists: f.checklists.map((item, idx) => idx === i ? { ...item, is_done: !item.is_done } : item) }));
  const removeChecklistItem = (i: number) =>
    setForm((f) => ({ ...f, checklists: f.checklists.filter((_, idx) => idx !== i) }));

  // ── Status update (unit_leader + employee) ──────────────────────────────────

  const updateStatus = async (taskId: string, newStatus: string, assignedUserId: string) => {
    if (newStatus === "revision") {
      const task = tasks.find((t) => t.id === taskId);
      setRevisionTask(task);
      setManagerNotes("");
      setRevisionDialogOpen(true);
      return;
    }

    const isOwner = user?.id === assignedUserId;
    if (!isUnitLeader) {
      if (!isOwner) { toast.error("Anda hanya bisa mengubah status tugas milik Anda."); return; }
      if (!["in_progress", "pending_review"].includes(newStatus)) {
        toast.error("Anda hanya bisa mengubah ke 'Dikerjakan' atau 'Ajukan Selesai'."); return;
      }
    }
    
    setUpdatingTaskId(taskId);
    try {
      const { error } = await supabase.from("tasks").update({ status: newStatus as any }).eq("id", taskId);
      if (error) { toast.error("Gagal mengubah status."); return; }
      
      if (newStatus === "pending_review") {
        toast.success("Tugas diajukan untuk direview.");
      } else if (newStatus === "done") {
        toast.success("Tugas diselesaikan! ✅");
      } else if (newStatus === "in_progress") {
        if (isOwner) toast.success("Status diubah menjadi Dikerjakan.");
        else toast.warning("Tugas dikembalikan untuk direvisi.");
      } else if (newStatus === "cancelled") {
        toast.success("Tugas dibatalkan.");
      }
      
      await fetchData();
    } catch (err) {
      toast.error("Terjadi kesalahan saat mengubah status.");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleSubmitRevision = async () => {
    if (!revisionTask) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("tasks").update({ 
        status: "revision" as any, 
        manager_notes: managerNotes 
      }).eq("id", revisionTask.id);
      
      if (error) throw error;
      toast.warning("Tugas dikembalikan untuk direvisi.");
      setRevisionDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Gagal mengembalikan tugas.");
    } finally {
      setIsSaving(false);
      setRevisionTask(null);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const renderSmartStatusBadge = (t: any) => {
    const isUpdating = updatingTaskId === t.id;
    const isOwner = user?.id === t.employees?.user_id;
    const isDone = t.status === "done";
    const isCancelled = t.status === "cancelled";
    
    let canEdit = false;
    if (isUnitLeader && !isDone && !isCancelled) canEdit = true;
    if (!isAdminOrHr && !isUnitLeader && isOwner && !isDone && !isCancelled) canEdit = true;

    const currentBadgeClass = getTaskStatusBadgeClass(t.status);
    const currentLabel = TASK_STATUS_MAP[t.status]?.label || t.status;
    
    if (isUpdating) {
      return (
        <span className={`${currentBadgeClass} opacity-70 cursor-wait flex items-center justify-center`}>
          <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
          Memperbarui...
        </span>
      );
    }
    
    if (!canEdit) {
      return (
        <span className={`${currentBadgeClass} inline-flex items-center justify-center ${!isOwner && !isAdminOrHr && !isUnitLeader ? 'opacity-80' : ''} cursor-not-allowed`} title="Read-only">
          {currentLabel}
        </span>
      );
    }

    return (
      <Select value={t.status} onValueChange={(v) => updateStatus(t.id, v, t.employees?.user_id)}>
        <SelectTrigger className="h-auto py-0 px-0 border-0 bg-transparent shadow-none hover:bg-transparent focus:ring-0 focus:ring-offset-0 w-auto inline-flex outline-none [&>svg]:hidden">
          <span className={`${currentBadgeClass} inline-flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-primary/40 transition-all active:scale-95`}>
            {currentLabel}
          </span>
        </SelectTrigger>
        <SelectContent>
          {getStatusOptions(t)}
        </SelectContent>
      </Select>
    );
  };

  const getStatusOptions = (task: any) => {
    const isOwner = user?.id === task.employees?.user_id;
    
    if (isAdminOrHr) return (
      <>
        <SelectItem value="in_progress">Sedang Dikerjakan</SelectItem>
        <SelectItem value="pending_review">Menunggu Review</SelectItem>
        <SelectItem value="done">Selesai</SelectItem>
        <SelectItem value="cancelled">Dibatalkan</SelectItem>
      </>
    );

    if (isOwner) return (
      <>
        {task.status === "pending_review" && <SelectItem value="in_progress">Batal Ajukan (Sedang Dikerjakan)</SelectItem>}
        {task.status !== "pending_review" && <SelectItem value="in_progress">Sedang Dikerjakan</SelectItem>}
        <SelectItem value="pending_review">Ajukan Selesai</SelectItem>
      </>
    );

    if (isUnitLeader) return (
      <>
        {task.status === "in_progress" && <SelectItem value="in_progress" disabled>Sedang Dikerjakan (Karyawan)</SelectItem>}
        {task.status === "pending_review" && <SelectItem value="pending_review" disabled>Menunggu Review</SelectItem>}
        {task.status === "pending_review" && <SelectItem value="revision">Kembalikan (Revisi)</SelectItem>}
        <SelectItem value="done">Disetujui Selesai</SelectItem>
        <SelectItem value="cancelled">Dibatalkan</SelectItem>
      </>
    );
    
    return null;
  };
  const renderPriorityBadge = (priority: string) => {
    const className = getTaskPriorityBadgeClass(priority);
    const label = TASK_PRIORITY_MAP[priority]?.label || priority;
    return (
      <span className={className}>
        {label}
      </span>
    );
  };

  const pendingCount = isUnitLeader ? tasks.filter((t) => t.status === "pending_review").length : 0;

  const overdueTasks = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return tasks.filter((t) => t.due_date && new Date(t.due_date) < today && !["done","cancelled"].includes(t.status)).length;
  }, [tasks]);
  const dueTodayTasks = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return tasks.filter((t) => t.due_date === todayStr).length;
  }, [tasks]);

  // No. + Judul + Priority + [Ditugaskan] + [Tgl Dibuat] + Tenggat + Status
  const colSpan = isAdminOrHr ? 7 : isUnitLeader ? 7 : 5;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-4">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Tugas</h1>
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Kiri: Search bar */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari judul tugas..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm shadow-sm border-primary/40 bg-white/50 transition-all" />
          </div>

          {/* Kanan: Dropdown Batas Waktu, Filter Status, & Rentang Waktu */}
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === "riwayat" && (
              <MonthPicker 
                value={selectedMonth} 
                onChange={setSelectedMonth} 
              />
            )}

            {/* Filter Batas Waktu */}
            {activeTab === "aktif" && (
              <Select value={quickFilter} onValueChange={(v: any) => setQuickFilter(v)}>
                <SelectTrigger className="h-9 text-sm w-[160px] bg-white/50 shadow-sm border-primary/20 font-medium transition-all hover:bg-accent hover:border-accent">
                  <SelectValue placeholder="Batas Waktu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Waktu</SelectItem>
                  <SelectItem value="overdue">
                    Terlambat {overdueTasks > 0 && `(${overdueTasks})`}
                  </SelectItem>
                  <SelectItem value="due_today">
                    Hari Ini {dueTodayTasks > 0 && `(${dueTodayTasks})`}
                  </SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Filter Status (Semua Role) */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 text-sm w-[150px] bg-white/50 shadow-sm border-primary/20 font-medium transition-all hover:bg-accent hover:border-accent">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                {activeTab === "aktif" ? (
                  <>
                    <SelectItem value="todo">Antrean</SelectItem>
                    <SelectItem value="in_progress">Dikerjakan</SelectItem>
                    <SelectItem value="revision">Direvisi</SelectItem>
                    <SelectItem value="pending_review">Menunggu</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="done">Selesai</SelectItem>
                    <SelectItem value="cancelled">Dibatalkan</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Tabs & Tabel ── */}
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
          <TabsList className="grid grid-cols-2 mb-3 bg-muted/50 h-9 rounded-lg">
            <TabsTrigger value="aktif" className="text-xs">Tugas Aktif</TabsTrigger>
            <TabsTrigger value="riwayat" className="text-xs">Riwayat Tugas</TabsTrigger>
          </TabsList>

          <div className="relative border rounded-md bg-white flex flex-col">
            <div className="overflow-x-auto">
              <Table className="w-full text-sm border-separate border-spacing-0 min-w-[800px]">
                <TableHeader className="bg-muted/50">
                  <TableRow className="h-11 border-none hover:bg-transparent text-muted-foreground">
                    <TableHead className="w-[50px] text-center font-semibold bg-transparent whitespace-nowrap px-4 align-middle">No.</TableHead>
                    <TableHead className="font-semibold bg-transparent text-left whitespace-nowrap px-4 align-middle">Judul Tugas</TableHead>
                    <TableHead className="font-semibold bg-transparent text-left whitespace-nowrap px-4 align-middle w-[90px]">Prioritas</TableHead>
                    {(isAdminOrHr || isUnitLeader) && <TableHead className="font-semibold bg-transparent text-left whitespace-nowrap px-4 align-middle w-[160px]">Ditugaskan Ke</TableHead>}
                    {isAdminOrHr && <TableHead className="font-semibold bg-transparent text-left whitespace-nowrap px-4 align-middle w-[120px]">Unit</TableHead>}
                    <TableHead className="font-semibold bg-transparent text-center whitespace-nowrap px-4 align-middle w-[110px]">Tanggal Dibuat</TableHead>
                    <TableHead className="font-semibold bg-transparent text-center whitespace-nowrap px-4 align-middle w-[110px]">Batas Waktu</TableHead>
                    <TableHead className="font-semibold bg-transparent text-center whitespace-nowrap px-4 align-middle w-[220px]">Status</TableHead>
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
                          onClick={() => { setViewingTask(t); setViewOpen(true); }}
                          className={`cursor-pointer hover:bg-muted/50 transition-colors h-11 group border-b border-gray-200 text-sm ${isPending ? "bg-blue-50/40" : ""}`}>
                          <TableCell className="text-center text-slate-500 py-1.5 px-4 align-middle">{index + 1}</TableCell>
                          <TableCell className="font-semibold text-slate-900 py-1.5 px-4 align-middle max-w-[200px] truncate" title="Lihat Detail & Checklist">
                            {t.title}
                          </TableCell>
                          <TableCell className="py-1.5 px-4 align-middle">{renderPriorityBadge(t.priority ?? "Medium")}</TableCell>
                          {(isAdminOrHr || isUnitLeader) && (
                            <TableCell className="text-slate-900 py-1.5 px-4 align-middle">{t.employees?.name ?? "—"}</TableCell>
                          )}
                          {isAdminOrHr && (
                            <TableCell className="text-slate-900 py-1.5 px-4 align-middle">{t.employees?.units?.name ?? "—"}</TableCell>
                          )}
                          <TableCell className="text-slate-900 py-1.5 px-4 align-middle text-center">
                            {t.created_at ? format(new Date(t.created_at), "dd/MM/yyyy") : "—"}
                          </TableCell>
                          <TableCell className="text-slate-900 py-1.5 px-4 align-middle text-center">{t.due_date ? format(new Date(t.due_date), "dd/MM/yyyy") : "—"}</TableCell>
                          <TableCell className="py-1.5 px-4 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                            {renderSmartStatusBadge(t)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </Tabs>
      </div>

      {/* ── Dialog Create/Edit (Unit Leader only) ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[750px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 border-b bg-muted/30">
            <DialogTitle className="text-xl font-bold tracking-tight">
              {dialogMode === "create" ? "Buat Tugas Baru" : "Edit Tugas"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-10">
              
              {/* ── Section 1: Detail Utama ── */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                  <div className="h-4 w-1 bg-primary rounded-full"></div>
                  Detail Utama
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3 border-l-2 border-muted/50 py-1">
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-sm text-muted-foreground/90 font-bold">Judul Tugas</Label>
                    <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-9 text-sm shadow-sm" required />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-sm text-muted-foreground/90 font-bold">Deskripsi</Label>
                    <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="text-sm shadow-sm resize-none" rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground/90 font-bold">Prioritas</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as TaskPriority })}>
                      <SelectTrigger className="h-9 text-sm shadow-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="High">🔴 Tinggi</SelectItem>
                        <SelectItem value="Medium">🟡 Sedang</SelectItem>
                        <SelectItem value="Low">⚪ Rendah</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground/90 font-bold">Tenggat Waktu</Label>
                    <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="h-9 text-sm shadow-sm" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-sm text-muted-foreground/90 font-bold">Ditugaskan Kepada</Label>
                    <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                      <SelectTrigger className="h-9 text-sm shadow-sm"><SelectValue placeholder="Pilih karyawan" /></SelectTrigger>
                      <SelectContent>
                        {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* ── Section 2: Kelengkapan Tugas ── */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                  <div className="h-4 w-1 bg-primary rounded-full"></div>
                  Kelengkapan Tugas
                </div>
                <div className="grid grid-cols-1 gap-4 pl-3 border-l-2 border-muted/50 py-1">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground/90 font-bold">
                      Tautkan ke KPI <span className="text-muted-foreground font-normal text-xs">(Opsional)</span>
                    </Label>
                    <Select value={form.kpi_indicator_id || "_none"} onValueChange={(v) => setForm({ ...form, kpi_indicator_id: v === "_none" ? "" : v })}>
                      <SelectTrigger className="h-9 text-sm shadow-sm"><SelectValue placeholder="Pilih indikator KPI..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— Tidak ditautkan —</SelectItem>
                        {Array.from(new Set(kpiIndicators.map((ind: any) => (ind.kpi_templates as any)?.name))).map(templateName => {
                          const indsInTemplate = kpiIndicators.filter((ind: any) => (ind.kpi_templates as any)?.name === templateName);
                          if (!templateName || indsInTemplate.length === 0) return null;
                          return (
                            <SelectGroup key={templateName as string}>
                              <SelectLabel className="bg-muted/30 font-bold text-primary">{templateName as string}</SelectLabel>
                              {indsInTemplate.map((ind: any) => (
                                <SelectItem key={ind.id} value={ind.id} className="pl-6">
                                  {ind.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 pt-2">
                    <Label className="text-sm text-muted-foreground/90 font-bold flex items-center gap-1.5">
                      <CheckSquare className="h-3.5 w-3.5 text-primary" /> Checklist Pekerjaan
                    </Label>
                    <div className="flex gap-2">
                      <Input placeholder="Tambah item checklist (lalu Enter)..." value={checklistInput}
                        onChange={(e) => setChecklistInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChecklistItem(); } }}
                        className="h-9 text-sm shadow-sm flex-1" />
                    </div>
                    {form.checklists.length > 0 && (
                      <div className="space-y-2 mt-3 pl-1 bg-muted/10 p-3.5 rounded-lg border border-slate-200">
                        {form.checklists.map((item, i) => (
                          <div key={i} className="flex items-center gap-2.5 group">
                            <input type="checkbox" checked={item.is_done} onChange={() => toggleChecklistItem(i)}
                              className="h-4 w-4 rounded border-slate-300 accent-primary cursor-pointer shadow-sm" />
                            <span className={`text-sm flex-1 font-medium transition-colors ${item.is_done ? "line-through text-muted-foreground" : "text-slate-700"}`}>{item.title}</span>
                            <button type="button" onClick={() => removeChecklistItem(i)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive/50 hover:text-destructive p-1 hover:bg-destructive/10 rounded">
                              <XIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t bg-muted/30 flex justify-end gap-3">
              <Button type="button" variant="outline" className="min-w-[140px] h-10 text-sm" onClick={() => setDialogOpen(false)} disabled={isSaving}>
                Batal
              </Button>
              <Button type="submit" disabled={isSaving} className="min-w-[140px] h-10 shadow-md bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all transform active:scale-95 px-6">
                {isSaving ? "Menyimpan..." : (dialogMode === "create" ? "Simpan Tugas" : "Simpan Perubahan")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        itemName={deletingTask?.title}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Hapus Tugas?"
      />

      {/* ── Dialog View Detail & Checklist ── */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
          {viewingTask && (
            <>
              <DetailHeader
                title="Detail Tugas"
                badge={
                  <span className={getTaskStatusBadgeClass(viewingTask.status)}>
                    {TASK_STATUS_MAP[viewingTask.status]?.label || viewingTask.status}
                  </span>
                }
                actions={
                  isUnitLeader && (
                    <>
                      {!["done", "cancelled"].includes(viewingTask.status) && (
                        <Button variant="outline" size="sm" onClick={() => { setViewOpen(false); openEdit(viewingTask); }} className="gap-1.5 font-semibold text-slate-700 hover:text-primary">
                          <Pencil className="h-3.5 w-3.5 text-slate-400" /> Edit Data
                        </Button>
                      )}
                      {viewingTask.status !== "done" && (
                        <Button variant="outline" size="sm" onClick={() => { setViewOpen(false); setDeletingTask(viewingTask); setDeleteOpen(true); }} className="gap-1.5 font-semibold bg-red-50 border-red-100 text-red-600 hover:bg-red-100 hover:text-red-700 hover:border-red-200 shadow-none">
                          <Trash2 className="h-3.5 w-3.5" /> Hapus
                        </Button>
                      )}
                    </>
                  )
                }
              />
              
              <div className="flex-1 p-6 space-y-10 overflow-y-auto custom-scrollbar">
                
                <DetailSection icon={FileText} title="Detail Utama">
                  <DetailItem label="Judul Tugas" value={viewingTask.title} className="md:col-span-2" />
                  <DetailItem 
                    label="Deskripsi Tugas" 
                    className="md:col-span-2"
                    value={
                      <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed bg-slate-50 p-4 rounded-md border border-slate-100 min-h-[60px]">
                        {viewingTask.description || <span className="text-muted-foreground italic font-normal">— Tidak ada deskripsi —</span>}
                      </div>
                    } 
                  />
                </DetailSection>

                <DetailSection icon={Briefcase} title="Informasi Penugasan">
                  <DetailItem label="Ditugaskan Kepada" value={viewingTask.employees?.name} />
                  <DetailItem label="Tenggat Waktu" value={viewingTask.due_date ? format(new Date(viewingTask.due_date), "dd MMMM yyyy", { locale: id }) : null} />
                  <DetailItem label="Prioritas" value={renderPriorityBadge(viewingTask.priority ?? "Medium")} />
                  <DetailItem 
                    label="Tautan KPI" 
                    value={
                      <span className="line-clamp-2" title={viewingTask.kpi_indicators?.name || "Tidak ditautkan"}>
                        {viewingTask.kpi_indicators?.name || <span className="text-muted-foreground italic font-normal text-slate-500">— Tidak ditautkan —</span>}
                      </span>
                    } 
                    isHighlight={!!viewingTask.kpi_indicators?.name}
                  />
                  {viewingTask.status === "revision" && viewingTask.manager_notes && (
                    <div className="col-span-1 md:col-span-2 mt-2">
                      <DetailItem 
                        label="Catatan Revisi dari Atasan" 
                        value={<span className="text-red-600 font-medium whitespace-pre-wrap">{viewingTask.manager_notes}</span>} 
                      />
                    </div>
                  )}
                </DetailSection>

                <div className="space-y-3">
                  <Label className="text-sm font-bold border-b pb-2 flex items-center gap-1.5">
                    <CheckSquare className="h-4 w-4 text-primary" /> Checklist Pekerjaan
                  </Label>
                  {viewingTask.checklists && viewingTask.checklists.length > 0 ? (
                    <div className="space-y-2">
                      {viewingTask.checklists.map((item: any, i: number) => {
                        const canToggle = user?.id === viewingTask.employees?.user_id;
                        return (
                          <div key={i} className="flex items-start justify-between gap-3 p-3 bg-slate-50 rounded border border-slate-100 group">
                            <div className="flex-1 flex items-start gap-3">
                              <Checkbox 
                                checked={item.is_done}
                                onCheckedChange={() => toggleTaskChecklist(i)}
                                disabled={!canToggle}
                                className={`mt-0.5 h-4 w-4 ${canToggle ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
                              />
                              <span className={`text-sm leading-snug transition-colors ${item.is_done ? "line-through text-muted-foreground" : "text-slate-800 font-medium"}`}>
                                {item.title}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                      Tidak ada checklist untuk tugas ini.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Revisi */}
      <Dialog open={revisionDialogOpen} onOpenChange={setRevisionDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 border-b bg-muted/30 shrink-0">
            <DialogTitle className="text-xl font-bold tracking-tight">Kembalikan untuk Revisi</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground/90 font-bold">Catatan untuk Karyawan</Label>
                <Textarea value={managerNotes} onChange={e => setManagerNotes(e.target.value)} placeholder="Bagian mana yang perlu diperbaiki?" className="min-h-[100px] text-sm text-slate-900 shadow-sm" required />
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 border-t bg-muted/30 shrink-0">
            <div className="flex justify-end gap-3 w-full">
              <Button type="button" variant="outline" className="min-w-[140px] h-10 text-sm font-medium" onClick={() => setRevisionDialogOpen(false)}>Batal</Button>
              <Button type="button" onClick={handleSubmitRevision} disabled={isSaving || !managerNotes.trim()} className="min-w-[140px] h-10 shadow-md bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all transform active:scale-95 px-6">Kirim Permintaan</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
