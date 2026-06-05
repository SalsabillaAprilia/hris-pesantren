import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { useAuth } from "@/hooks/useAuth";
import { useTerminology } from "@/hooks/useTerminology";
import { useInstansiFilter } from "@/hooks/useInstansiFilter";
import { toast } from "sonner";
import { Plus, Trash2, BarChart3, Pencil, Users, Calendar, ChevronDown, ChevronUp, Search, Archive, ArchiveRestore, Target, AlignLeft } from "lucide-react";
import { DetailHeader, DetailSection, DetailItem } from "@/components/ui/detail-layout";
import { supabaseFetchWithTimeout } from "@/utils/supabase-fetch";

type KpiEvalStatus = "TODO" | "DRAFT" | "SUBMITTED";

interface KpiTemplate {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  scale: number;
  threshold_sangat_baik: number;
  threshold_baik: number;
  threshold_cukup: number;
  created_at: string;
  updated_at: string;
  instansi_id?: string | null;
  is_active?: boolean;
}

interface KpiIndicator {
  id: string;
  template_id: string;
  name: string;
  description: string | null;
  weight: number;
}

interface KpiEvaluation {
  id: string;
  employee_id: string;
  template_id: string;
  evaluator_id: string;
  start_date: string | null;
  end_date: string | null;
  status: KpiEvalStatus;
  total_score: number | null;
  qualitative_feedback: string | null;
  created_at: string;
  updated_at: string;
  employees?: { name: string; unit_id: string | null; user_id?: string };
}

interface IndicatorRow { name: string; weight: string; description: string; }

let globalKpiTemplatesCache: KpiTemplate[] | null = null;
let globalKpiIndicatorsCache: KpiIndicator[] | null = null;
let globalKpiEvaluationsCache: KpiEvaluation[] | null = null;
let globalKpiScoresCache: any[] | null = null;
let globalKpiUnitEmployeesCache: any[] | null = null;
let globalKpiHrLeadersCache: any[] | null = null;
let globalKpiEmployeeMapCache: Record<string,string> | null = null;
let globalKpiCacheInstansiId: string | null | undefined = undefined; // undefined = belum pernah di-fetch

