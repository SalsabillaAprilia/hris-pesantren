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
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2, BarChart3, Pencil, Users, Calendar, ChevronDown, ChevronUp } from "lucide-react";
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
  employees?: { name: string; unit_id: string | null; user_id?: string };
}

interface IndicatorRow { name: string; weight: string; description: string; }

let globalKpiTemplatesCache: KpiTemplate[] | null = null;
let globalKpiIndicatorsCache: KpiIndicator[] | null = null;
let globalKpiEvaluationsCache: KpiEvaluation[] | null = null;
let globalKpiScoresCache: any[] | null = null;
let globalKpiUnitEmployeesCache: any[] | null = null;
let globalKpiHrLeadersCache: any[] | null = null;

export default function KPI() {
  const { user, employee, isAdminOrHr, hasRole } = useAuth();
  const isUnitLeader = hasRole("unit_leader");
  const isEmployee   = hasRole("employee");

  const [templates,     setTemplates]     = useState<KpiTemplate[]>(globalKpiTemplatesCache || []);
  const [indicators,    setIndicators]    = useState<KpiIndicator[]>(globalKpiIndicatorsCache || []);
  const [evaluations,   setEvaluations]   = useState<KpiEvaluation[]>(globalKpiEvaluationsCache || []);
  const [scores,        setScores]        = useState<any[]>(globalKpiScoresCache || []);
  const [unitEmployees, setUnitEmployees] = useState<any[]>(globalKpiUnitEmployeesCache || []);
  const [hrLeaders,     setHrLeaders]     = useState<any[]>(globalKpiHrLeadersCache || []);
  const [loading,       setLoading]       = useState(globalKpiTemplatesCache === null);

  const isFirstFetch = useRef(globalKpiTemplatesCache === null);
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
  const [evalEmpIds,     setEvalEmpIds]     = useState<string[]>([]);
  const [evalTplId,      setEvalTplId]      = useState("");
  const [evalStartDate,  setEvalStartDate]  = useState("");
  const [evalEndDate,    setEvalEndDate]    = useState("");
  const [evalScores,     setEvalScores]     = useState<Record<string,string>>({});
  const [evalFeedback,   setEvalFeedback]   = useState("");
  const [isSavingE,      setIsSavingE]      = useState(false);
  const [isBatchMode,    setIsBatchMode]    = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (isFirstFetch.current) setLoading(true);
    try {
      const [tRes, iRes, eRes, sRes, empRes] = await supabaseFetchWithTimeout(
        Promise.all([
          supabase.from("kpi_templates").select("*").order("created_at", { ascending: false }),
          supabase.from("kpi_indicators").select("*"),
          supabase.from("kpi_evaluations")
            .select("*, employees!kpi_evaluations_employee_id_fkey(name,unit_id,user_id)")
            .order("created_at", { ascending: false }),
          supabase.from("kpi_scores").select("*"),
          supabase.from("employees").select("id,name,unit_id,user_id").eq("status","active"),
        ])
      );
      if (tRes.error) throw tRes.error;
      if (iRes.error) throw iRes.error;
      if (eRes.error) throw eRes.error;

      const rolesRes = await supabase.from("user_roles").select("user_id,role");
      const rolesMap = Object.fromEntries((rolesRes.data ?? []).map((r:any) => [r.user_id, r.role]));
      let emps = (empRes.data ?? []).filter((e:any) => !["super_admin","hr"].includes(rolesMap[e.user_id]));
      if (isUnitLeader && employee?.unit_id) {
        emps = emps.filter((e:any) => e.unit_id === employee.unit_id);
      }
      const hrLdrs = (empRes.data ?? []).filter((e:any) => rolesMap[e.user_id] === "unit_leader");

      if (isMounted.current) {
        setTemplates((tRes.data ?? []) as KpiTemplate[]);
        setIndicators((iRes.data ?? []) as KpiIndicator[]);
        setEvaluations((eRes.data ?? []) as KpiEvaluation[]);
        setScores(sRes.data ?? []);
        setUnitEmployees(emps);
        setHrLeaders(hrLdrs);
        
        globalKpiTemplatesCache = (tRes.data ?? []) as KpiTemplate[];
        globalKpiIndicatorsCache = (iRes.data ?? []) as KpiIndicator[];
        globalKpiEvaluationsCache = (eRes.data ?? []) as KpiEvaluation[];
        globalKpiScoresCache = sRes.data ?? [];
        globalKpiUnitEmployeesCache = emps;
        globalKpiHrLeadersCache = hrLdrs;
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
  }, [isUnitLeader, employee?.unit_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Computed values ───────────────────────────────────────────────────────
  const getInds = (tplId: string) => indicators.filter(i => i.template_id === tplId);

  const myTemplates = useMemo(() =>
    isUnitLeader ? templates.filter(t => t.created_by === user?.id) : templates,
  [templates, isUnitLeader, user?.id]);

  const hrTemplates = useMemo(() => templates.filter(t => t.created_by === user?.id), [templates, user?.id]);

  const selectedTplInds = useMemo(() => getInds(evalTplId), [evalTplId, indicators]);

  const visibleEvals = useMemo(() => {
    if (isEmployee && !isUnitLeader)
      return evaluations.filter(ev => ev.employees?.user_id === user?.id || ev.employee_id === employee?.id);
    if (isUnitLeader && !isAdminOrHr && employee?.unit_id)
      return evaluations.filter(ev => ev.employees?.unit_id === employee.unit_id && ev.employee_id !== employee?.id);
    return evaluations;
  }, [evaluations, isEmployee, isUnitLeader, isAdminOrHr, user?.id, employee]);

  const myLeaderEvals = useMemo(() =>
    evaluations.filter(ev => ev.employee_id === employee?.id),
  [evaluations, employee?.id]);

  // ── Badge helpers ─────────────────────────────────────────────────────────
  const getScoreBadge = (score: number, tpl?: KpiTemplate) => {
    const sb = tpl?.threshold_sangat_baik ?? 85;
    const b  = tpl?.threshold_baik        ?? 70;
    const c  = tpl?.threshold_cukup       ?? 55;
    if (score >= sb) return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">Sangat Baik</span>;
    if (score >= b)  return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200">Baik</span>;
    if (score >= c)  return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-50 text-amber-700 border border-amber-200">Cukup</span>;
    return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-red-50 text-red-700 border border-red-200">Kurang</span>;
  };

  const getStatusBadge = (status: KpiEvalStatus) => {
    const map: Record<KpiEvalStatus, string> = {
      TODO:      "bg-slate-100 text-slate-600 border-slate-200",
      DRAFT:     "bg-amber-50 text-amber-700 border-amber-200",
      SUBMITTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
    const label: Record<KpiEvalStatus, string> = { TODO:"Belum Mulai", DRAFT:"Draft", SUBMITTED:"Terkirim" };
    return <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${map[status]}`}>{label[status]}</span>;
  };

  const formatDateRange = (ev: KpiEvaluation) => {
    if (!ev.start_date && !ev.end_date) return "—";
    const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" });
    if (ev.start_date && ev.end_date) return `${fmt(ev.start_date)} – ${fmt(ev.end_date)}`;
    return fmt((ev.start_date ?? ev.end_date)!);
  };

  // ── renderEvalTable ───────────────────────────────────────────────────────
  const renderEvalTable = (data: KpiEvaluation[]) => (
    <div className="border rounded-md bg-white overflow-x-auto">
      <Table className="text-sm min-w-[700px]">
        <TableHeader>
          <TableRow className="h-10 bg-muted">
            <TableHead className="w-10 text-center border-r border-gray-200">No.</TableHead>
            <TableHead className="border-r border-gray-200">Karyawan</TableHead>
            <TableHead className="border-r border-gray-200 w-[160px]">Periode</TableHead>
            <TableHead className="border-r border-gray-200">Template</TableHead>
            <TableHead className="border-r border-gray-200 w-[90px] text-center">Nilai</TableHead>
            <TableHead className="border-r border-gray-200 w-[110px] text-center">Predikat</TableHead>
            <TableHead className="w-[110px] text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Belum ada evaluasi.</TableCell></TableRow>
          ) : data.map((ev, idx) => {
            const tpl = templates.find(t => t.id === ev.template_id);
            return (
              <TableRow key={ev.id} className="h-11 border-b border-gray-200 hover:bg-muted/50">
                <TableCell className="text-center text-slate-500">{idx + 1}</TableCell>
                <TableCell className="font-medium">{ev.employees?.name ?? "—"}</TableCell>
                <TableCell className="text-xs text-slate-600">{formatDateRange(ev)}</TableCell>
                <TableCell className="text-slate-700">{tpl?.name ?? "—"}</TableCell>
                <TableCell className="text-center font-bold text-slate-900">{ev.total_score ?? "—"}</TableCell>
                <TableCell className="text-center">{ev.total_score ? getScoreBadge(ev.total_score, tpl) : "—"}</TableCell>
                <TableCell className="text-center">{getStatusBadge(ev.status)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
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

  const deleteTpl = async (id: string) => {
    const { data: usedEvals, error: checkErr } = await supabase.from("kpi_evaluations").select("id").eq("template_id", id).limit(1);
    if (checkErr) { toast.error(checkErr.message); return; }
    if (usedEvals && usedEvals.length > 0) { toast.error("Template tidak dapat dihapus karena sudah digunakan untuk evaluasi."); return; }
    if (!confirm("Hapus template ini beserta semua indikatornya?")) return;
    try {
      await supabase.from("kpi_indicators").delete().eq("template_id", id);
      await supabase.from("kpi_templates").delete().eq("id", id);
      toast.success("Template dihapus."); fetchData();
    } catch (err: any) { toast.error("Gagal menghapus: " + err.message); }
  };

  // ── Evaluation handlers ───────────────────────────────────────────────────
  const openCreateEval = () => {
    setIsBatchMode(false);
    setEvalEmpIds([]); setEvalTplId(""); setEvalStartDate(""); setEvalEndDate("");
    setEvalScores({}); setEvalFeedback(""); setEvalOpen(true);
  };

  const calcTotal = () => selectedTplInds.reduce((sum, ind) =>
    sum + ((parseFloat(evalScores[ind.id])||0) * ind.weight / 100), 0);

  const handleBatchCreate = async () => {
    if (!user || !evalTplId || evalEmpIds.length === 0) { toast.error("Pilih template dan minimal 1 karyawan"); return; }
    setIsSavingE(true);
    try {
      const rows = evalEmpIds.map(empId => ({
        employee_id: empId, evaluator_id: user.id, template_id: evalTplId,
        start_date: evalStartDate || null, end_date: evalEndDate || null,
        status: "TODO" as KpiEvalStatus, qualitative_feedback: null,
      }));
      const { error } = await supabase.from("kpi_evaluations").insert(rows);
      if (error) throw error;
      toast.success(`${evalEmpIds.length} rencana evaluasi berhasil dibuat!`);
      setEvalOpen(false); fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setIsSavingE(false); }
  };

  const handleSaveDraft = async () => {
    if (!user || evalEmpIds.length === 0 || !evalTplId) { toast.error("Pilih template dan karyawan"); return; }
    setIsSavingE(true);
    try {
      const total = Math.round(calcTotal() * 100) / 100;
      const rows = evalEmpIds.map(empId => ({
        employee_id: empId, evaluator_id: user.id, template_id: evalTplId,
        start_date: evalStartDate || null, end_date: evalEndDate || null,
        status: "DRAFT" as KpiEvalStatus, total_score: total || null,
        qualitative_feedback: evalFeedback || null,
      }));
      const { error } = await supabase.from("kpi_evaluations").insert(rows);
      if (error) throw error;
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
      toast.success(`Evaluasi untuk ${evalEmpIds.length} karyawan berhasil disubmit!`);
      setEvalOpen(false); fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setIsSavingE(false); }
  };


  const renderTemplateGrid = (tplList: KpiTemplate[]) => (
    tplList.length === 0
      ? <p className="text-center py-10 text-muted-foreground">Belum ada template KPI.</p>
      : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tplList.map(t => (
            <div key={t.id} className="border rounded-lg bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-slate-900">{t.name}</p>
                  {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
                  <p className="text-[10px] text-slate-400 mt-1">SB&ge;{t.threshold_sangat_baik} &middot; B&ge;{t.threshold_baik} &middot; C&ge;{t.threshold_cukup} &middot; Skala {t.scale}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => openEditTpl(t)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteTpl(t.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <Table><TableHeader><TableRow className="bg-muted/20 h-8">
                <TableHead className="text-xs font-semibold">Indikator</TableHead>
                <TableHead className="text-xs font-semibold text-right w-20">Bobot</TableHead>
              </TableRow></TableHeader><TableBody>
                {getInds(t.id).map(ind => (
                  <TableRow key={ind.id} className="h-auto text-sm">
                    <TableCell className="py-2">
                      <p>{ind.name}</p>
                      {ind.description && <p className="text-xs text-muted-foreground mt-0.5">{ind.description}</p>}
                    </TableCell>
                    <TableCell className="text-right font-medium text-primary">{ind.weight}%</TableCell>
                  </TableRow>
                ))}
              </TableBody></Table>
            </div>
          ))}
        </div>
  );

  const empList = isAdminOrHr ? hrLeaders : unitEmployees;
  const toggleEmp = (id: string) => setEvalEmpIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <DashboardLayout>
      <div className="page-header flex items-center justify-between">
        <h1 className="page-title flex items-center gap-2"><BarChart3 className="h-6 w-6 text-primary" /> KPI</h1>
      </div>

      {isEmployee && !isUnitLeader && (
        <div>
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Evaluasi KPI Saya</h2>
          {loading ? <p className="text-center py-10 text-muted-foreground">Memuat...</p> : renderEvalTable(visibleEvals)}
        </div>
      )}

      {isAdminOrHr && !isUnitLeader && (
        <Tabs defaultValue="monitoring" className="w-full">
          <TabsList className="h-9 bg-muted/50 rounded-lg mb-4">
            <TabsTrigger value="monitoring" className="text-xs">Semua Hasil Evaluasi</TabsTrigger>
            <TabsTrigger value="evaluasi-leader" className="text-xs">Evaluasi Kepala Unit</TabsTrigger>
            <TabsTrigger value="template" className="text-xs">Template KPI</TabsTrigger>
          </TabsList>
          <TabsContent value="monitoring">
            {loading ? <p className="text-center py-10 text-muted-foreground">Memuat...</p> : renderEvalTable(visibleEvals)}
          </TabsContent>
          <TabsContent value="evaluasi-leader">
            <div className="flex justify-end mb-3">
              <Button size="sm" onClick={() => openCreateEval()} className="gap-2 bg-primary hover:bg-primary/90 shadow-md"><Plus className="h-4 w-4" /> Buat Evaluasi</Button>
            </div>
            {loading ? <p className="text-center py-10 text-muted-foreground">Memuat...</p>
              : renderEvalTable(evaluations.filter(ev => hrLeaders.some(l => l.id === ev.employee_id)))}
          </TabsContent>
          <TabsContent value="template">
            <div className="flex justify-end mb-3">
              <Button size="sm" onClick={openCreateTpl} className="gap-2 bg-primary hover:bg-primary/90 shadow-md"><Plus className="h-4 w-4" /> Buat Template</Button>
            </div>
            {loading ? <p className="text-center py-10 text-muted-foreground">Memuat...</p> : renderTemplateGrid(hrTemplates)}
          </TabsContent>
        </Tabs>
      )}

      {isUnitLeader && (
        <Tabs defaultValue="template" className="w-full">
          <TabsList className="h-9 bg-muted/50 rounded-lg mb-4">
            <TabsTrigger value="template" className="text-xs">Template KPI</TabsTrigger>
            <TabsTrigger value="evaluasi" className="text-xs">Evaluasi Tim</TabsTrigger>
            <TabsTrigger value="kpi-saya" className="text-xs">KPI Saya</TabsTrigger>
          </TabsList>
          <TabsContent value="template">
            <div className="flex justify-end mb-3">
              <Button size="sm" onClick={openCreateTpl} className="gap-2 bg-primary hover:bg-primary/90 shadow-md"><Plus className="h-4 w-4" /> Buat Template</Button>
            </div>
            {loading ? <p className="text-center py-10 text-muted-foreground">Memuat...</p> : renderTemplateGrid(myTemplates)}
          </TabsContent>
          <TabsContent value="evaluasi">
            <div className="flex justify-end mb-3">
              <Button size="sm" onClick={() => openCreateEval()} className="gap-2 bg-primary hover:bg-primary/90 shadow-md"><Plus className="h-4 w-4" /> Buat Evaluasi</Button>
            </div>
            {loading ? <p className="text-center py-10 text-muted-foreground">Memuat...</p> : renderEvalTable(visibleEvals)}
          </TabsContent>
          <TabsContent value="kpi-saya">
            {loading ? <p className="text-center py-10 text-muted-foreground">Memuat...</p>
              : myLeaderEvals.length === 0
              ? <p className="text-center py-10 text-muted-foreground">Belum ada evaluasi KPI untuk Anda.</p>
              : renderEvalTable(myLeaderEvals)}
          </TabsContent>
        </Tabs>
      )}

      {/* Dialog Template */}
      <Dialog open={tplOpen} onOpenChange={setTplOpen}>
        <DialogContent className="sm:max-w-[540px] p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 border-b bg-muted/30">
            <DialogTitle className="text-xl font-bold">{tplMode === "create" ? "Buat Template KPI" : "Edit Template KPI"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveTpl} className="flex flex-col">
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
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
            <div className="p-6 border-t bg-muted/30 flex justify-end gap-3">
              <Button type="button" variant="outline" className="h-10 min-w-[100px]" onClick={() => setTplOpen(false)} disabled={isSavingT}>Batal</Button>
              <Button type="submit" disabled={isSavingT} className="h-10 min-w-[140px] bg-primary hover:bg-primary/90 font-bold">{isSavingT ? "Menyimpan..." : "Simpan"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Evaluasi */}
      <Dialog open={evalOpen} onOpenChange={setEvalOpen}>
        <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 border-b bg-muted/30">
            <DialogTitle className="text-xl font-bold">Buat Evaluasi KPI</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Pilih karyawan dan template untuk memulai evaluasi.</p>
          </DialogHeader>
          <form onSubmit={handleSubmitEval} className="flex flex-col">
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              <div className="space-y-2">
                <Label className="text-sm font-bold">{isAdminOrHr ? "Kepala Unit" : "Karyawan"}</Label>
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
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-bold">Template KPI</Label>
                <Select value={evalTplId} onValueChange={v => { setEvalTplId(v); setEvalScores({}); }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pilih template" /></SelectTrigger>
                  <SelectContent>{(isAdminOrHr ? hrTemplates : myTemplates).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
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
              <div className="flex items-center gap-3 border p-3 rounded-md bg-slate-50 border-slate-200">
                <Checkbox id="fill-later" checked={isBatchMode} onCheckedChange={(c) => setIsBatchMode(!!c)} />
                <div className="space-y-0.5">
                  <Label htmlFor="fill-later" className="text-sm font-bold cursor-pointer">Isi Nilai Nanti</Label>
                  <p className="text-xs text-muted-foreground">Hanya simpan draf rencana evaluasi untuk diisi di lain waktu.</p>
                </div>
              </div>
              {!isBatchMode && selectedTplInds.length > 0 && (
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
              {!isBatchMode && (
                <div className="space-y-2">
                  <Label className="text-sm font-bold">Catatan Manajer <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                  <Textarea placeholder="Tulis catatan kualitatif untuk karyawan..." value={evalFeedback} onChange={e => setEvalFeedback(e.target.value)} className="text-sm h-20 resize-none" />
                </div>
              )}
            </div>
            <div className="p-6 border-t bg-muted/30 flex justify-end gap-2">
              <Button type="button" variant="outline" className="h-10 min-w-[90px]" onClick={() => setEvalOpen(false)} disabled={isSavingE}>Batal</Button>
              {isBatchMode ? (
                <Button type="button" onClick={handleBatchCreate} disabled={isSavingE} className="h-10 min-w-[160px] bg-primary hover:bg-primary/90 font-bold">
                  {isSavingE ? "Membuat..." : ("Buat "+(evalEmpIds.length > 0 ? "("+evalEmpIds.length+")" : "")+" Rencana Evaluasi")}
                </Button>
              ) : (
                <>
                  <Button type="button" onClick={handleSaveDraft} disabled={isSavingE} variant="outline" className="h-10 min-w-[120px] border-amber-400 text-amber-700 hover:bg-amber-50 font-semibold">
                    {isSavingE ? "..." : "Simpan Draft"}
                  </Button>
                  <Button type="submit" disabled={isSavingE} className="h-10 min-w-[140px] bg-primary hover:bg-primary/90 font-bold">
                    {isSavingE ? "Menyimpan..." : "Submit Evaluasi"}
                  </Button>
                </>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
