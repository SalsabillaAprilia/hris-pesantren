import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthPicker } from "@/components/ui/month-picker";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { DetailHeader, DetailSection, DetailItem } from "@/components/ui/detail-layout";
import { useAuth } from "@/hooks/useAuth";
import { useInstansiFilter } from "@/hooks/useInstansiFilter";
import { useTerminology } from "@/hooks/useTerminology";
import { toast } from "sonner";
import { CalendarDays, Plus, Pencil, Trash2, Search, Send, AlertCircle, CheckCircle, XCircle, ClipboardCheck, ListTodo, Filter, FileSpreadsheet, Crown, User } from "lucide-react";
import { format, startOfWeek, endOfWeek, addDays } from "date-fns";
import { id as localeId } from "date-fns/locale";

const EMPTY_ITEM = { date: format(new Date(), "yyyy-MM-dd"), activities: [{ activity: "", hours: 0, minutes: 30 }] };

export default function Agendas() {
  const { employee, user, isAdminOrHr, hasRole } = useAuth();
  const { effectiveInstansiId } = useInstansiFilter();
  const { term } = useTerminology();
  const isUnitLeader = hasRole("unit_leader");

  const [myReport, setMyReport] = useState<any | null>(null);
  const [myItems, setMyItems] = useState<any[]>([]);
  const [allReports, setAllReports] = useState<any[]>([]);
  const [userRolesMap, setUserRolesMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  // Form State (Item)
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemMode, setItemMode] = useState<"create" | "edit">("create");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<any>(EMPTY_ITEM);
  
  // Revision State
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [revisingReportId, setRevisingReportId] = useState<string | null>(null);
  const [managerNotes, setManagerNotes] = useState("");

  // View Report State
  const [viewReportOpen, setViewReportOpen] = useState(false);
  const [viewingReport, setViewingReport] = useState<any | null>(null);

  const [deletingItem, setDeletingItem] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterUnit, setFilterUnit] = useState("all");
  const [unitsList, setUnitsList] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));
  const [approversMap, setApproversMap] = useState<Record<string, string>>({});
  
  const [activeTab, setActiveTab] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || "saya";
  });
  const [myHistoryReports, setMyHistoryReports] = useState<any[]>([]);
  
  const currentStartOfWeek = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const currentEndOfWeek = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const showMySection = (!isAdminOrHr || isUnitLeader) && employee;
  const showMonitorSection = isAdminOrHr || isUnitLeader;

  useEffect(() => {
    if (!showMySection && showMonitorSection) setActiveTab("tim");
  }, [showMySection, showMonitorSection]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all employees to map user_id -> name for approvers
      const { data: approversData } = await (supabase as any).from("employees").select("user_id, name");
      if (approversData) {
        const aMap: Record<string, string> = {};
        approversData.forEach((a: any) => {
          if (a.user_id) aMap[a.user_id] = a.name;
        });
        setApproversMap(aMap);
      }

      // 1. Fetch My Report for current week
      if (employee?.id && (!isAdminOrHr || isUnitLeader)) {
        let { data: reportData, error: reportErr } = await supabase
          .from("agenda_reports")
          .select("*")
          .eq("employee_id", employee.id)
          .eq("start_date", currentStartOfWeek)
          .maybeSingle();

        if (reportErr && reportErr.code !== "PGRST116") throw reportErr;

        if (!reportData) {
          // Auto create draft report
          const { data: newReport, error: insertErr } = await supabase
            .from("agenda_reports")
            .insert({
              employee_id: employee.id,
              instansi_id: employee.instansi_id,
              start_date: currentStartOfWeek,
              end_date: currentEndOfWeek,
              status: "DRAFT"
            })
            .select()
            .single();
          
          if (insertErr) throw insertErr;
          reportData = newReport;
        }
        
        setMyReport(reportData);

        if (reportData) {
          // Fetch items for current week report
          const { data: itemsData, error: itemsErr } = await supabase
            .from("agenda_items")
            .select("*")
            .eq("report_id", reportData.id)
            .order("date", { ascending: false });
          if (itemsErr) throw itemsErr;
          setMyItems(itemsData || []);
        }

        // Fetch My History Reports for the selected month
        if (selectedMonth) {
          const startOfMonth = `${selectedMonth}-01`;
          const [year, month] = selectedMonth.split("-");
          const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
          const endOfMonth = `${selectedMonth}-${lastDay}`;
          
          const { data: histData, error: histErr } = await supabase
            .from("agenda_reports")
            .select("*, employees(name, user_id, unit_id, units!employees_unit_id_fkey(name)), agenda_items(*)")
            .eq("employee_id", employee.id)
            .gte("start_date", startOfMonth)
            .lte("start_date", endOfMonth)
            .order("start_date", { ascending: false });
            
          if (!histErr) {
            setMyHistoryReports(histData || []);
          }
        }
      }

      // 2. Fetch All Reports (for Admin/HR or Unit Leader)
      if (isAdminOrHr || isUnitLeader) {
        if (isAdminOrHr) {
          let uq = (supabase as any).from("units").select("id, name, leader_id").eq("is_active", true).order("name");
          if (effectiveInstansiId) uq = uq.eq("instansi_id", effectiveInstansiId);
          const { data: uData } = await uq;
          if (uData) setUnitsList(uData);
        }

        // Fetch user roles to map employees accurately without causing N+1 join errors
        const { data: rolesData } = await (supabase as any).from("user_roles").select("user_id, role");
        const rMap: Record<string, string[]> = {};
        if (rolesData) {
          rolesData.forEach((row: any) => {
            if (!rMap[row.user_id]) rMap[row.user_id] = [];
            rMap[row.user_id].push(row.role);
          });
        }
        setUserRolesMap(rMap);

        let q = (supabase as any)
          .from("agenda_reports")
          .select("*, employees(name, user_id, unit_id, units!employees_unit_id_fkey(name)), agenda_items(*)")
          .order("start_date", { ascending: false });
          
        if (effectiveInstansiId) {
          q = (q as any).eq("instansi_id", effectiveInstansiId);
        }

        if (selectedMonth) {
          const startOfMonth = `${selectedMonth}-01`;
          const [year, month] = selectedMonth.split("-");
          const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
          const endOfMonth = `${selectedMonth}-${lastDay}`;
          q = q.gte("start_date", startOfMonth).lte("start_date", endOfMonth);
        }

        const { data: allData, error: allErr } = await q;
        if (allErr) throw allErr;
        
        let finalReports: any[] = allData ? [...allData] : [];

        // Fetch employees to generate "UNCREATED" synthetic reports
        let empQ = (supabase as any).from("employees").select("id, name, user_id, unit_id, units!employees_unit_id_fkey(name)").eq("status", "active");
        if (effectiveInstansiId) {
          empQ = empQ.eq("instansi_id", effectiveInstansiId);
        }
        const { data: empData } = await empQ;

        if (empData && currentStartOfWeek.startsWith(selectedMonth)) {
          const currentWeekReports = finalReports.filter(r => r.start_date === currentStartOfWeek);
          empData.forEach(emp => {
            const hasReport = currentWeekReports.some(r => r.employee_id === emp.id);
            if (!hasReport) {
              finalReports.push({
                id: `dummy-${emp.id}`,
                employee_id: emp.id,
                start_date: currentStartOfWeek,
                end_date: currentEndOfWeek,
                status: "UNCREATED",
                employees: { name: emp.name, user_id: emp.user_id, unit_id: emp.unit_id, units: (emp as any).units },
                agenda_items: []
              });
            }
          });
        }
        
        // Sort by start_date DESC, then by name ASC
        finalReports.sort((a, b) => {
          if (a.start_date > b.start_date) return -1;
          if (a.start_date < b.start_date) return 1;
          return (a.employees?.name || "").localeCompare(b.employees?.name || "");
        });

        setAllReports(finalReports);
      }
    } catch (err: any) {
      console.error("Fetch agendas error:", err);
      toast.error("Gagal memuat data agenda.");
    } finally {
      setLoading(false);
    }
  }, [employee, isAdminOrHr, isUnitLeader, effectiveInstansiId, currentStartOfWeek, currentEndOfWeek, selectedMonth]);

  useEffect(() => {
    fetchData();
    window.addEventListener('app_data_updated', fetchData);
    return () => window.removeEventListener('app_data_updated', fetchData);
  }, [fetchData]);

  const filteredReports = useMemo(() => {
    let result = [...allReports];
    
    // Secara eksplisit menyaring direktur, admin, dan HR agar tidak masuk ke tabel pantauan
    result = result.filter(r => {
      const uId = r.employees?.user_id;
      if (!uId) return true; // Jika tidak ada user_id, biarkan tampil
      const rls = userRolesMap[uId] || [];
      // Jika mereka punya role admin/hr/director, kecualikan dari tabel ini
      if (rls.includes("super_admin") || rls.includes("hr") || rls.includes("director")) {
        return false;
      }
      return true;
    });

    if (isUnitLeader && !isAdminOrHr && employee?.unit_id) {
      // Unit Leader melihat anggota timnya, mengecualikan dirinya sendiri
      result = result.filter(r => r.employees?.unit_id === employee.unit_id && r.employee_id !== employee.id);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r => r.employees?.name?.toLowerCase().includes(q));
    }

    if (filterStatus !== "all") {
      result = result.filter(r => r.status === filterStatus);
    }
    
    if (isAdminOrHr && filterUnit !== "all") {
      result = result.filter(r => r.employees?.unit_id === filterUnit);
    }
    
    // Smart Sort: Uncreated/Draft at the top, then by name
    result.sort((a, b) => {
      const aNeedsAction = a.status === "UNCREATED" || a.status === "DRAFT" || a.status === "REVISION_REQUESTED";
      const bNeedsAction = b.status === "UNCREATED" || b.status === "DRAFT" || b.status === "REVISION_REQUESTED";
      if (aNeedsAction && !bNeedsAction) return -1;
      if (!aNeedsAction && bNeedsAction) return 1;
      return (a.employees?.name || "").localeCompare(b.employees?.name || "");
    });

    return result;
  }, [allReports, search, filterStatus, filterUnit, isUnitLeader, isAdminOrHr, employee?.unit_id, userRolesMap]);

  // Derived Metrics
  const metrics = useMemo(() => {
    const total = filteredReports.length;
    const approved = filteredReports.filter(r => r.status === "APPROVED").length;
    const submitted = filteredReports.filter(r => r.status === "SUBMITTED").length;
    const incomplete = total - approved - submitted;
    return { total, approved, submitted, incomplete };
  }, [filteredReports]);

  // ── Employee Actions ────────────────────────────────────────────────────────
  
  const canEditItems = myReport && (myReport.status === "DRAFT" || myReport.status === "REVISION_REQUESTED");

  const openCreateItem = () => {
    setItemMode("create");
    setEditingItemId(null);
    setItemForm({ date: format(new Date(), "yyyy-MM-dd"), activities: [{ activity: "", hours: 0, minutes: 30 }] });
    setItemDialogOpen(true);
  };

  const openEditItem = (item: any) => {
    setItemMode("edit");
    setEditingItemId(item.id);
    const h = Math.floor((item.duration_minutes || 0) / 60);
    const m = (item.duration_minutes || 0) % 60;
    setItemForm({ date: item.date, activities: [{ activity: item.activity, hours: h, minutes: m }] });
    setItemDialogOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myReport) return;
    
    // Validasi
    for (const act of itemForm.activities) {
      if (!act.activity.trim()) {
        toast.error("Nama kegiatan tidak boleh kosong.");
        return;
      }
      const totalMins = (act.hours || 0) * 60 + (act.minutes || 0);
      if (totalMins <= 0) {
        toast.error("Durasi kegiatan harus lebih dari 0 menit.");
        return;
      }
    }

    setIsSaving(true);
    try {
      if (itemMode === "create") {
        const payloads = itemForm.activities.map((act: any) => ({
          report_id: myReport.id,
          date: itemForm.date,
          duration_minutes: (act.hours || 0) * 60 + (act.minutes || 0),
          activity: act.activity
        }));
        const { error } = await supabase.from("agenda_items").insert(payloads);
        if (error) throw error;
        toast.success(`${payloads.length} kegiatan ditambahkan.`);
      } else {
        const act = itemForm.activities[0];
        const payload = {
          report_id: myReport.id,
          date: itemForm.date,
          duration_minutes: (act.hours || 0) * 60 + (act.minutes || 0),
          activity: act.activity
        };
        const { error } = await supabase.from("agenda_items").update(payload).eq("id", editingItemId!);
        if (error) throw error;
        toast.success("Kegiatan diperbarui.");
      }
      setItemDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan kegiatan.");
    } finally {
      setIsSaving(false);
    }
  };

  const addActivityField = () => {
    setItemForm((prev: any) => ({ ...prev, activities: [...prev.activities, { activity: "", hours: 0, minutes: 30 }] }));
  };
  const removeActivityField = (index: number) => {
    setItemForm((prev: any) => ({ ...prev, activities: prev.activities.filter((_: any, i: number) => i !== index) }));
  };
  const updateActivityField = (index: number, field: string, value: any) => {
    setItemForm((prev: any) => ({
      ...prev,
      activities: prev.activities.map((act: any, i: number) => i === index ? { ...act, [field]: value } : act)
    }));
  };

  const handleDeleteItem = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("agenda_items").delete().eq("id", deletingItem.id);
      if (error) throw error;
      toast.success("Kegiatan dihapus.");
      setDeletingItem(null);
      fetchData();
    } catch (err: any) {
      toast.error("Gagal menghapus kegiatan.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmitReport = async () => {
    if (!myReport || myItems.length === 0) {
      toast.error("Laporan masih kosong.");
      return;
    }
    try {
      const isAutoApprove = isUnitLeader;
      const payload: any = { status: isAutoApprove ? "APPROVED" : "SUBMITTED" };
      
      if (isAutoApprove) {
        payload.approved_by = user?.id;
        payload.approved_at = new Date().toISOString();
      }

      const { error } = await supabase.from("agenda_reports").update(payload).eq("id", myReport.id);
      if (error) throw error;
      
      toast.success(isAutoApprove ? "Laporan berhasil disubmit dan disetujui otomatis!" : "Laporan pekanan berhasil dikirim!");
      fetchData();
    } catch (err: any) {
      toast.error("Gagal mengirim laporan.");
    }
  };

  // ── Leader Actions ────────────────────────────────────────────────────────
  
  const openViewReport = (report: any) => {
    setViewingReport(report);
    setViewReportOpen(true);
  };

  const handleApproveReport = async (reportId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const { error } = await supabase.from("agenda_reports").update({
        status: "APPROVED",
        approved_by: user?.id,
        approved_at: new Date().toISOString()
      }).eq("id", reportId);
      if (error) throw error;
      toast.success("Laporan disetujui.");
      fetchData();
    } catch (err: any) {
      toast.error("Gagal menyetujui laporan.");
    }
  };

  const openRevisionDialog = (reportId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRevisingReportId(reportId);
    setManagerNotes("");
    setRevisionDialogOpen(true);
  };

  const handleSubmitRevision = async () => {
    if (!revisingReportId || !managerNotes.trim()) {
      toast.error("Catatan revisi wajib diisi.");
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from("agenda_reports").update({
        status: "REVISION_REQUESTED",
        manager_notes: managerNotes,
        approved_by: null,
        approved_at: null
      }).eq("id", revisingReportId);
      if (error) throw error;
      toast.success("Permintaan revisi dikirim.");
      setRevisionDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error("Gagal mengirim permintaan revisi.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── UI Helpers ────────────────────────────────────────────────────────────

  const renderStatusBadge = (status: string) => {
    const cfg: Record<string, string> = {
      UNCREATED: "text-slate-500 bg-slate-100 border-slate-200",
      DRAFT: "text-[hsl(232,59%,21%)] bg-[hsl(232,59%,96%)] border-[hsl(232,59%,90%)]",
      SUBMITTED: "text-[hsl(38,55%,30%)] bg-[hsl(38,55%,94%)] border-[hsl(38,55%,88%)]",
      REVISION_REQUESTED: "text-[hsl(0,55%,35%)] bg-[hsl(0,55%,96%)] border-[hsl(0,55%,90%)]",
      APPROVED: "text-[hsl(142,45%,25%)] bg-[hsl(142,45%,96%)] border-[hsl(142,45%,90%)]",
    };
    const label: Record<string, string> = {
      UNCREATED: "Belum Ada", 
      DRAFT: "Disusun", 
      SUBMITTED: "Menunggu", 
      REVISION_REQUESTED: "Direvisi", 
      APPROVED: "Disetujui"
    };
    return (
      <span className={`px-2 py-0.5 text-[11px] font-semibold rounded border whitespace-nowrap ${cfg[status]}`}>
        {label[status] ?? status}
      </span>
    );
  };

  const totalMinutes = (items: any[]) => items.reduce((acc, item) => acc + (item.duration_minutes || 0), 0);
  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} menit`;
    if (m === 0) return `${h} jam`;
    return `${h} jam ${m} menit`;
  };

  const renderMySection = () => (
    <div className="space-y-4">
      {myReport?.status === "APPROVED" && (
        <div className="flex items-start gap-3 p-4 bg-[hsl(142,45%,96%)] border border-[hsl(142,45%,90%)] text-[hsl(142,45%,25%)] rounded-lg shadow-sm">
          <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <h5 className="font-bold text-sm">Kerja bagus!</h5>
            <p className="text-sm opacity-90">
              {isUnitLeader 
                ? `Agenda pekanan Anda berhasil disimpan. Formulir kosong untuk pekan selanjutnya akan otomatis terbuka pada Senin, ${format(addDays(new Date(currentStartOfWeek), 7), "dd MMMM yyyy", { locale: localeId })}.`
                : `Agenda pekanan Anda telah disetujui oleh atasan. Formulir kosong untuk pekan selanjutnya akan otomatis terbuka pada Senin, ${format(addDays(new Date(currentStartOfWeek), 7), "dd MMMM yyyy", { locale: localeId })}.`}
            </p>
          </div>
        </div>
      )}

      {myReport?.status === "REVISION_REQUESTED" && myReport.manager_notes && (
        <div className="flex items-start gap-3 p-4 bg-[hsl(0,55%,96%)] border border-[hsl(0,55%,90%)] rounded-lg text-[hsl(0,55%,35%)] shadow-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <h5 className="font-bold text-sm">Catatan Revisi dari Atasan</h5>
            <p className="text-sm opacity-90">{myReport.manager_notes}</p>
          </div>
        </div>
      )}

      <div className="relative border rounded-md bg-white flex flex-col shadow-sm">
        <div className="overflow-x-auto overflow-y-visible flex-1 h-auto relative">
          <Table className="w-full caption-bottom text-sm relative border-separate border-spacing-0 min-w-[700px]">
            <TableHeader className="z-20 transition-none [&_th]:sticky [&_th]:top-0 [&_th:not(.sticky)]:z-30 [&_th:not(.sticky)]:bg-muted">
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className="w-[50px] text-center font-semibold bg-muted whitespace-nowrap">No.</TableHead>
                <TableHead className="w-[180px] font-semibold text-left bg-muted whitespace-nowrap">Tanggal</TableHead>
                <TableHead className="w-[160px] font-semibold text-left bg-muted whitespace-nowrap">Durasi</TableHead>
                <TableHead className="font-semibold text-left bg-muted whitespace-nowrap">Kegiatan</TableHead>
                {canEditItems && <TableHead className="w-[100px] bg-muted" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Memuat...</TableCell></TableRow>
              ) : myItems.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Belum ada kegiatan minggu ini.</TableCell></TableRow>
              ) : (
                myItems.map((item, idx) => (
                  <TableRow key={item.id} className="hover:bg-muted/50 transition-colors h-11 border-b border-gray-200 text-sm group">
                    <TableCell className="text-center text-slate-900 py-1.5">{idx + 1}</TableCell>
                    <TableCell className="text-left text-slate-900 py-1.5 whitespace-nowrap">{format(new Date(item.date), "dd MMMM yyyy", { locale: localeId })}</TableCell>
                    <TableCell className="text-left text-slate-900 font-medium py-1.5 whitespace-nowrap">{formatDuration(item.duration_minutes)}</TableCell>
                    <TableCell className="text-slate-900 py-1.5">{item.activity}</TableCell>
                    {canEditItems && (
                      <TableCell className="text-right py-1.5 whitespace-nowrap">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/10 transition-all transform active:scale-95" onClick={() => openEditItem(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all transform active:scale-95" onClick={() => setDeletingItem(item)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="p-3 bg-muted/30 border-t flex justify-between items-center text-sm font-semibold rounded-b-md">
          <div className="flex items-center gap-2 text-slate-700">
            Status: {myReport ? renderStatusBadge(myReport.status) : "-"}
          </div>
          <div className="text-[hsl(232,59%,21%)] bg-[hsl(232,59%,96%)] px-3 py-1 rounded-md border border-[hsl(232,59%,90%)]">
            Total Durasi: {formatDuration(totalMinutes(myItems))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderMyHistorySection = () => (
    <div className="space-y-4">
      {/* Table Container */}
      <div className="relative border rounded-md bg-white flex flex-col shadow-sm">
        <div className="overflow-x-auto overflow-y-visible flex-1 h-auto relative">
          <Table className="w-full caption-bottom text-sm relative border-separate border-spacing-0 min-w-[500px]">
            <TableHeader className="z-20 transition-none [&_th]:sticky [&_th]:top-0 [&_th:not(.sticky)]:z-30 [&_th:not(.sticky)]:bg-muted">
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className="w-[50px] text-center font-semibold bg-muted whitespace-nowrap">No.</TableHead>
                <TableHead className="w-full font-semibold text-left bg-muted whitespace-nowrap">Periode Laporan</TableHead>
                <TableHead className="w-[160px] font-semibold text-left bg-muted whitespace-nowrap">Total Durasi</TableHead>
                <TableHead className="w-[150px] font-semibold text-center bg-muted whitespace-nowrap">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Memuat riwayat...</TableCell></TableRow>
              ) : myHistoryReports.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Tidak ada riwayat agenda di bulan ini.</TableCell></TableRow>
              ) : (
                myHistoryReports.map((r, idx) => (
                  <TableRow 
                    key={r.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors h-11 border-b border-gray-200 text-sm"
                    onClick={() => openViewReport(r)}
                  >
                    <TableCell className="text-center text-slate-900 py-1.5">{idx + 1}</TableCell>
                    <TableCell className="text-slate-900 py-1.5 whitespace-nowrap">
                      {format(new Date(r.start_date), "dd MMMM", { locale: localeId })} - {format(new Date(r.end_date), "dd MMMM yyyy", { locale: localeId })}
                    </TableCell>
                    <TableCell className="text-left font-medium text-slate-900 py-1.5 whitespace-nowrap">{formatDuration(totalMinutes(r.agenda_items || []))}</TableCell>
                    <TableCell className="text-center py-1.5 whitespace-nowrap">{renderStatusBadge(r.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );

  const renderMonitorSection = () => (
    <div className="space-y-4">
      {/* Summary Cards */}
      {isAdminOrHr && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white border-slate-200 border rounded-xl p-4 shadow-sm flex flex-col justify-center">
            <span className="text-sm text-slate-500 font-medium">Total Laporan</span>
            <span className="text-2xl font-bold text-slate-900">{metrics.total}</span>
          </div>
          <div className="bg-[hsl(142,45%,96%)] border-[hsl(142,45%,90%)] border rounded-xl p-4 shadow-sm flex flex-col justify-center">
            <span className="text-sm text-[hsl(142,45%,25%)]/80 font-medium">Disetujui</span>
            <span className="text-2xl font-bold text-[hsl(142,45%,25%)]">{metrics.approved}</span>
          </div>
          <div className="bg-[hsl(38,55%,94%)] border-[hsl(38,55%,88%)] border rounded-xl p-4 shadow-sm flex flex-col justify-center">
            <span className="text-sm text-[hsl(38,55%,30%)]/80 font-medium">Menunggu Persetujuan</span>
            <span className="text-2xl font-bold text-[hsl(38,55%,30%)]">{metrics.submitted}</span>
          </div>
          <div className="bg-[hsl(232,59%,96%)] border-[hsl(232,59%,90%)] border rounded-xl p-4 shadow-sm flex flex-col justify-center">
            <span className="text-sm text-[hsl(232,59%,21%)]/80 font-medium">Dalam Proses</span>
            <span className="text-2xl font-bold text-[hsl(232,59%,21%)]">{metrics.incomplete}</span>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="relative border rounded-md bg-white flex flex-col shadow-sm">
        <div className="overflow-x-auto overflow-y-visible flex-1 h-auto relative">
          <Table className="w-full caption-bottom text-sm relative border-separate border-spacing-0 min-w-[700px]">
            <TableHeader className="z-20 transition-none [&_th]:sticky [&_th]:top-0 [&_th:not(.sticky)]:z-30 [&_th:not(.sticky)]:bg-muted">
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className="w-[50px] text-center font-semibold bg-muted whitespace-nowrap">No.</TableHead>
                <TableHead className="w-full font-semibold text-left bg-muted whitespace-nowrap">Karyawan</TableHead>
                {isAdminOrHr && <TableHead className="w-[180px] font-semibold text-left bg-muted whitespace-nowrap">{term}</TableHead>}
                <TableHead className="w-[250px] font-semibold text-left bg-muted whitespace-nowrap">Periode Laporan</TableHead>
                <TableHead className="w-[160px] font-semibold text-left bg-muted whitespace-nowrap">Total Durasi</TableHead>
                <TableHead className="w-[150px] font-semibold text-center bg-muted whitespace-nowrap">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Memuat...</TableCell></TableRow>
              ) : filteredReports.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Tidak ada laporan.</TableCell></TableRow>
              ) : (
                filteredReports.map((r, idx) => (
                  <TableRow 
                    key={r.id} 
                    className={`h-11 border-b border-gray-200 text-sm transition-colors ${r.status !== "UNCREATED" ? "cursor-pointer hover:bg-muted/50" : ""}`}
                    onClick={() => { if (r.status !== "UNCREATED") openViewReport(r); }}
                  >
                    <TableCell className="text-center text-slate-900 py-1.5">{idx + 1}</TableCell>
                    <TableCell className="font-medium text-slate-900 py-1.5 truncate max-w-[150px]">
                      <div className="flex items-center gap-2">
                        <span>{r.employees?.name}</span>
                        {(userRolesMap[r.employees?.user_id]?.includes("unit_leader") || unitsList.some((u: any) => u.leader_id === r.employee_id)) && (
                          <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        )}
                      </div>
                    </TableCell>
                    {isAdminOrHr && (
                      <TableCell className="text-slate-900 py-1.5 truncate max-w-[150px]">{r.employees?.units?.name || "—"}</TableCell>
                    )}
                    <TableCell className="text-slate-900 py-1.5 whitespace-nowrap">
                      {format(new Date(r.start_date), "dd MMMM", { locale: localeId })} - {format(new Date(r.end_date), "dd MMMM yyyy", { locale: localeId })}
                    </TableCell>
                    <TableCell className="text-left font-medium text-slate-900 py-1.5 whitespace-nowrap">{formatDuration(totalMinutes(r.agenda_items || []))}</TableCell>
                    <TableCell className="text-center py-1.5 whitespace-nowrap">{renderStatusBadge(r.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-4">
        {/* Header Area */}
        <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
          <div>
            <h1 className="page-title">
             Agenda Pekanan
            </h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {activeTab === "riwayat" && (
              <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
            )}
            {activeTab === "saya" && canEditItems && (
              <>
                <div title={myItems.length === 0 ? "Tambah kegiatan terlebih dahulu" : "Kirimkan laporan agenda"}>
                  <Button 
                    variant="outline"
                    size="sm" 
                    onClick={handleSubmitReport} 
                    disabled={myItems.length === 0} 
                    className="gap-2 bg-white/50 shadow-sm border-primary/20 transition-all transform active:scale-95 font-medium w-full"
                  >
                    <Send className="h-4 w-4 text-primary" /> Submit Laporan
                  </Button>
                </div>
                <Button 
                  size="sm" 
                  className="gap-2 shadow-md shadow-primary/10 bg-primary hover:bg-primary/90 transition-all transform active:scale-95 font-medium"
                  onClick={openCreateItem}
                >
                  <Plus className="h-4 w-4" /> Tambah Kegiatan
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ── Toolbar filter ── */}
        {activeTab === "tim" && showMonitorSection && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-lg">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Cari nama karyawan..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                  className="pl-9 h-9 text-sm shadow-sm border-primary/40 bg-white/50 transition-all" 
                />
              </div>
              
              {isAdminOrHr && (
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-2 bg-white/50 shadow-sm border-primary/20 transition-all font-medium">
                      <Filter className="h-4 w-4 text-primary" /> Filter
                      {((filterStatus !== "all" ? 1 : 0) + (filterUnit !== "all" ? 1 : 0) + (selectedMonth !== format(new Date(), "yyyy-MM") ? 1 : 0)) > 0 && (
                        <Badge variant="secondary" className="ml-1 px-1.5 h-5 min-w-5 flex items-center justify-center bg-primary text-primary-foreground font-bold">
                          {(filterStatus !== "all" ? 1 : 0) + (filterUnit !== "all" ? 1 : 0) + (selectedMonth !== format(new Date(), "yyyy-MM") ? 1 : 0)}
                        </Badge>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-[350px] sm:w-[450px] flex flex-col p-0 shadow-2xl border-l-0">
                    <SheetHeader className="border-b p-6 bg-primary/5">
                      <div className="flex items-center justify-between">
                        <SheetTitle className="text-xl font-bold flex items-center gap-2">
                          <Filter className="h-5 w-5 text-primary" />
                          Filter Laporan
                        </SheetTitle>
                      </div>
                    </SheetHeader>
                    
                    <div className="flex-1 overflow-y-auto px-6 py-2">
                      <div className="grid gap-5 py-6 pb-24">
                        <div className="space-y-2.5">
                          <Label className="text-sm text-muted-foreground/90 font-bold tracking-wider">Bulan</Label>
                          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} className="w-full h-10 shadow-sm border-primary/40 bg-white" />
                        </div>
                        
                        <div className="space-y-2.5">
                          <Label className="text-sm text-muted-foreground/90 font-bold tracking-wider">Status Laporan</Label>
                          <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="h-10 text-sm text-slate-900 shadow-sm border-primary/40 bg-white">
                              <SelectValue placeholder="Semua Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all" className="text-sm">Semua Status</SelectItem>
                              <SelectItem value="UNCREATED" className="text-sm">Belum Ada</SelectItem>
                              <SelectItem value="DRAFT" className="text-sm">Disusun</SelectItem>
                              <SelectItem value="SUBMITTED" className="text-sm">Menunggu Persetujuan</SelectItem>
                              <SelectItem value="REVISION_REQUESTED" className="text-sm">Direvisi</SelectItem>
                              <SelectItem value="APPROVED" className="text-sm">Disetujui</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2.5">
                          <Label className="text-sm text-muted-foreground/90 font-bold tracking-wider">{term}</Label>
                          <Select value={filterUnit} onValueChange={setFilterUnit}>
                            <SelectTrigger className="h-10 text-sm text-slate-900 shadow-sm border-primary/40 bg-white">
                              <SelectValue placeholder={`Semua ${term}`} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all" className="text-sm">Semua {term}</SelectItem>
                              {unitsList.map(u => (
                                <SelectItem key={u.id} value={u.id} className="text-sm">{u.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    
                    <SheetFooter className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t flex flex-row gap-3">
                      <Button variant="outline" onClick={() => { setFilterStatus("all"); setFilterUnit("all"); setSelectedMonth(format(new Date(), "yyyy-MM")); }} className="flex-1 font-semibold bg-red-50 border-red-100 text-red-600 hover:bg-red-100 hover:text-red-700 hover:border-red-200 shadow-none transition-all">
                        Hapus Filter
                      </Button>
                      <SheetClose asChild>
                        <Button className="flex-1 bg-primary hover:bg-primary/90 shadow-md shadow-primary/10 transition-all font-medium">
                          Tampilkan Hasil
                        </Button>
                      </SheetClose>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
              )}
            </div>
            
            {!isAdminOrHr && isUnitLeader && (
              <div className="flex items-center gap-2">
                <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-9 text-sm w-[160px] bg-white/50 shadow-sm border-primary/20 font-medium transition-all hover:bg-accent hover:border-accent">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="UNCREATED">Belum Ada</SelectItem>
                    <SelectItem value="DRAFT">Disusun</SelectItem>
                    <SelectItem value="SUBMITTED">Menunggu Persetujuan</SelectItem>
                    <SelectItem value="REVISION_REQUESTED">Direvisi</SelectItem>
                    <SelectItem value="APPROVED">Disetujui</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {showMySection ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className={`grid mb-3 bg-muted/50 h-9 rounded-lg ${showMonitorSection ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <TabsTrigger value="saya" className="text-xs">Formulir Agenda</TabsTrigger>
              <TabsTrigger value="riwayat" className="text-xs">{showMonitorSection ? "Riwayat Agenda Saya" : "Riwayat Agenda"}</TabsTrigger>
              {showMonitorSection && <TabsTrigger value="tim" className="text-xs">{isAdminOrHr ? "Pantauan Agenda" : "Agenda Tim"}</TabsTrigger>}
            </TabsList>
            <TabsContent value="saya" className="mt-0">
              {renderMySection()}
            </TabsContent>
            <TabsContent value="riwayat" className="mt-0">
              {renderMyHistorySection()}
            </TabsContent>
            {showMonitorSection && (
              <TabsContent value="tim" className="mt-0">
                {renderMonitorSection()}
              </TabsContent>
            )}
          </Tabs>
        ) : showMonitorSection ? (
          <div>
            {renderMonitorSection()}
          </div>
        ) : null}
      </div>

      {/* Dialog Item */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 border-b bg-muted/30 shrink-0">
            <DialogTitle className="text-xl font-bold tracking-tight">{itemMode === "create" ? "Tambah Kegiatan" : "Edit Kegiatan"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveItem} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground/90 font-bold">Tanggal</Label>
                  <Input type="date" value={itemForm.date} min={currentStartOfWeek} max={currentEndOfWeek} onChange={e => setItemForm({...itemForm, date: e.target.value})} className="h-9 text-sm text-slate-900 shadow-sm" required />
                </div>
                
                {itemForm.activities?.map((act: any, idx: number) => (
                  <div key={idx} className="p-3 border rounded-lg bg-slate-50 space-y-3 relative">
                    {itemMode === "create" && itemForm.activities.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-slate-400 hover:text-red-500" onClick={() => removeActivityField(idx)}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                    <div className="space-y-2 pr-6">
                      <Label className="text-sm text-muted-foreground/90 font-bold">Kegiatan {itemMode === "create" ? idx + 1 : ""}</Label>
                      <Input value={act.activity} onChange={e => updateActivityField(idx, "activity", e.target.value)} placeholder="Contoh: Rapat koordinasi" className="h-9 text-sm text-slate-900 shadow-sm" required />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground/90 font-bold">Durasi (Jam)</Label>
                        <Input type="number" min="0" max="23" value={act.hours} onChange={e => updateActivityField(idx, "hours", parseInt(e.target.value) || 0)} className="h-9 text-sm text-slate-900 shadow-sm" required />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground/90 font-bold">Durasi (Menit)</Label>
                        <Input type="number" min="0" max="59" value={act.minutes} onChange={e => updateActivityField(idx, "minutes", parseInt(e.target.value) || 0)} className="h-9 text-sm text-slate-900 shadow-sm" required />
                      </div>
                    </div>
                  </div>
                ))}
                
                {itemMode === "create" && (
                  <Button type="button" variant="outline" size="sm" onClick={addActivityField} className="w-full gap-2 border-dashed border-primary/30 text-primary hover:bg-primary/5">
                    <Plus className="h-4 w-4" /> Tambah Kegiatan Lain
                  </Button>
                )}
              </div>
            </div>
            <DialogFooter className="p-6 border-t bg-muted/30 shrink-0">
              <div className="flex justify-end gap-3 w-full">
                <Button type="button" variant="outline" className="min-w-[140px] h-10 text-sm" onClick={() => setItemDialogOpen(false)}>Batal</Button>
                <Button type="submit" disabled={isSaving} className="min-w-[140px] h-10 shadow-md bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all transform active:scale-95 px-6">
                  {isSaving ? "Menyimpan..." : (itemMode === "create" ? "Simpan Data" : "Simpan Perubahan")}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Revisi */}
      <Dialog open={revisionDialogOpen} onOpenChange={setRevisionDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 border-b bg-muted/30 shrink-0">
            <DialogTitle className="text-xl font-bold tracking-tight">Minta Revisi Laporan</DialogTitle>
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

      {/* Dialog View Report Detail */}
      <Dialog open={viewReportOpen} onOpenChange={setViewReportOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none bg-slate-50">
          <DetailHeader 
            title="Detail Laporan Agenda"
            badge={viewingReport && renderStatusBadge(viewingReport.status)}
            actions={
              isUnitLeader && viewingReport?.status === "SUBMITTED" && viewingReport?.employees?.unit_id === employee?.unit_id ? (
                <>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-8 gap-1.5 font-semibold bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 hover:border-emerald-200 shadow-none transition-all" 
                    onClick={() => {
                      handleApproveReport(viewingReport.id);
                      setViewReportOpen(false);
                    }}
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-8 gap-1.5 font-semibold bg-red-50 border-red-100 text-red-600 hover:bg-red-100 hover:text-red-700 hover:border-red-200 shadow-none transition-all" 
                    onClick={() => {
                      openRevisionDialog(viewingReport.id);
                      setViewReportOpen(false);
                    }}
                  >
                    <XCircle className="h-3.5 w-3.5" /> Revisi
                  </Button>
                </>
              ) : undefined
            }
          />
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <DetailSection icon={User} title="Informasi Karyawan">
              <DetailItem label="Nama Karyawan" value={viewingReport?.employees?.name || "—"} />
              <DetailItem 
                label={(() => {
                  const capitalizedTerm = term ? term.charAt(0).toUpperCase() + term.slice(1) : "Unit";
                  if (!viewingReport?.employees?.user_id) return capitalizedTerm;
                  const isLeader = userRolesMap[viewingReport.employees.user_id]?.includes("unit_leader") || unitsList.some((u: any) => u.leader_id === viewingReport.employee_id);
                  return isLeader ? `Kepala ${capitalizedTerm}` : capitalizedTerm;
                })()} 
                value={viewingReport?.employees?.units?.name ?? "—"} 
              />
            </DetailSection>

            <DetailSection icon={ClipboardCheck} title="Informasi Laporan">
              <DetailItem 
                label="Periode Laporan" 
                value={viewingReport ? `${format(new Date(viewingReport.start_date), "dd MMMM", { locale: localeId })} - ${format(new Date(viewingReport.end_date), "dd MMMM yyyy", { locale: localeId })}` : "—"} 
              />
              <DetailItem 
                label="Total Jam Kerja" 
                value={formatDuration(totalMinutes(viewingReport?.agenda_items || []))} 
                isHighlight 
              />
              {viewingReport?.status === "APPROVED" && viewingReport?.approved_at && (
                <>
                  <DetailItem 
                    label="Disetujui Pada" 
                    value={format(new Date(viewingReport.approved_at), "dd MMMM yyyy HH:mm", { locale: localeId })} 
                  />
                  {viewingReport.approved_by && (
                    <DetailItem 
                      label="Disetujui Oleh" 
                      value={approversMap[viewingReport.approved_by] || "Sistem"} 
                    />
                  )}
                </>
              )}
              {viewingReport?.status === "REVISION_REQUESTED" && viewingReport?.manager_notes && (
                <div className="col-span-1 md:col-span-2 mt-2">
                  <DetailItem 
                    label="Catatan Revisi dari Manajer" 
                    value={<span className="text-red-600 font-medium">{viewingReport.manager_notes}</span>} 
                  />
                </div>
              )}
            </DetailSection>

            <DetailSection icon={ListTodo} title="Daftar Kegiatan">
              <div className="col-span-1 md:col-span-2 bg-white rounded-lg border shadow-sm overflow-hidden">
                <Table className="w-full text-sm">
                  <TableHeader>
                    <TableRow className="bg-muted h-10">
                      <TableHead className="w-[50px] text-center font-semibold">No.</TableHead>
                      <TableHead className="w-[120px] font-semibold text-left">Tanggal</TableHead>
                      <TableHead className="w-[100px] font-semibold text-left">Durasi</TableHead>
                      <TableHead className="font-semibold text-left">Kegiatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingReport?.agenda_items?.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Tidak ada kegiatan yang dicatat.</TableCell></TableRow>
                    ) : (
                      viewingReport?.agenda_items?.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item: any, idx: number) => (
                        <TableRow key={item.id} className="h-11 border-b border-gray-100">
                          <TableCell className="text-center text-slate-500 py-1.5">{idx + 1}</TableCell>
                          <TableCell className="text-slate-900 py-1.5 whitespace-nowrap">{format(new Date(item.date), "dd MMMM yyyy", { locale: localeId })}</TableCell>
                          <TableCell className="text-slate-900 font-medium py-1.5 whitespace-nowrap">{formatDuration(item.duration_minutes)}</TableCell>
                          <TableCell className="text-slate-900 py-1.5">{item.activity}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </DetailSection>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deletingItem}
        onOpenChange={(v) => !v && setDeletingItem(null)}
        itemName={deletingItem?.activity}
        onConfirm={handleDeleteItem}
        isLoading={isDeleting}
      />
    </DashboardLayout>
  );
}