export default function KPI() {
  const { user, employee, isAdminOrHr, hasRole, isDirector, isSuperAdmin, isHr } = useAuth();
  const { kepalaTerm } = useTerminology();
  const { effectiveInstansiId } = useInstansiFilter();
  const isUnitLeader = hasRole("unit_leader");
  const isEmployee   = hasRole("employee");
  const canMonitorKPI = isAdminOrHr || isDirector;

  // Invalidasi cache jika effectiveInstansiId berubah (pindah cabang/user berbeda)
  const isCacheValid = globalKpiCacheInstansiId === effectiveInstansiId;

  const [templates,     setTemplates]     = useState<KpiTemplate[]>(isCacheValid && globalKpiTemplatesCache ? globalKpiTemplatesCache : []);
  const [indicators,    setIndicators]    = useState<KpiIndicator[]>(isCacheValid && globalKpiIndicatorsCache ? globalKpiIndicatorsCache : []);
  const [evaluations,   setEvaluations]   = useState<KpiEvaluation[]>(isCacheValid && globalKpiEvaluationsCache ? globalKpiEvaluationsCache : []);
  const [scores,        setScores]        = useState<any[]>(isCacheValid && globalKpiScoresCache ? globalKpiScoresCache : []);
  const [unitEmployees, setUnitEmployees] = useState<any[]>(isCacheValid && globalKpiUnitEmployeesCache ? globalKpiUnitEmployeesCache : []);
  const [hrLeaders,     setHrLeaders]     = useState<any[]>(isCacheValid && globalKpiHrLeadersCache ? globalKpiHrLeadersCache : []);
  const [employeeMap,   setEmployeeMap]   = useState<Record<string,string>>(isCacheValid && globalKpiEmployeeMapCache ? globalKpiEmployeeMapCache : {});
  const [loading,       setLoading]       = useState(!isCacheValid || globalKpiTemplatesCache === null);

  const isFirstFetch = useRef(!isCacheValid || globalKpiTemplatesCache === null);
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ── Template dialog state ─────────────────────────────────────────────────
  const [tplOpen,    setTplOpen]    = useState(false);
  const [tplMode,    setTplMode]    = useState<"create"|"edit">("create");
  const [editTplId,  setEditTplId]  = useState<string|null>(null);
  const [tplName,    setTplName]    = useState("");
  const [tplDesc,    setTplDesc]    = useState("");
  const [tplScale,   setTplScale]   = useState("100");
  const [tplThreshSB, setTplThreshSB] = useState("85");
  const [tplThreshB,  setTplThreshB]  = useState("70");
  const [tplThreshC,  setTplThreshC]  = useState("55");
  const [tplInds,    setTplInds]    = useState<IndicatorRow[]>([{ name:"", weight:"", description:"" }]);
  const [showThresh, setShowThresh] = useState(false);
  const [isSavingT,  setIsSavingT]  = useState(false);

  // ── Evaluation dialog state ───────────────────────────────────────────────
  const [evalOpen,       setEvalOpen]       = useState(false);
  const [viewEvalOpen,   setViewEvalOpen]   = useState(false);
  const [viewingEval,    setViewingEval]    = useState<KpiEvaluation | null>(null);
  const [evalEmpIds,     setEvalEmpIds]     = useState<string[]>([]);
  const [evalTplId,      setEvalTplId]      = useState("");
  const [evalStartDate,  setEvalStartDate]  = useState("");
  const [evalEndDate,    setEvalEndDate]    = useState("");
  const [evalScores,     setEvalScores]     = useState<Record<string,string>>({});
  const [evalFeedback,   setEvalFeedback]   = useState("");
  const [isSavingE,      setIsSavingE]      = useState(false);
  const [editingEvalId,  setEditingEvalId]  = useState<string|null>(null);
  const [deleteTplId,    setDeleteTplId]    = useState<string|null>(null);
  const [isDeletingTpl,  setIsDeletingTpl]  = useState(false);
  const [filterYear,     setFilterYear]     = useState<string>(String(new Date().getFullYear()));
  const [filterStatus,   setFilterStatus]   = useState<string>("all");
  const [templateSearch, setTemplateSearch] = useState<string>("");
  const [activeTab,      setActiveTab]      = useState<string>(canMonitorKPI && !isUnitLeader ? "evaluasi" : "evaluasi");

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (isFirstFetch.current) setLoading(true);
    try {
      let tplQuery: any = supabase.from("kpi_templates").select("*").order("created_at", { ascending: false });
      let evalQuery: any = supabase.from("kpi_evaluations").select("*, employees!inner(name,unit_id,user_id,instansi_id)").order("created_at", { ascending: false });
      let empQuery: any = supabase.from("employees").select("id,name,unit_id,user_id,instansi_id").eq("status","active");
      let rolesQuery: any = supabase.from("user_roles").select("user_id,role,instansi_id");

      if (effectiveInstansiId) {
        tplQuery = tplQuery.eq("instansi_id", effectiveInstansiId);
        evalQuery = evalQuery.eq("employees.instansi_id", effectiveInstansiId);
        empQuery = empQuery.eq("instansi_id", effectiveInstansiId);
        rolesQuery = rolesQuery.eq("instansi_id", effectiveInstansiId);
      }

      const [tRes, iRes, eRes, sRes, empRes] = await supabaseFetchWithTimeout(
        Promise.all([
          tplQuery,
          supabase.from("kpi_indicators").select("*"),
          evalQuery,
          supabase.from("kpi_scores").select("*"),
          empQuery,
        ])
      );
      if (tRes.error) throw tRes.error;
      if (iRes.error) throw iRes.error;
      if (eRes.error) throw eRes.error;

      const rolesRes = await rolesQuery;
      const rolesMap = Object.fromEntries((rolesRes.data ?? []).map((r:any) => [r.user_id, r.role]));
      // Karyawan yang bisa dinilai: exclude admin-level dan director
      let emps = (empRes.data ?? []).filter((e:any) => !["super_admin","hr","director"].includes(rolesMap[e.user_id]));
      if (isUnitLeader && employee?.unit_id) {
        // Kepala unit hanya bisa menilai anggota unitnya, dan TIDAK termasuk dirinya sendiri
        emps = emps.filter((e:any) => e.unit_id === employee.unit_id && e.user_id !== user?.id);
      }
      const hrLdrs = (empRes.data ?? []).filter((e:any) => rolesMap[e.user_id] === "unit_leader");
      const empMap = Object.fromEntries((empRes.data ?? []).map((e:any) => [e.user_id, e.name]));

      if (isMounted.current) {
        setTemplates((tRes.data ?? []) as KpiTemplate[]);
        setIndicators((iRes.data ?? []) as KpiIndicator[]);
        setEvaluations((eRes.data ?? []) as KpiEvaluation[]);
        setScores(sRes.data ?? []);
        setUnitEmployees(emps);
        setHrLeaders(hrLdrs);
        setEmployeeMap(empMap);
        
        globalKpiTemplatesCache = (tRes.data ?? []) as KpiTemplate[];
        globalKpiIndicatorsCache = (iRes.data ?? []) as KpiIndicator[];
        globalKpiEvaluationsCache = (eRes.data ?? []) as KpiEvaluation[];
        globalKpiScoresCache = sRes.data ?? [];
        globalKpiUnitEmployeesCache = emps;
        globalKpiHrLeadersCache = hrLdrs;
        globalKpiEmployeeMapCache = empMap;
        globalKpiCacheInstansiId = effectiveInstansiId; // Simpan key cache
      }
    } catch (err: any) {
      console.error("KPI fetch error:", err);
      if (isMounted.current && err.code !== "PGRST116") toast.error("Gagal memuat data KPI.");
    } finally {
      if (isMounted.current) {
        setLoading(false);
        isFirstFetch.current = false;
      }
    }
  }, [isUnitLeader, employee?.unit_id, effectiveInstansiId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Computed values ───────────────────────────────────────────────────────
  const getInds = (tplId: string) => indicators.filter(i => i.template_id === tplId);

  const selectedTplInds = useMemo(() => getInds(evalTplId), [evalTplId, indicators]);

  const visibleEvals = useMemo(() => {
    // PRE-FILTER GLOBAL: Draft/TODO HANYA boleh dilihat oleh pembuatnya. 
    // Ini melindungi privasi penilai agar karyawan tidak bisa mengintip nilai yang belum final.
    let evs = evaluations.filter(ev => {
      if (ev.status === "SUBMITTED") return true;
      return ev.evaluator_id === user?.id;
    });
    
    // Role filtering base
    if (isEmployee && !isUnitLeader) {
      evs = evs.filter(ev => ev.employees?.user_id === user?.id || ev.employee_id === employee?.id);
    } else if (isUnitLeader && !isAdminOrHr && employee?.unit_id) {
      evs = evs.filter(ev => ev.employees?.unit_id === employee.unit_id && ev.employee_id !== employee?.id);
    }

    // Status filter
    if (filterStatus !== "all") {
      evs = evs.filter(ev => ev.status === filterStatus);
    }

    // Year filter
    if (filterYear !== "all") {
      evs = evs.filter(ev => {
        const year = new Date((ev.start_date ?? ev.end_date) || ev.created_at).getFullYear().toString();
        return year === filterYear;
      });
    }
    return evs.sort((a, b) => {
      const dateA = new Date(a.end_date || a.start_date || a.created_at).getTime();
      const dateB = new Date(b.end_date || b.start_date || b.created_at).getTime();
      return dateB - dateA;
    });
  }, [evaluations, isEmployee, isUnitLeader, isAdminOrHr, employee?.unit_id, employee?.id, user?.id, filterYear, filterStatus]);

  const myLeaderEvals = useMemo(() => {
    // KPI Saya (untuk Kepala Unit) juga HANYA menampilkan yang sudah Dipublikasi
    let evs = evaluations.filter(ev => ev.employee_id === employee?.id && ev.status === "SUBMITTED");
    if (filterYear !== "all") {
      evs = evs.filter(ev => {
        const year = new Date((ev.start_date ?? ev.end_date) || ev.created_at).getFullYear().toString();
        return year === filterYear;
      });
    }
    return evs.sort((a, b) => {
      const dateA = new Date(a.end_date || a.start_date || a.created_at).getTime();
      const dateB = new Date(b.end_date || b.start_date || b.created_at).getTime();
      return dateB - dateA;
    });
  }, [evaluations, employee?.id, filterYear]);

  const leaderEvals = useMemo(() => {
    let evs = evaluations.filter(ev => hrLeaders.some(l => l.id === ev.employee_id));
    if (filterYear !== "all") {
      evs = evs.filter(ev => ev.start_date && new Date(ev.start_date).getFullYear().toString() === filterYear);
    }
    return evs;
  }, [evaluations, hrLeaders, filterYear]);

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    // Tampilkan 5 tahun ke belakang dari tahun sekarang
    return Array.from({ length: 5 }, (_, i) => String(currentYear - i));
  }, []);

  const filteredTemplates = useMemo(() => {
    if (!templateSearch.trim()) return templates;
    const q = templateSearch.toLowerCase();
    return templates.filter(t => 
      t.name.toLowerCase().includes(q) || 
      (t.description?.toLowerCase().includes(q) ?? false)
    );
  }, [templates, templateSearch]);

  // ── Badge helpers ─────────────────────────────────────────────────────────
  const getScoreBadge = (score: number, tpl?: KpiTemplate) => {
    const sb = tpl?.threshold_sangat_baik ?? 85;
    const b  = tpl?.threshold_baik        ?? 70;
    const c  = tpl?.threshold_cukup       ?? 55;
    if (score >= sb) return <span className="px-2 py-0.5 text-[11px] font-semibold rounded border whitespace-nowrap text-[hsl(142,45%,25%)] bg-[hsl(142,45%,96%)] border-[hsl(142,45%,90%)]">Sangat Baik</span>;
    if (score >= b)  return <span className="px-2 py-0.5 text-[11px] font-semibold rounded border whitespace-nowrap text-[hsl(232,59%,21%)] bg-[hsl(232,59%,96%)] border-[hsl(232,59%,90%)]">Baik</span>;
    if (score >= c)  return <span className="px-2 py-0.5 text-[11px] font-semibold rounded border whitespace-nowrap text-[hsl(38,55%,30%)] bg-[hsl(38,55%,94%)] border-[hsl(38,55%,88%)]">Cukup</span>;
    return <span className="px-2 py-0.5 text-[11px] font-semibold rounded border whitespace-nowrap text-[hsl(0,55%,35%)] bg-[hsl(0,55%,96%)] border-[hsl(0,55%,90%)]">Kurang</span>;
  };

  const getStatusBadge = (status: KpiEvalStatus) => {
    const map: Record<KpiEvalStatus, string> = {
      TODO:      "text-[hsl(232,59%,21%)] bg-[hsl(232,59%,96%)] border-[hsl(232,59%,90%)]",
      DRAFT:     "text-[hsl(38,55%,30%)] bg-[hsl(38,55%,94%)] border-[hsl(38,55%,88%)]",
      SUBMITTED: "text-[hsl(142,45%,25%)] bg-[hsl(142,45%,96%)] border-[hsl(142,45%,90%)]",
    };
    const label: Record<KpiEvalStatus, string> = { TODO:"Belum Mulai", DRAFT:"Proses Penilaian", SUBMITTED:"Dipublikasi" };
    return <span className={`px-2 py-0.5 text-[11px] font-semibold rounded border whitespace-nowrap ${map[status]}`}>{label[status]}</span>;
  };

  const formatDateRange = (ev: KpiEvaluation) => {
    if (!ev.start_date && !ev.end_date) return "—";
    const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" });
    if (ev.start_date && ev.end_date) return `${fmt(ev.start_date)} – ${fmt(ev.end_date)}`;
    return fmt((ev.start_date ?? ev.end_date)!);
  };

  // ── renderEvalTable ───────────────────────────────────────────────────────
  const renderEvalTable = (data: KpiEvaluation[], canEdit = false, showName = true) => (
    <div className="relative border rounded-md bg-white flex flex-col">
      <div className="overflow-x-auto overflow-y-visible flex-1 h-auto relative">
        <table className="w-full caption-bottom text-sm relative border-separate border-spacing-0 min-w-[700px]">
          <TableHeader>
            <TableRow className="border-none hover:bg-transparent">
              <TableHead className="bg-muted font-semibold text-center w-10 min-w-[40px]">No.</TableHead>
              {showName && <TableHead className="bg-muted font-semibold whitespace-nowrap">Nama</TableHead>}
              <TableHead className="bg-muted font-semibold whitespace-nowrap w-[160px]">Periode</TableHead>
              <TableHead className="bg-muted font-semibold whitespace-nowrap">Template</TableHead>
              <TableHead className="bg-muted font-semibold text-center whitespace-nowrap w-[80px]">Nilai</TableHead>
              <TableHead className="bg-muted font-semibold text-center whitespace-nowrap w-[110px]">Predikat</TableHead>
              <TableHead className="bg-muted font-semibold text-center whitespace-nowrap w-[110px]">Status</TableHead>
              <TableHead className="bg-muted font-semibold whitespace-nowrap">Dinilai Oleh</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showName ? 8 : 7} className="h-32 text-center text-muted-foreground">Belum ada evaluasi.</TableCell>
              </TableRow>
            ) : data.map((ev, idx) => {
              const tpl = templates.find(t => t.id === ev.template_id);
              // Hanya bisa edit jika: punya hak edit, bukan SUBMITTED, DAN user ini adalah evaluator-nya
              const isEditable = canEdit && ev.status !== "SUBMITTED" && ev.evaluator_id === user?.id;
              return (
                <TableRow
                  key={ev.id}
                  onClick={() => {
                    if (isEditable) openEditEval(ev);
                    else if (ev.status === "SUBMITTED") openViewEval(ev);
                  }}
                  className={`hover:bg-muted/50 transition-colors h-11 border-b border-gray-200 text-sm ${(isEditable || ev.status === "SUBMITTED") ? "cursor-pointer" : "cursor-default"}`}
                >
                  <TableCell className="text-center text-slate-500 py-1.5">{idx + 1}</TableCell>
                  {showName && <TableCell className="font-semibold text-slate-900 py-1.5 truncate max-w-[150px]" title={ev.employees?.name ?? "—"}>{ev.employees?.name ?? "—"}</TableCell>}
                  <TableCell className="text-xs text-slate-600 py-1.5 whitespace-nowrap">{formatDateRange(ev)}</TableCell>
                  <TableCell className="text-slate-700 py-1.5 truncate max-w-[150px]" title={tpl?.name ?? "—"}>{tpl?.name ?? "—"}</TableCell>
                  <TableCell className="text-center font-bold text-slate-900 py-1.5">{ev.total_score ?? "—"}</TableCell>
                  <TableCell className="text-center py-1.5">{ev.total_score ? getScoreBadge(ev.total_score, tpl) : "—"}</TableCell>
                  <TableCell className="text-center py-1.5">{getStatusBadge(ev.status)}</TableCell>
                  <TableCell className="text-slate-700 py-1.5 truncate max-w-[150px]" title={employeeMap[ev.evaluator_id] ?? "—"}>{employeeMap[ev.evaluator_id] ?? "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </table>
      </div>
    </div>
  );

  // ── Template handlers ─────────────────────────────────────────────────────
  const openCreateTpl = () => {
    setTplMode("create"); setEditTplId(null);
    setTplName(""); setTplDesc("");
    setTplScale("100"); setTplThreshSB("85"); setTplThreshB("70"); setTplThreshC("55");
    setTplInds([{ name:"", weight:"", description:"" }]);
    setShowThresh(false); setTplOpen(true);
  };

  const openEditTpl = (t: KpiTemplate) => {
    setTplMode("edit"); setEditTplId(t.id);
    setTplName(t.name); setTplDesc(t.description ?? "");
    setTplScale(String(t.scale ?? 100));
    setTplThreshSB(String(t.threshold_sangat_baik ?? 85));
    setTplThreshB(String(t.threshold_baik ?? 70));
    setTplThreshC(String(t.threshold_cukup ?? 55));
    setTplInds(getInds(t.id).map(i => ({ name: i.name, weight: String(i.weight), description: i.description ?? "" })));
    setShowThresh(false); setTplOpen(true);
  };

  const handleSaveTpl = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = tplInds.reduce((s, i) => s + (parseFloat(i.weight)||0), 0);
    if (Math.abs(total - 100) > 0.01) { toast.error("Total bobot indikator harus 100%"); return; }
    const sb = parseFloat(tplThreshSB), b = parseFloat(tplThreshB), c = parseFloat(tplThreshC);
    if (!(sb > b && b > c && c >= 0)) { toast.error("Urutan threshold harus: Sangat Baik > Baik > Cukup ≥ 0"); return; }
    if (!user) return;
    setIsSavingT(true);
    let newTplId: string | null = null;
    try {
      let tplId = editTplId;
      const tplPayload = {
        name: tplName, description: tplDesc || null,
        scale: parseInt(tplScale),
        threshold_sangat_baik: sb, threshold_baik: b, threshold_cukup: c,
        instansi_id: effectiveInstansiId,
      };
      if (tplMode === "create") {
        const { data, error } = await supabase.from("kpi_templates")
          .insert({ ...tplPayload, created_by: user.id }).select().single();
        if (error) throw error;
        tplId = data.id; newTplId = data.id;
      } else {
        const { error } = await supabase.from("kpi_templates").update(tplPayload).eq("id", tplId!);
        if (error) throw error;
        const { error: delErr } = await supabase.from("kpi_indicators").delete().eq("template_id", tplId!);
        if (delErr) throw delErr;
      }
      const { error: indErr } = await supabase.from("kpi_indicators").insert(
        tplInds.map(i => ({ template_id: tplId!, name: i.name, weight: parseFloat(i.weight), description: i.description || null }))
      );
      if (indErr) {
        if (newTplId) await supabase.from("kpi_templates").delete().eq("id", newTplId);
        throw indErr;
      }
      toast.success(tplMode === "create" ? "Template dibuat!" : "Template diperbarui!");
      setTplOpen(false); fetchData();
    } catch (err: any) { toast.error("Gagal: " + err.message); }
    finally { setIsSavingT(false); }
  };

  const requestDeleteTpl = async (id: string) => {
    const { data: usedEvals, error: checkErr } = await supabase.from("kpi_evaluations").select("id").eq("template_id", id).limit(1);
    if (checkErr) { toast.error(checkErr.message); return; }
    if (usedEvals && usedEvals.length > 0) { toast.error("Template tidak dapat dihapus karena sudah digunakan untuk evaluasi."); return; }
    setDeleteTplId(id);
  };

  const confirmDeleteTpl = async () => {
    if (!deleteTplId) return;
    setIsDeletingTpl(true);
    try {
      await supabase.from("kpi_indicators").delete().eq("template_id", deleteTplId);
      await supabase.from("kpi_templates").delete().eq("id", deleteTplId);
      toast.success("Template dihapus."); 
      fetchData();
      setDeleteTplId(null);
    } catch (err: any) { toast.error("Gagal menghapus: " + err.message); }
    finally { setIsDeletingTpl(false); }
  };

  const toggleArchiveTpl = async (t: KpiTemplate) => {
    try {
      const newStatus = t.is_active === false ? true : false;
      const { error } = await supabase.from("kpi_templates").update({ is_active: newStatus }).eq("id", t.id);
      if (error) throw error;
      toast.success(newStatus ? "Template diaktifkan kembali." : "Template diarsipkan.");
      fetchData();
    } catch (err: any) { toast.error("Gagal: " + err.message); }
  };

  // ── Evaluation handlers ───────────────────────────────────────────────────
  const openViewEval = (ev: KpiEvaluation) => {
    setViewingEval(ev);
    setViewEvalOpen(true);
  };

  const openCreateEval = () => {
    setEditingEvalId(null);
    setEvalEmpIds([]); setEvalTplId(""); setEvalStartDate(""); setEvalEndDate("");
    setEvalScores({}); setEvalFeedback(""); setEvalOpen(true);
  };

  const openEditEval = (ev: KpiEvaluation) => {
    // Hanya bisa edit jika statusnya bukan SUBMITTED
    if (ev.status === "SUBMITTED") { toast.info("Evaluasi yang sudah terkirim tidak dapat diubah."); return; }
    setEditingEvalId(ev.id);
    setEvalEmpIds([ev.employee_id]);
    setEvalTplId(ev.template_id);
    setEvalStartDate(ev.start_date ?? "");
    setEvalEndDate(ev.end_date ?? "");
    setEvalFeedback(ev.qualitative_feedback ?? "");
    // Pre-fill skor dari data scores yang sudah tersimpan
    const existingScores: Record<string, string> = {};
    scores
      .filter((s: any) => {
        // cari evaluation_id yang cocok, lalu ambil indikatornya
        const evalMatch = evaluations.find(e => e.id === ev.id);
        return evalMatch && s.evaluation_id === ev.id;
      })
      .forEach((s: any) => { existingScores[s.indicator_id] = String(s.score); });
    setEvalScores(existingScores);
    setEvalOpen(true);
  };

  const calcTotal = () => selectedTplInds.reduce((sum, ind) =>
    sum + ((parseFloat(evalScores[ind.id])||0) * ind.weight / 100), 0);

  const handleSaveDraft = async () => {
    if (!user || evalEmpIds.length === 0 || !evalTplId) { toast.error("Pilih template dan karyawan"); return; }
    setIsSavingE(true);
    try {
      const total = Math.round(calcTotal() * 100) / 100;
      if (editingEvalId) {
        // Mode edit: UPDATE record yang sudah ada
        const { error } = await supabase.from("kpi_evaluations").update({
          start_date: evalStartDate || null, end_date: evalEndDate || null,
          status: "DRAFT", total_score: total || null,
          qualitative_feedback: evalFeedback || null,
        }).eq("id", editingEvalId);
        if (error) throw error;
        // Hapus scores lama lalu insert ulang
        await supabase.from("kpi_scores").delete().eq("evaluation_id", editingEvalId);
        if (selectedTplInds.length > 0 && Object.keys(evalScores).length > 0) {
          await supabase.from("kpi_scores").insert(
            selectedTplInds.filter(ind => evalScores[ind.id]).map(ind => ({
              evaluation_id: editingEvalId, indicator_id: ind.id, score: parseFloat(evalScores[ind.id])
            }))
          );
        }
      } else {
        // Mode create: INSERT baris baru
        const rows = evalEmpIds.map(empId => ({
          employee_id: empId, evaluator_id: user.id, template_id: evalTplId,
          start_date: evalStartDate || null, end_date: evalEndDate || null,
          status: "DRAFT" as KpiEvalStatus, total_score: total || null,
          qualitative_feedback: evalFeedback || null,
        }));
        const { error } = await supabase.from("kpi_evaluations").insert(rows);
        if (error) throw error;
      }
      toast.success("Evaluasi disimpan sebagai Draft.");
      setEvalOpen(false); fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setIsSavingE(false); }
  };

  const handleSubmitEval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || evalEmpIds.length === 0 || !evalTplId || !evalStartDate || !evalEndDate)
      { toast.error("Lengkapi semua field wajib"); return; }
    const allFilled = selectedTplInds.every(i => evalScores[i.id] !== undefined && evalScores[i.id] !== "");
    if (!allFilled) { toast.error("Isi semua nilai indikator sebelum submit"); return; }
    setIsSavingE(true);
    try {
      const total = Math.round(calcTotal() * 100) / 100;
      if (editingEvalId) {
        // Mode edit: UPDATE record yang sudah ada
        const { error: evErr } = await supabase.from("kpi_evaluations").update({
          start_date: evalStartDate, end_date: evalEndDate,
          status: "SUBMITTED", total_score: total,
          qualitative_feedback: evalFeedback || null,
        }).eq("id", editingEvalId);
        if (evErr) throw evErr;
        await supabase.from("kpi_scores").delete().eq("evaluation_id", editingEvalId);
        const { error: scErr } = await supabase.from("kpi_scores").insert(
          selectedTplInds.map(ind => ({ evaluation_id: editingEvalId, indicator_id: ind.id, score: parseFloat(evalScores[ind.id]) }))
        );
        if (scErr) throw scErr;
      } else {
        // Mode create: INSERT baris baru
        for (const empId of evalEmpIds) {
          const { data: ev, error: evErr } = await supabase.from("kpi_evaluations").insert({
            employee_id: empId, evaluator_id: user.id, template_id: evalTplId,
            start_date: evalStartDate, end_date: evalEndDate,
            status: "SUBMITTED" as KpiEvalStatus, total_score: total,
            qualitative_feedback: evalFeedback || null,
          }).select().single();
          if (evErr) throw evErr;
          const { error: scErr } = await supabase.from("kpi_scores").insert(
            selectedTplInds.map(ind => ({ evaluation_id: ev.id, indicator_id: ind.id, score: parseFloat(evalScores[ind.id]) }))
          );
          if (scErr) throw scErr;
        }
      }
      toast.success(editingEvalId ? "Evaluasi berhasil diperbarui!" : `Evaluasi untuk ${evalEmpIds.length} karyawan berhasil disubmit!`);
      setEvalOpen(false); fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setIsSavingE(false); }
  };


  const renderTemplateGrid = (tplList: KpiTemplate[]) => (
    tplList.length === 0
      ? <p className="text-center py-10 text-muted-foreground">Belum ada template KPI.</p>
      : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tplList.map(t => (
            <div key={t.id} className={`flex flex-col h-full border rounded-xl shadow-sm overflow-hidden transition-all hover:shadow-md ${t.is_active === false ? "bg-slate-50/50 border-slate-200" : "bg-white"}`}>
              <div className={`shrink-0 px-4 py-3 border-b flex items-start justify-between gap-2 ${t.is_active === false ? "bg-slate-100/50" : "bg-slate-50/80"}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`font-bold text-sm truncate ${t.is_active === false ? "text-slate-500" : "text-slate-900"}`} title={t.name}>{t.name}</p>
                    {t.is_active === false && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200 text-slate-500">Diarsipkan</span>}
                  </div>
                  {t.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2" title={t.description}>{t.description}</p>}
                  <p className="text-[10px] text-slate-500 mt-1.5 font-medium bg-slate-100 inline-block px-2 py-0.5 rounded-md border border-slate-200/60">
                    SB&ge;{t.threshold_sangat_baik} &middot; B&ge;{t.threshold_baik} &middot; C&ge;{t.threshold_cukup} &middot; Skala {t.scale}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {(isHr || isUnitLeader) && (
                    <>
                      <Button variant="ghost" size="icon" title={t.is_active === false ? "Aktifkan" : "Arsipkan"} className={`h-8 w-8 transition-all transform active:scale-95 text-slate-400 ${t.is_active === false ? "hover:text-emerald-600 hover:bg-emerald-50" : "hover:text-amber-600 hover:bg-amber-50"}`} onClick={() => toggleArchiveTpl(t)}>
                        {t.is_active === false ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/10 transition-all transform active:scale-95" onClick={() => openEditTpl(t)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all transform active:scale-95" onClick={() => requestDeleteTpl(t.id)}><Trash2 className="h-4 w-4" /></Button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[260px] custom-scrollbar">
                <Table><TableHeader><TableRow className="bg-slate-50/50 h-8 border-b border-slate-100 sticky top-0 z-10">
                  <TableHead className="text-xs font-semibold text-slate-600">Indikator</TableHead>
                  <TableHead className="text-xs font-semibold text-right w-20 text-slate-600">Bobot</TableHead>
                </TableRow></TableHeader><TableBody>
                  {getInds(t.id).map(ind => (
                    <TableRow key={ind.id} className="h-auto text-sm border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <TableCell className="py-2">
                        <p className="font-medium text-slate-800">{ind.name}</p>
                        {ind.description && <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{ind.description}</p>}
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary align-top pt-2.5">{ind.weight}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody></Table>
              </div>
            </div>
          ))}
        </div>
  );

  const empList = isHr ? hrLeaders : unitEmployees;
  const toggleEmp = (id: string) => setEvalEmpIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-4">
        <div className="page-header">
          <div>
            <h1 className="page-title">Key Performance Indicator (KPI)</h1>
            {isEmployee && !isUnitLeader && (
              <p className="text-sm text-muted-foreground mt-0.5">
                Daftar riwayat penilaian kinerja Anda.
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {(activeTab === "evaluasi" || activeTab === "kpi-saya" || (isEmployee && !isUnitLeader)) && (
              <div className="flex gap-2">
                {activeTab === "evaluasi" && !(isDirector || isSuperAdmin) && (isHr || isUnitLeader) && (
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[160px] h-9 bg-white/50 shadow-sm border-primary/20 text-sm font-medium transition-all transform active:scale-95 hover:bg-accent hover:text-accent-foreground hover:border-accent">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status</SelectItem>
                      <SelectItem value="DRAFT">Proses Penilaian</SelectItem>
                      <SelectItem value="SUBMITTED">Dipublikasi</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger className="w-[160px] h-9 bg-white/50 shadow-sm border-primary/20 text-sm font-medium transition-all transform active:scale-95 hover:bg-accent hover:text-accent-foreground hover:border-accent">
                    <SelectValue placeholder="Pilih Tahun" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Tahun</SelectItem>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isHr && activeTab === "evaluasi" && (
              <Button size="sm" onClick={() => openCreateEval()} className="gap-2 bg-primary hover:bg-primary/90 shadow-md">
                <Plus className="h-4 w-4" /> Buat Evaluasi
              </Button>
            )}
            {(isHr || isUnitLeader) && activeTab === "template" && (
              <Button size="sm" onClick={openCreateTpl} className="gap-2 bg-primary hover:bg-primary/90 shadow-md">
                <Plus className="h-4 w-4" /> Buat Template
              </Button>
            )}
            {isUnitLeader && activeTab === "evaluasi" && (
              <Button size="sm" onClick={() => openCreateEval()} className="gap-2 bg-primary hover:bg-primary/90 shadow-md">
                <Plus className="h-4 w-4" /> Buat Evaluasi
              </Button>
            )}
          </div>
        </div>

      {isEmployee && !isUnitLeader && (
        <div className="mt-2">
          {loading ? <p className="text-center py-10 text-muted-foreground">Memuat...</p> : renderEvalTable(visibleEvals, false, false)}
        </div>
      )}

      {/* Tampilan HR/Super Admin: 2 tab (Hasil Evaluasi + Template KPI) */}
      {isAdminOrHr && !isUnitLeader && (
        <Tabs defaultValue="evaluasi" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 mb-3 bg-muted/50 h-9 rounded-lg">
            <TabsTrigger value="evaluasi" className="text-xs">Hasil Evaluasi</TabsTrigger>
            <TabsTrigger value="template" className="text-xs">Template KPI</TabsTrigger>
          </TabsList>
          <TabsContent value="evaluasi">
            {loading ? <p className="text-center py-10 text-muted-foreground">Memuat...</p> : renderEvalTable(visibleEvals, isHr)}
          </TabsContent>
          <TabsContent value="template" className="space-y-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau deskripsi template..."
                className="pl-9 h-9 text-sm shadow-sm border-slate-200"
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
              />
            </div>
            {loading ? <p className="text-center py-10 text-muted-foreground">Memuat...</p> : renderTemplateGrid(filteredTemplates)}
          </TabsContent>
        </Tabs>
      )}

      {/* Tampilan Director: Macro-view hanya hasil evaluasi + ringkasan statistik */}
      {isDirector && !isUnitLeader && (() => {
        const submitted = visibleEvals.filter(ev => ev.status === "SUBMITTED" && ev.total_score !== null);
        const avgScore = submitted.length > 0
          ? Math.round(submitted.reduce((s, ev) => s + (ev.total_score ?? 0), 0) / submitted.length * 10) / 10
          : null;
        const countSB = submitted.filter(ev => { const t = templates.find(t => t.id === ev.template_id); return (ev.total_score ?? 0) >= (t?.threshold_sangat_baik ?? 85); }).length;
        const countB  = submitted.filter(ev => { const t = templates.find(t => t.id === ev.template_id); const sb = t?.threshold_sangat_baik ?? 85; return (ev.total_score ?? 0) >= (t?.threshold_baik ?? 70) && (ev.total_score ?? 0) < sb; }).length;
        const countC  = submitted.filter(ev => { const t = templates.find(t => t.id === ev.template_id); const b  = t?.threshold_baik ?? 70; return (ev.total_score ?? 0) >= (t?.threshold_cukup ?? 55) && (ev.total_score ?? 0) < b; }).length;
        const countK  = submitted.filter(ev => { const t = templates.find(t => t.id === ev.template_id); return (ev.total_score ?? 0) < (t?.threshold_cukup ?? 55); }).length;
        return (
          <div className="space-y-4">
            {/* Kartu Ringkasan */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="border rounded-lg bg-white p-3 shadow-sm text-center col-span-2 md:col-span-1">
                <p className="text-xs text-muted-foreground font-medium">Total Evaluasi</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{visibleEvals.length}</p>
              </div>
              <div className="border rounded-lg bg-white p-3 shadow-sm text-center col-span-2 md:col-span-1">
                <p className="text-xs text-muted-foreground font-medium">Rata-rata Nilai</p>
                <p className="text-2xl font-bold text-primary mt-1">{avgScore ?? "—"}</p>
              </div>
              <div className="border rounded-lg bg-[hsl(142,45%,96%)] border-[hsl(142,45%,90%)] p-3 shadow-sm text-center">
                <p className="text-xs text-[hsl(142,45%,25%)] font-medium">Sangat Baik</p>
                <p className="text-2xl font-bold text-[hsl(142,45%,25%)] mt-1">{countSB}</p>
              </div>
              <div className="border rounded-lg bg-[hsl(232,59%,96%)] border-[hsl(232,59%,90%)] p-3 shadow-sm text-center">
                <p className="text-xs text-[hsl(232,59%,21%)] font-medium">Baik</p>
                <p className="text-2xl font-bold text-[hsl(232,59%,21%)] mt-1">{countB}</p>
              </div>
              <div className="border rounded-lg bg-[hsl(38,55%,94%)] border-[hsl(38,55%,88%)] p-3 shadow-sm text-center">
                <p className="text-xs text-[hsl(38,55%,30%)] font-medium">Cukup</p>
                <p className="text-2xl font-bold text-[hsl(38,55%,30%)] mt-1">{countC}</p>
              </div>
              <div className="border rounded-lg bg-[hsl(0,55%,96%)] border-[hsl(0,55%,90%)] p-3 shadow-sm text-center">
                <p className="text-xs text-[hsl(0,55%,35%)] font-medium">Kurang</p>
                <p className="text-2xl font-bold text-[hsl(0,55%,35%)] mt-1">{countK}</p>
              </div>
            </div>
            {/* Tabel Evaluasi (Read-only) */}
            {loading ? <p className="text-center py-10 text-muted-foreground">Memuat...</p> : renderEvalTable(visibleEvals, false)}
          </div>
        );
      })()}

      {isUnitLeader && (
        <Tabs defaultValue="evaluasi" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 mb-3 bg-muted/50 h-9 rounded-lg">
            <TabsTrigger value="evaluasi" className="text-xs">Evaluasi Tim</TabsTrigger>
            <TabsTrigger value="template" className="text-xs">Template KPI</TabsTrigger>
            <TabsTrigger value="kpi-saya" className="text-xs">KPI Saya</TabsTrigger>
          </TabsList>
          <TabsContent value="evaluasi">
            {loading ? <p className="text-center py-10 text-muted-foreground">Memuat...</p> : renderEvalTable(visibleEvals, true)}
          </TabsContent>
          <TabsContent value="template" className="space-y-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau deskripsi template..."
                className="pl-9 h-9 text-sm shadow-sm border-slate-200"
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
              />
            </div>
            {loading ? <p className="text-center py-10 text-muted-foreground">Memuat...</p> : renderTemplateGrid(filteredTemplates)}
          </TabsContent>
          <TabsContent value="kpi-saya">
            {loading ? <p className="text-center py-10 text-muted-foreground">Memuat...</p>
              : myLeaderEvals.length === 0
              ? <p className="text-center py-10 text-muted-foreground">Belum ada evaluasi KPI untuk Anda.</p>
              : renderEvalTable(myLeaderEvals, false, false)}
          </TabsContent>
        </Tabs>
      )}

      {/* Dialog Template */}
      <Dialog open={tplOpen} onOpenChange={setTplOpen}>
        <DialogContent className="sm:max-w-[540px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 border-b bg-muted/30 shrink-0">
            <DialogTitle className="text-xl font-bold tracking-tight">{tplMode === "create" ? "Buat Template KPI" : "Edit Template KPI"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveTpl} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 p-6 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="space-y-2">
                <Label className="text-sm font-bold">Nama Template</Label>
                <Input value={tplName} onChange={e => setTplName(e.target.value)} required className="h-9 text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-bold">Deskripsi</Label>
                <Input value={tplDesc} onChange={e => setTplDesc(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="border rounded-lg overflow-hidden">
                <button type="button" onClick={() => setShowThresh(p => !p)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 text-sm font-semibold text-slate-700 hover:bg-muted/60 transition-colors">
                  <span>Pengaturan Standar Predikat Nilai</span>
                  {showThresh ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showThresh && (
                  <div className="p-4 space-y-3 bg-muted/10">
                    <div className="flex items-center gap-3">
                      <Label className="text-sm w-36 text-slate-600">Skala Nilai</Label>
                      <Select value={tplScale} onValueChange={setTplScale}>
                        <SelectTrigger className="h-9 text-sm flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="100">0 - 100</SelectItem>
                          <SelectItem value="10">0 - 10</SelectItem>
                          <SelectItem value="5">1 - 5</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="text-sm w-36 font-semibold text-emerald-700">Sangat Baik (min)</Label>
                      <Input type="number" min="0" max={tplScale} value={tplThreshSB} onChange={e => setTplThreshSB(e.target.value)} className="h-9 text-sm w-24 text-center" />
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="text-sm w-36 font-semibold text-blue-700">Baik (min)</Label>
                      <Input type="number" min="0" max={tplScale} value={tplThreshB} onChange={e => setTplThreshB(e.target.value)} className="h-9 text-sm w-24 text-center" />
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="text-sm w-36 font-semibold text-amber-700">Cukup (min)</Label>
                      <Input type="number" min="0" max={tplScale} value={tplThreshC} onChange={e => setTplThreshC(e.target.value)} className="h-9 text-sm w-24 text-center" />
                    </div>
                    <p className="text-xs text-muted-foreground">Urutan: Sangat Baik &gt; Baik &gt; Cukup</p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold">Indikator &amp; Bobot</Label>
                  <span className="text-xs text-muted-foreground">Total: <span className={Math.abs(tplInds.reduce((s,i)=>s+(parseFloat(i.weight)||0),0)-100)<0.01?"text-emerald-600 font-bold":"text-red-500 font-bold"}>{tplInds.reduce((s,i)=>s+(parseFloat(i.weight)||0),0)}%</span></span>
                </div>
                <div className="space-y-3">
                  {tplInds.map((ind, idx) => (
                    <div key={idx} className="border rounded-md p-3 space-y-2 bg-muted/20">
                      <div className="flex gap-2 items-center">
                        <Input placeholder="Nama indikator" value={ind.name} onChange={e => { const u=[...tplInds]; u[idx].name=e.target.value; setTplInds(u); }} required className="flex-1 h-9 text-sm" />
                        <Input placeholder="%" type="number" min="1" max="100" value={ind.weight} onChange={e => { const u=[...tplInds]; u[idx].weight=e.target.value; setTplInds(u); }} required className="w-20 h-9 text-sm text-center" />
                        {tplInds.length > 1 && <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => setTplInds(tplInds.filter((_,i)=>i!==idx))}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                      <Textarea placeholder="Rubrik / deskripsi penilaian (opsional)" value={ind.description} onChange={e => { const u=[...tplInds]; u[idx].description=e.target.value; setTplInds(u); }} className="text-xs h-16 resize-none" />
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setTplInds([...tplInds,{name:"",weight:"",description:""}])} className="text-xs">+ Tambah Indikator</Button>
              </div>
            </div>
            <div className="p-6 border-t bg-muted/30 flex justify-end gap-3 shrink-0">
              <Button type="button" variant="outline" className="min-w-[140px] h-10 text-sm" onClick={() => setTplOpen(false)} disabled={isSavingT}>Batal</Button>
              <Button type="submit" disabled={isSavingT} className="min-w-[140px] h-10 shadow-md bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all transform active:scale-95 px-6">{isSavingT ? "Memproses..." : "Simpan Data"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Evaluasi */}
      <Dialog open={evalOpen} onOpenChange={setEvalOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 border-b bg-muted/30 shrink-0">
            <DialogTitle className="text-xl font-bold tracking-tight">{editingEvalId ? "Lanjutkan Evaluasi KPI" : "Buat Evaluasi KPI"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitEval} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 p-6 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="space-y-2">
                <Label className="text-sm font-bold">{isAdminOrHr ? kepalaTerm : "Karyawan"}</Label>
                {editingEvalId ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                    <p className="text-sm font-semibold text-slate-800">
                      {empList.find((e: any) => evalEmpIds.includes(e.id))?.name || "Karyawan"}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="border rounded-md max-h-40 overflow-y-auto divide-y">
                      {empList.length === 0 ? <p className="text-xs text-muted-foreground p-3">Tidak ada karyawan tersedia.</p>
                        : empList.map((e: any) => (
                          <label key={e.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40 cursor-pointer">
                            <Checkbox checked={evalEmpIds.includes(e.id)} onCheckedChange={() => toggleEmp(e.id)} />
                            <span className="text-sm">{e.name}</span>
                          </label>
                        ))}
                    </div>
                    {evalEmpIds.length > 0 && <p className="text-xs text-primary font-medium">{evalEmpIds.length} karyawan dipilih</p>}
                  </>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-bold">Template KPI</Label>
                <Select value={evalTplId} onValueChange={v => { setEvalTplId(v); setEvalScores({}); }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pilih template" /></SelectTrigger>
                  <SelectContent>{templates.filter(t => t.is_active !== false).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-bold flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Periode Evaluasi</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Tanggal Mulai</Label>
                    <Input type="date" value={evalStartDate} onChange={e => setEvalStartDate(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Tanggal Selesai</Label>
                    <Input type="date" value={evalEndDate} min={evalStartDate} onChange={e => setEvalEndDate(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
              </div>
              {selectedTplInds.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-bold">Nilai per Indikator</Label>
                  {selectedTplInds.map(ind => {
                    const tpl = templates.find(t => t.id === evalTplId);
                    return (
                      <div key={ind.id} className="flex items-start gap-3">
                        <div className="flex-1">
                          <p className="text-sm text-slate-700">{ind.name} <span className="text-xs text-muted-foreground">({ind.weight}%)</span></p>
                          {ind.description && <p className="text-xs text-muted-foreground mt-0.5">{ind.description}</p>}
                        </div>
                        <Input type="number" min="0" max={tpl?.scale ?? 100} placeholder={"0-"+(tpl?.scale ?? 100)}
                          value={evalScores[ind.id] ?? ""} onChange={e => setEvalScores({...evalScores, [ind.id]: e.target.value})}
                          className="w-24 h-9 text-sm text-center shrink-0" />
                      </div>
                    );
                  })}
                  {Object.keys(evalScores).length === selectedTplInds.length && selectedTplInds.length > 0 && (
                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-md">
                      <p className="text-sm font-bold text-primary">Estimasi Nilai Akhir: {Math.round(calcTotal() * 100) / 100}</p>
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-sm font-bold">Catatan <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                <Textarea placeholder="Tulis catatan kualitatif untuk karyawan..." value={evalFeedback} onChange={e => setEvalFeedback(e.target.value)} className="text-sm h-20 resize-none" />
              </div>
            </div>
            <div className="p-6 border-t bg-muted/30 flex justify-end gap-3 shrink-0">
              <Button type="button" variant="outline" className="min-w-[140px] h-10 text-sm" onClick={() => setEvalOpen(false)} disabled={isSavingE}>Batal</Button>
              <Button type="button" onClick={handleSaveDraft} disabled={isSavingE} variant="outline" className="min-w-[140px] h-10 text-sm bg-white shadow-sm border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 font-semibold transition-all transform active:scale-95">
                {isSavingE ? "..." : "Simpan Draft"}
              </Button>
              <Button type="submit" disabled={isSavingE} className="min-w-[140px] h-10 shadow-md bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all transform active:scale-95 px-6">
                {isSavingE ? "Memproses..." : "Submit Evaluasi"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      </div>

      {/* Konfirmasi Hapus Template */}
      <ConfirmDeleteDialog
        open={!!deleteTplId}
        onOpenChange={(op) => !op && setDeleteTplId(null)}
        itemName={deleteTplId ? templates.find(t => t.id === deleteTplId)?.name : ""}
        description={<p>Apakah Anda yakin ingin menghapus template ini beserta seluruh indikatornya? Tindakan ini tidak dapat dibatalkan.</p>}
        onConfirm={confirmDeleteTpl}
        isLoading={isDeletingTpl}
      />
      {/* Dialog View Evaluasi */}
      <Dialog open={viewEvalOpen} onOpenChange={setViewEvalOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
          {viewingEval && (
            <>
              <DetailHeader title="Detail Evaluasi KPI" />
              
              <div className="flex-1 p-6 space-y-10 overflow-y-auto custom-scrollbar">
                
                <DetailSection icon={Target} title="Informasi Evaluasi">
                  <DetailItem label="Karyawan" value={viewingEval.employees?.name} />
                  <DetailItem label="Dinilai Oleh" value={employeeMap[viewingEval.evaluator_id]} />
                  <DetailItem label="Periode" value={formatDateRange(viewingEval)} />
                  <DetailItem 
                    label="Nilai Akhir" 
                    value={
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary">{viewingEval.total_score ?? "—"}</span>
                        {viewingEval.total_score ? getScoreBadge(viewingEval.total_score, templates.find(t => t.id === viewingEval.template_id)) : null}
                      </div>
                    } 
                  />
                </DetailSection>

                <DetailSection icon={BarChart3} title="Nilai per Indikator">
                  <div className="md:col-span-2 space-y-2">
                    {indicators.filter(i => i.template_id === viewingEval.template_id).map(ind => {
                      const scoreRec = scores.find(s => s.evaluation_id === viewingEval.id && s.indicator_id === ind.id);
                      return (
                        <div key={ind.id} className="flex items-start justify-between gap-3 p-3 bg-slate-50 rounded border border-slate-100">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-800">{ind.name} <span className="text-xs text-muted-foreground font-normal">({ind.weight}%)</span></p>
                            {ind.description && <p className="text-xs text-muted-foreground mt-0.5">{ind.description}</p>}
                          </div>
                          <div className="shrink-0 w-16 text-center bg-white border rounded py-1 font-bold text-sm text-slate-700">
                            {scoreRec?.score ?? "—"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </DetailSection>

                {viewingEval.qualitative_feedback && (
                  <DetailSection icon={AlignLeft} title="Catatan Penilai">
                    <div className="md:col-span-2 p-4 bg-amber-50 border border-amber-100 rounded-md text-sm text-slate-800 whitespace-pre-wrap">
                      {viewingEval.qualitative_feedback}
                    </div>
                  </DetailSection>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
