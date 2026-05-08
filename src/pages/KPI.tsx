import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2, BarChart3, Pencil } from "lucide-react";
import { supabaseFetchWithTimeout } from "@/utils/supabase-fetch";

export default function KPI() {
  const { user, employee, isAdminOrHr, hasRole } = useAuth();
  const isUnitLeader = hasRole("unit_leader");
  const isEmployee   = hasRole("employee");
  const isSuperAdmin = hasRole("super_admin");

  // ── KPI Settings (controlled by super admin) ──────────────────────────────────
  const [settings, setSettings] = useState({
    scale: 100,
    threshold_sangat_baik: 85,
    threshold_baik: 70,
    threshold_cukup: 55,
  });
  const [settingsForm, setSettingsForm] = useState({ ...settings });
  const [isSavingS, setIsSavingS] = useState(false);

  const [templates,    setTemplates]    = useState<any[]>([]);
  const [indicators,   setIndicators]   = useState<any[]>([]);
  const [evaluations,  setEvaluations]  = useState<any[]>([]);
  const [scores,       setScores]       = useState<any[]>([]);
  const [unitEmployees,setUnitEmployees]= useState<any[]>([]);
  const [hrLeaders,    setHrLeaders]    = useState<any[]>([]); // unit_leader employees (for HR to evaluate)
  const [loading,      setLoading]      = useState(true);

  // ── Template dialog ──────────────────────────────────────────────────────────
  const [tplOpen,    setTplOpen]    = useState(false);
  const [tplMode,    setTplMode]    = useState<"create"|"edit">("create");
  const [editTplId,  setEditTplId]  = useState<string|null>(null);
  const [tplName,    setTplName]    = useState("");
  const [tplDesc,    setTplDesc]    = useState("");
  const [tplInds,    setTplInds]    = useState([{ name:"", weight:"" }]);
  const [isSavingT,  setIsSavingT]  = useState(false);

  // ── Evaluation dialog ────────────────────────────────────────────────────────
  const [evalOpen,   setEvalOpen]   = useState(false);
  const [evalEmpId,  setEvalEmpId]  = useState("");
  const [evalTplId,  setEvalTplId]  = useState("");
  const [evalPeriod, setEvalPeriod] = useState("");
  const [evalScores, setEvalScores] = useState<Record<string,string>>({});
  const [isSavingE,  setIsSavingE]  = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    try {
      const [tRes, iRes, eRes, sRes, empRes] = await supabaseFetchWithTimeout(
        Promise.all([
          supabase.from("kpi_templates").select("*").order("created_at", { ascending: false }),
          supabase.from("kpi_indicators").select("*"),
          supabase.from("kpi_evaluations").select("*, employees!kpi_evaluations_employee_id_fkey(name,unit_id)").order("created_at", { ascending: false }),
          supabase.from("kpi_scores").select("*"),
          supabase.from("employees").select("id,name,unit_id,user_id").eq("status","active"),
        ])
      );
      if (tRes.error) throw tRes.error;
      if (iRes.error) throw iRes.error;
      if (eRes.error) throw eRes.error;

      setTemplates(tRes.data ?? []);
      setIndicators(iRes.data ?? []);
      setEvaluations(eRes.data ?? []);
      setScores(sRes.data ?? []);

      // Fetch KPI settings
      const { data: settingsData } = await supabase.from("kpi_settings" as any).select("key,value");
      if (settingsData && settingsData.length > 0) {
        const map: Record<string,string> = Object.fromEntries((settingsData as any[]).map((s:any) => [s.key, s.value]));
        const parsed = {
          scale:                   parseInt(map.scale ?? "100"),
          threshold_sangat_baik:   parseInt(map.threshold_sangat_baik ?? "85"),
          threshold_baik:          parseInt(map.threshold_baik ?? "70"),
          threshold_cukup:         parseInt(map.threshold_cukup ?? "55"),
        };
        setSettings(parsed);
        setSettingsForm(parsed);
      }

      // Filter employees for unit leader's unit (exclude admin/HR)
      const rolesRes = await supabase.from("user_roles").select("user_id,role");
      const rolesMap = Object.fromEntries((rolesRes.data ?? []).map((r:any) => [r.user_id, r.role]));
      let emps = (empRes.data ?? []).filter((e:any) => !["super_admin","hr"].includes(rolesMap[e.user_id]));
      if (isUnitLeader && employee?.unit_id) {
        emps = emps.filter((e:any) => e.unit_id === employee.unit_id);
      }
      setUnitEmployees(emps);
      // HR: list of unit_leader employees to evaluate
      setHrLeaders((empRes.data ?? []).filter((e:any) => rolesMap[e.user_id] === "unit_leader"));
    } catch (err) {
      console.error("KPI fetch error:", err);
      toast.error("Gagal memuat data KPI.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [employee?.id]);

  // ── Template helpers ─────────────────────────────────────────────────────────
  const myTemplates = useMemo(() =>
    isUnitLeader ? templates.filter(t => t.created_by === user?.id) : templates,
  [templates, isUnitLeader, user?.id]);

  const getInds = (tplId: string) => indicators.filter(i => i.template_id === tplId);

  const openCreateTpl = () => {
    setTplMode("create"); setEditTplId(null);
    setTplName(""); setTplDesc(""); setTplInds([{ name:"", weight:"" }]);
    setTplOpen(true);
  };

  const openEditTpl = (t: any) => {
    setTplMode("edit"); setEditTplId(t.id);
    setTplName(t.name); setTplDesc(t.description ?? "");
    setTplInds(getInds(t.id).map(i => ({ name: i.name, weight: String(i.weight) })));
    setTplOpen(true);
  };

  const handleSaveTpl = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = tplInds.reduce((s, i) => s + (parseFloat(i.weight)||0), 0);
    if (Math.abs(total - 100) > 0.01) { toast.error("Total bobot harus 100%"); return; }
    if (!user) return;
    setIsSavingT(true);
    let newTplId: string | null = null;
    try {
      let tplId = editTplId;
      if (tplMode === "create") {
        const { data, error } = await supabase.from("kpi_templates")
          .insert({ name: tplName, description: tplDesc || null, created_by: user.id })
          .select().single();
        if (error) throw error;
        tplId = data.id;
        newTplId = data.id; // simpan untuk rollback jika indikator gagal
      } else {
        const { error } = await supabase.from("kpi_templates")
          .update({ name: tplName, description: tplDesc || null }).eq("id", tplId!);
        if (error) throw error;
        // Hapus indikator lama dulu — cek error agar tidak duplikat
        const { error: delErr } = await supabase.from("kpi_indicators").delete().eq("template_id", tplId!);
        if (delErr) throw delErr;
      }
      // Simpan indikator
      const { error: indErr } = await supabase.from("kpi_indicators").insert(
        tplInds.map(i => ({ template_id: tplId!, name: i.name, weight: parseFloat(i.weight) }))
      );
      if (indErr) {
        // Rollback: hapus template yang baru dibuat jika indikator gagal
        if (newTplId) await supabase.from("kpi_templates").delete().eq("id", newTplId);
        throw indErr;
      }
      toast.success(tplMode === "create" ? "Template dibuat!" : "Template diperbarui!");
      setTplOpen(false); fetchData();
    } catch (err: any) { toast.error("Gagal: " + err.message); }
    finally { setIsSavingT(false); }
  };


  const deleteTpl = async (id: string) => {
    try {
      // Cek apakah template sudah pernah dipakai evaluasi
      const { data: usedEvals, error: checkErr } = await supabase
        .from("kpi_evaluations").select("id").eq("template_id", id).limit(1);
      if (checkErr) throw checkErr;

      if (usedEvals && usedEvals.length > 0) {
        toast.error("Template tidak dapat dihapus karena sudah digunakan untuk evaluasi karyawan. Riwayat penilaian harus dijaga.");
        return;
      }

      if (!confirm("Hapus template ini beserta semua indikatornya?")) return;

      // Aman dihapus — belum ada evaluasi yang menggunakan template ini
      const { error: indErr } = await supabase.from("kpi_indicators").delete().eq("template_id", id);
      if (indErr) throw indErr;
      const { error: tplErr } = await supabase.from("kpi_templates").delete().eq("id", id);
      if (tplErr) throw tplErr;
      toast.success("Template dihapus.");
      fetchData();
    } catch (err: any) {
      toast.error("Gagal menghapus: " + err.message);
    }
  };


  // ── Evaluation helpers ───────────────────────────────────────────────────────
  const selectedTplInds = useMemo(() => getInds(evalTplId), [evalTplId, indicators]);

  const openCreateEval = () => {
    setEvalEmpId(""); setEvalTplId(""); setEvalPeriod(""); setEvalScores({});
    setEvalOpen(true);
  };

  const handleSaveEval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !evalEmpId || !evalTplId || !evalPeriod) { toast.error("Lengkapi semua field"); return; }
    const allFilled = selectedTplInds.every(i => evalScores[i.id] !== undefined && evalScores[i.id] !== "");
    if (!allFilled) { toast.error("Isi semua nilai indikator"); return; }

    // Hitung total score (weighted average)
    const totalScore = selectedTplInds.reduce((sum, ind) => {
      return sum + ((parseFloat(evalScores[ind.id])||0) * ind.weight / 100);
    }, 0);

    setIsSavingE(true);
    try {
      const { data: ev, error: evErr } = await supabase.from("kpi_evaluations").insert({
        employee_id: evalEmpId,
        evaluator_id: user.id,
        template_id: evalTplId,
        period: evalPeriod,
        total_score: Math.round(totalScore * 100) / 100,
      }).select().single();
      if (evErr) throw evErr;

      await supabase.from("kpi_scores").insert(
        selectedTplInds.map(ind => ({
          evaluation_id: ev.id,
          indicator_id: ind.id,
          score: parseFloat(evalScores[ind.id]),
        }))
      );
      toast.success("Evaluasi KPI berhasil disimpan!");
      setEvalOpen(false); fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setIsSavingE(false); }
  };

  const getScoreBadge = (score: number) => {
    if (score >= settings.threshold_sangat_baik) return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">Sangat Baik</span>;
    if (score >= settings.threshold_baik)        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200">Baik</span>;
    if (score >= settings.threshold_cukup)       return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-50 text-amber-700 border border-amber-200">Cukup</span>;
    return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-red-50 text-red-700 border border-red-200">Kurang</span>;
  };

  // ── Save Settings ────────────────────────────────────────────────────────────
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSavingS(true);
    try {
      const entries = [
        { key: "scale",                 value: String(settingsForm.scale) },
        { key: "threshold_sangat_baik", value: String(settingsForm.threshold_sangat_baik) },
        { key: "threshold_baik",        value: String(settingsForm.threshold_baik) },
        { key: "threshold_cukup",       value: String(settingsForm.threshold_cukup) },
      ];
      for (const entry of entries) {
        await supabase.from("kpi_settings" as any).upsert(
          { ...entry, updated_by: user.id, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
      }
      setSettings({ ...settingsForm });
      toast.success("Pengaturan KPI berhasil disimpan!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSavingS(false);
    }
  };

  // ── Evaluations per role ─────────────────────────────────────────────────────
  const visibleEvals = useMemo(() => {
    if (isEmployee && !isUnitLeader) {
      return evaluations.filter(ev => ev.employees?.user_id === user?.id || ev.employee_id === employee?.id);
    }
    if (isUnitLeader && !isAdminOrHr && employee?.unit_id) {
      // Exclude leader sendiri agar tidak double dengan tab KPI Saya
      return evaluations.filter(ev =>
        ev.employees?.unit_id === employee.unit_id && ev.employee_id !== employee?.id
      );
    }
    return evaluations; // HR & super admin see all
  }, [evaluations, isEmployee, isUnitLeader, isAdminOrHr, user?.id, employee]);

  // KPI milik unit leader sendiri (dievaluasi oleh HR)
  const myLeaderEvals = useMemo(() =>
    evaluations.filter(ev => ev.employee_id === employee?.id),
  [evaluations, employee?.id]);

  // HR eval targets: hanya unit_leader
  const hrEvalTargets = hrLeaders;
  // HR templates: hanya template buatan HR sendiri (bukan template leader)
  const hrTemplates = useMemo(() => templates.filter(t => t.created_by === user?.id), [templates, user?.id]);

  // ── Render helpers ───────────────────────────────────────────────────────────
  const renderEvalTable = (data: any[]) => (
    <div className="border rounded-md bg-white overflow-x-auto">
      <Table className="text-sm min-w-[600px]">
        <TableHeader>
          <TableRow className="h-10 bg-muted">
            <TableHead className="w-10 text-center border-r border-gray-200">No.</TableHead>
            <TableHead className="border-r border-gray-200">Karyawan</TableHead>
            <TableHead className="border-r border-gray-200 w-[120px]">Periode</TableHead>
            <TableHead className="border-r border-gray-200">Template</TableHead>
            <TableHead className="border-r border-gray-200 w-[90px] text-center">Nilai</TableHead>
            <TableHead className="w-[120px] text-center">Predikat</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Belum ada evaluasi.</TableCell></TableRow>
          ) : data.map((ev, idx) => {
            const tpl = templates.find(t => t.id === ev.template_id);
            return (
              <TableRow key={ev.id} className="h-11 border-b border-gray-200 hover:bg-muted/50">
                <TableCell className="text-center text-slate-500">{idx + 1}</TableCell>
                <TableCell className="font-medium">{ev.employees?.name ?? "—"}</TableCell>
                <TableCell>{ev.period}</TableCell>
                <TableCell className="text-slate-700">{tpl?.name ?? "—"}</TableCell>
                <TableCell className="text-center font-bold text-slate-900">{ev.total_score ?? "—"}</TableCell>
                <TableCell className="text-center">{ev.total_score ? getScoreBadge(ev.total_score) : "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2"><BarChart3 className="h-6 w-6 text-primary" /> KPI</h1>
        </div>
      </div>

      {/* ── Employee: hanya lihat KPI sendiri ── */}
      {isEmployee && !isUnitLeader && (
        <div>
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Evaluasi KPI Saya</h2>
          {loading ? <p className="text-center py-10 text-muted-foreground">Memuat...</p> : renderEvalTable(visibleEvals)}
        </div>
      )}

      {/* ── HR / Super Admin: monitoring + evaluasi leader ── */}
      {isAdminOrHr && !isUnitLeader && (
        <Tabs defaultValue="monitoring" className="w-full">
          <TabsList className="h-9 bg-muted/50 rounded-lg mb-4">
            <TabsTrigger value="monitoring" className="text-xs">Semua Hasil Evaluasi</TabsTrigger>
            <TabsTrigger value="evaluasi-leader" className="text-xs">Evaluasi Kepala Unit</TabsTrigger>
            <TabsTrigger value="template" className="text-xs">Template KPI</TabsTrigger>
            {isSuperAdmin && <TabsTrigger value="pengaturan" className="text-xs">⚙ Pengaturan</TabsTrigger>}
          </TabsList>
          <TabsContent value="monitoring">
            {loading ? <p className="text-center py-10 text-muted-foreground">Memuat...</p> : renderEvalTable(visibleEvals)}
          </TabsContent>
          <TabsContent value="evaluasi-leader">
            <div className="flex justify-end mb-3">
              <Button size="sm" onClick={() => { setEvalEmpId(""); setEvalTplId(""); setEvalPeriod(""); setEvalScores({}); setEvalOpen(true); }}
                className="gap-2 bg-primary hover:bg-primary/90 shadow-md">
                <Plus className="h-4 w-4" /> Buat Evaluasi
              </Button>
            </div>
            {loading ? <p className="text-center py-10 text-muted-foreground">Memuat...</p>
              : renderEvalTable(evaluations.filter(ev => hrLeaders.some(l => l.id === ev.employee_id)))}
          </TabsContent>
          <TabsContent value="template">
            <div className="flex justify-end mb-3">
              <Button size="sm" onClick={openCreateTpl} className="gap-2 bg-primary hover:bg-primary/90 shadow-md">
                <Plus className="h-4 w-4" /> Buat Template
              </Button>
            </div>
            {loading ? <p className="text-center py-10 text-muted-foreground">Memuat...</p> : templates.length === 0 ? (
              <p className="text-center py-10 text-muted-foreground">Belum ada template KPI.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.filter(t => t.created_by === user?.id).map(t => (
                  <div key={t.id} className="border rounded-lg bg-white shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm text-slate-900">{t.name}</p>
                        {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => openEditTpl(t)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteTpl(t.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <Table><TableHeader><TableRow className="bg-muted/20 h-8">
                      <TableHead className="text-xs font-semibold">Indikator</TableHead>
                      <TableHead className="text-xs font-semibold text-right w-20">Bobot</TableHead>
                    </TableRow></TableHeader><TableBody>
                      {getInds(t.id).map(ind => (
                        <TableRow key={ind.id} className="h-9 text-sm">
                          <TableCell>{ind.name}</TableCell>
                          <TableCell className="text-right font-medium text-primary">{ind.weight}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody></Table>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          {isSuperAdmin && (
            <TabsContent value="pengaturan">
              <div className="max-w-md">
                <p className="text-sm text-muted-foreground mb-4">Atur cara perhitungan dan batas nilai predikat KPI yang berlaku global.</p>
                <form onSubmit={handleSaveSettings} className="border rounded-lg bg-white p-6 space-y-5 shadow-sm">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold">Skala Nilai Maksimum</Label>
                    <Select value={String(settingsForm.scale)} onValueChange={v => setSettingsForm({...settingsForm, scale: parseInt(v)})}>
                      <SelectTrigger className="h-9 text-sm shadow-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100">0 – 100</SelectItem>
                        <SelectItem value="10">0 – 10</SelectItem>
                        <SelectItem value="5">1 – 5</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="border-t pt-4 space-y-3">
                    <Label className="text-sm font-bold">Batas Predikat</Label>
                    {([["threshold_sangat_baik","Sangat Baik","text-emerald-700"],["threshold_baik","Baik","text-blue-700"],["threshold_cukup","Cukup","text-amber-700"]] as [string,string,string][]).map(([key,label,color]) => (
                      <div key={key} className="flex items-center gap-4">
                        <span className={`text-sm font-semibold ${color} w-28`}>{label} ≥</span>
                        <Input type="number" min="0" max={settingsForm.scale} value={(settingsForm as any)[key]}
                          onChange={e => setSettingsForm({...settingsForm, [key]: parseInt(e.target.value)})}
                          className="w-20 h-9 text-sm shadow-sm text-center" />
                      </div>
                    ))}
                    <div className="flex items-center gap-4 text-sm font-semibold text-red-700">
                      <span className="w-28">Kurang</span><span className="text-xs text-muted-foreground font-normal">Di bawah batas Cukup</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground border-t pt-3">
                    Aktif: Skala <strong>{settings.scale}</strong> | SB ≥ <strong>{settings.threshold_sangat_baik}</strong> | B ≥ <strong>{settings.threshold_baik}</strong> | C ≥ <strong>{settings.threshold_cukup}</strong>
                  </div>
                  <Button type="submit" disabled={isSavingS} className="h-9 bg-primary hover:bg-primary/90 font-bold text-sm">
                    {isSavingS ? "Menyimpan..." : "Simpan Pengaturan"}
                  </Button>
                </form>
              </div>
            </TabsContent>
          )}
        </Tabs>
      )}

      {/* ── Unit Leader: template + evaluasi + KPI sendiri ── */}
      {isUnitLeader && (
        <Tabs defaultValue="template" className="w-full">
          <TabsList className="h-9 bg-muted/50 rounded-lg mb-4">
            <TabsTrigger value="template" className="text-xs">Template KPI</TabsTrigger>
            <TabsTrigger value="evaluasi" className="text-xs">Evaluasi Tim</TabsTrigger>
            <TabsTrigger value="kpi-saya" className="text-xs">KPI Saya</TabsTrigger>
          </TabsList>

          {/* Tab Template */}
          <TabsContent value="template">
            <div className="flex justify-end mb-3">
              <Button size="sm" onClick={openCreateTpl} className="gap-2 bg-primary hover:bg-primary/90 shadow-md">
                <Plus className="h-4 w-4" /> Buat Template
              </Button>
            </div>
            {loading ? <p className="text-center py-10 text-muted-foreground">Memuat...</p> : myTemplates.length === 0 ? (
              <p className="text-center py-10 text-muted-foreground">Belum ada template KPI.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myTemplates.map(t => (
                  <div key={t.id} className="border rounded-lg bg-white shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm text-slate-900">{t.name}</p>
                        {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => openEditTpl(t)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteTpl(t.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20 h-8">
                          <TableHead className="text-xs font-semibold">Indikator</TableHead>
                          <TableHead className="text-xs font-semibold text-right w-20">Bobot</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getInds(t.id).map(ind => (
                          <TableRow key={ind.id} className="h-9 text-sm">
                            <TableCell>{ind.name}</TableCell>
                            <TableCell className="text-right font-medium text-primary">{ind.weight}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab Evaluasi Tim */}
          <TabsContent value="evaluasi">
            <div className="flex justify-end mb-3">
              <Button size="sm" onClick={openCreateEval} className="gap-2 bg-primary hover:bg-primary/90 shadow-md">
                <Plus className="h-4 w-4" /> Buat Evaluasi
              </Button>
            </div>
            {loading ? <p className="text-center py-10 text-muted-foreground">Memuat...</p> : renderEvalTable(visibleEvals)}
          </TabsContent>

          {/* Tab KPI Saya (unit leader dievaluasi HR) */}
          <TabsContent value="kpi-saya">
            {loading ? <p className="text-center py-10 text-muted-foreground">Memuat...</p>
              : myLeaderEvals.length === 0
              ? <p className="text-center py-10 text-muted-foreground">Belum ada evaluasi KPI untuk Anda.</p>
              : renderEvalTable(myLeaderEvals)}
          </TabsContent>
        </Tabs>
      )}

      {/* ── Dialog Template ── */}
      <Dialog open={tplOpen} onOpenChange={setTplOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 border-b bg-muted/30">
            <DialogTitle className="text-xl font-bold">{tplMode === "create" ? "Buat Template KPI" : "Edit Template KPI"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveTpl} className="flex flex-col">
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              <div className="space-y-2">
                <Label className="text-sm font-bold">Nama Template</Label>
                <Input value={tplName} onChange={e => setTplName(e.target.value)} required className="h-9 text-sm shadow-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-bold">Deskripsi</Label>
                <Input value={tplDesc} onChange={e => setTplDesc(e.target.value)} className="h-9 text-sm shadow-sm" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold">Indikator & Bobot</Label>
                  <span className="text-xs text-muted-foreground">
                    Total: <span className={Math.abs(tplInds.reduce((s,i)=>s+(parseFloat(i.weight)||0),0)-100)<0.01?"text-emerald-600 font-bold":"text-red-500 font-bold"}>
                      {tplInds.reduce((s,i)=>s+(parseFloat(i.weight)||0),0)}%
                    </span>
                  </span>
                </div>
                {tplInds.map((ind, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input placeholder="Nama indikator" value={ind.name} onChange={e => { const u=[...tplInds]; u[idx].name=e.target.value; setTplInds(u); }} required className="flex-1 h-9 text-sm shadow-sm" />
                    <Input placeholder="%" type="number" min="1" max="100" value={ind.weight} onChange={e => { const u=[...tplInds]; u[idx].weight=e.target.value; setTplInds(u); }} required className="w-20 h-9 text-sm shadow-sm" />
                    {tplInds.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => setTplInds(tplInds.filter((_,i)=>i!==idx))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setTplInds([...tplInds,{name:"",weight:""}])} className="text-xs">+ Tambah Indikator</Button>
              </div>
            </div>
            <div className="p-6 border-t bg-muted/30 flex justify-end gap-3">
              <Button type="button" variant="outline" className="h-10 min-w-[100px]" onClick={() => setTplOpen(false)} disabled={isSavingT}>Batal</Button>
              <Button type="submit" disabled={isSavingT} className="h-10 min-w-[140px] bg-primary hover:bg-primary/90 font-bold">
                {isSavingT ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Evaluasi ── */}
      <Dialog open={evalOpen} onOpenChange={setEvalOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 border-b bg-muted/30">
            <DialogTitle className="text-xl font-bold">Buat Evaluasi KPI</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEval} className="flex flex-col">
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              <div className="space-y-2">
                <Label className="text-sm font-bold">{isAdminOrHr ? "Kepala Unit" : "Karyawan"}</Label>
                <Select value={evalEmpId} onValueChange={setEvalEmpId}>
                  <SelectTrigger className="h-9 text-sm shadow-sm"><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>{(isAdminOrHr ? hrLeaders : unitEmployees).map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-bold">Template KPI</Label>
                <Select value={evalTplId} onValueChange={v => { setEvalTplId(v); setEvalScores({}); }}>
                  <SelectTrigger className="h-9 text-sm shadow-sm"><SelectValue placeholder="Pilih template" /></SelectTrigger>
                  <SelectContent>{(isAdminOrHr ? hrTemplates : myTemplates).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-bold">Periode</Label>
                <Input placeholder="Contoh: Mei 2026 / Q2 2026" value={evalPeriod} onChange={e => setEvalPeriod(e.target.value)} required className="h-9 text-sm shadow-sm" />
              </div>
              {selectedTplInds.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-bold">Nilai per Indikator (0–{settings.scale})</Label>
                  {selectedTplInds.map(ind => (
                    <div key={ind.id} className="flex items-center gap-3">
                      <span className="text-sm flex-1 text-slate-700">{ind.name} <span className="text-xs text-muted-foreground">({ind.weight}%)</span></span>
                      <Input type="number" min="0" max={settings.scale} placeholder={`0–${settings.scale}`}
                        value={evalScores[ind.id] ?? ""}
                        onChange={e => setEvalScores({...evalScores, [ind.id]: e.target.value})}
                        className="w-24 h-9 text-sm shadow-sm" required />
                    </div>
                  ))}
                  {selectedTplInds.length > 0 && Object.keys(evalScores).length === selectedTplInds.length && (
                    <div className="mt-2 p-3 bg-primary/5 border border-primary/20 rounded-md">
                      <p className="text-sm font-bold text-primary">
                        Estimasi Nilai Akhir: {Math.round(selectedTplInds.reduce((s,ind)=>s+((parseFloat(evalScores[ind.id])||0)*ind.weight/100),0)*100)/100}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 border-t bg-muted/30 flex justify-end gap-3">
              <Button type="button" variant="outline" className="h-10 min-w-[100px]" onClick={() => setEvalOpen(false)} disabled={isSavingE}>Batal</Button>
              <Button type="submit" disabled={isSavingE} className="h-10 min-w-[140px] bg-primary hover:bg-primary/90 font-bold">
                {isSavingE ? "Menyimpan..." : "Simpan Evaluasi"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
