import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { format, startOfMonth, endOfMonth, parseISO, getDaysInMonth, addDays } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useInstansiFilter } from "@/hooks/useInstansiFilter";
import { supabaseFetchWithTimeout } from "@/utils/supabase-fetch";
import { toast } from "sonner";
import { Clock, BarChart3, FileCheck, Building2, CheckSquare } from "lucide-react";
import { useTerminology } from "@/hooks/useTerminology";
import { ReportCard } from "@/components/reports/ReportCard";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ReportPreviewDialog } from "@/components/reports/ReportPreviewDialog";
import { downloadCSV } from "@/utils/export-csv";
import { downloadPDF } from "@/utils/export-pdf";

type ReportType = "attendance" | "kpi" | "approvals" | "organization" | "tasks";

type ReportCache = {
  employees: any[];
  allEmployees: any[];
  units: any[];
  attendance: any[];
  approvals: any[];
  kpiEvals: any[];
  holidays: any[];
  shifts: any[];
  tasks: any[];
};
// Cache berbasis key instansi — mencegah data SuperAdmin bocor ke Director dan sebaliknya
const reportsCache: Record<string, ReportCache> = {};

// Ditempatkan di luar komponen agar generik <T> tidak dibaca sebagai JSX tag
// Pakai PromiseLike bukan Promise karena PostgrestFilterBuilder dari Supabase hanya mengimplementasikan PromiseLike
async function safeQuery<T>(promise: PromiseLike<{ data: T | null; error: any }>, fallback: T): Promise<T> {
  try {
    const res = await promise;
    return res?.data ?? fallback;
  } catch {
    return fallback;
  }
}

export default function Reports() {
  const { isAdminOrHr, isDirector, allInstitutions } = useAuth();
  const { term: defaultTerm } = useTerminology();
  const { effectiveInstansiId } = useInstansiFilter();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [unitId, setUnitId] = useState("all");
  const [filterInstansiId, setFilterInstansiId] = useState("all");
  
  const term = useMemo(() => {
    if (!effectiveInstansiId && filterInstansiId !== "all") {
      return allInstitutions.find((i) => i.id === filterInstansiId)?.organization_term || defaultTerm;
    }
    return defaultTerm;
  }, [effectiveInstansiId, filterInstansiId, allInstitutions, defaultTerm]);
  
  const termLower = term.toLowerCase();

  // Baca cache yang sesuai dengan role user saat ini
  // Menggunakan useMemo agar tidak mengalami stale-closure
  const cacheKey = effectiveInstansiId ?? "global";
  const cachedData = useMemo(() => reportsCache[cacheKey] ?? null, [cacheKey]);

  const [loading, setLoading] = useState(!cachedData);

  // Raw data — diinisialisasi dari cache jika ada
  const [employees, setEmployees] = useState<any[]>(cachedData?.employees ?? []);
  const [allEmployees, setAllEmployees] = useState<any[]>(cachedData?.allEmployees ?? []);
  const [units, setUnits] = useState<any[]>(cachedData?.units ?? []);
  const [attendance, setAttendance] = useState<any[]>(cachedData?.attendance ?? []);
  const [approvals, setApprovals] = useState<any[]>(cachedData?.approvals ?? []);
  const [kpiEvals, setKpiEvals] = useState<any[]>(cachedData?.kpiEvals ?? []);
  const [holidays, setHolidays] = useState<any[]>(cachedData?.holidays ?? []);
  const [shifts, setShifts] = useState<any[]>(cachedData?.shifts ?? []);
  const [tasks, setTasks] = useState<any[]>(cachedData?.tasks ?? []);

  const isFirstFetch = useRef(!cachedData);
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Preview dialog
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [activeReportType, setActiveReportType] = useState<ReportType>("attendance");

  const fetchData = useCallback(async () => {
    if (isFirstFetch.current) setLoading(true);
    try {
      const monthStr = String(month).padStart(2, "0");
      const start = `${year}-${monthStr}-01`;
      const endDate = endOfMonth(new Date(year, month - 1));
      const end = format(endDate, "yyyy-MM-dd");

      // Setiap query berjalan independen — satu timeout tidak merusak data lain
      const [empData, unitData, attData, apprData, kpiData, holData, shiftData, taskData, rolesData] = await Promise.all([
        safeQuery(effectiveInstansiId
          ? supabase.from("employees").select("*").eq("status", "active").eq("instansi_id", effectiveInstansiId)
          : supabase.from("employees").select("*").eq("status", "active"), []),
        safeQuery(effectiveInstansiId
          ? supabase.from("units").select("*").eq("instansi_id", effectiveInstansiId)
          : supabase.from("units").select("*"), []),
        safeQuery((() => {
          let q: any = (supabase as any).from("attendance").select("*, employees(name, unit_id)")
            .gte("date", start).lte("date", end).order("date");
          if (effectiveInstansiId) q = q.eq("instansi_id", effectiveInstansiId);
          return q;
        })(), []),
        safeQuery((supabase as any).from("approvals").select("*")
          .gte("start_date", start).lte("start_date", end).order("created_at", { ascending: false }), []),
        safeQuery((() => {
          let q: any = (supabase as any).from("kpi_evaluations").select("*, employees!inner(name, unit_id, instansi_id), kpi_templates(name, threshold_sangat_baik, threshold_baik, threshold_cukup)")
            .eq("status", "SUBMITTED").order("created_at", { ascending: false });
          if (effectiveInstansiId) q = q.eq("employees.instansi_id", effectiveInstansiId);
          return q;
        })(), []),
        safeQuery(effectiveInstansiId
          ? supabase.from("national_holidays").select("*").eq("instansi_id", effectiveInstansiId)
          : supabase.from("national_holidays").select("*"), []),
        safeQuery(effectiveInstansiId
          ? supabase.from("work_shifts").select("*").eq("instansi_id", effectiveInstansiId)
          : supabase.from("work_shifts").select("*"), []),
        safeQuery((supabase as any).from("tasks").select("*")
          .gte("created_at", start).lte("created_at", `${end}T23:59:59`).order("created_at", { ascending: false }), []),
        safeQuery(supabase.from("user_roles").select("user_id, role, instansi_id"), []),
      ]);

      if (isMounted.current) {
        const rolesMap = new Map();
        (rolesData as any[]).forEach((r: any) => {
          if (r.instansi_id) {
            rolesMap.set(`${r.user_id}_${r.instansi_id}`, r.role);
          } else {
            rolesMap.set(`${r.user_id}_global`, r.role);
          }
        });

        const finalEmployees = (empData as any[]).filter((emp: any) => {
          let role = rolesMap.get(`${emp.user_id}_${emp.instansi_id}`);
          if (!role) role = rolesMap.get(`${emp.user_id}_global`);
          if (!role) role = "employee";
          return !["super_admin", "director", "hr"].includes(role);
        });

        const snapshot: ReportCache = {
          employees: finalEmployees,
          allEmployees: empData as any[],
          units: unitData as any[],
          attendance: attData as any[],
          approvals: apprData as any[],
          kpiEvals: kpiData as any[],
          holidays: holData as any[],
          shifts: shiftData as any[],
          tasks: taskData as any[],
        };
        reportsCache[cacheKey] = snapshot;

        setEmployees(snapshot.employees);
        setAllEmployees(snapshot.allEmployees);
        setUnits(snapshot.units);
        setAttendance(snapshot.attendance);
        setApprovals(snapshot.approvals);
        setKpiEvals(snapshot.kpiEvals);
        setHolidays(snapshot.holidays);
        setShifts(snapshot.shifts);
        setTasks(snapshot.tasks);
      }
    } catch (err: any) {
      console.error("Reports: fetch error", err);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        isFirstFetch.current = false;
      }
    }
  }, [month, year, effectiveInstansiId, cacheKey]);


  useEffect(() => { fetchData(); }, [fetchData]);

  // Filtered by unit / instansi
  const filteredEmployees = useMemo(() => {
    let res = employees;
    if (!effectiveInstansiId && filterInstansiId !== "all") res = res.filter((e) => e.instansi_id === filterInstansiId);
    else if (effectiveInstansiId && unitId !== "all") res = res.filter((e) => e.unit_id === unitId);
    return res;
  }, [employees, unitId, filterInstansiId, effectiveInstansiId]);

  const filteredAttendance = useMemo(() => {
    const empIds = new Set(filteredEmployees.map(e => e.id));
    return attendance.filter((a) => empIds.has(a.employee_id));
  }, [attendance, filteredEmployees]);

  const filteredApprovals = useMemo(() => {
    const empIds = new Set(filteredEmployees.map(e => e.id));
    return approvals.filter((a) => empIds.has(a.employee_id));
  }, [approvals, filteredEmployees]);

  const filteredKpi = useMemo(() => {
    const empIds = new Set(filteredEmployees.map(e => e.id));
    let res = kpiEvals.filter((k) => empIds.has(k.employee_id));
    
    // Filter by selected year and month (check period overlap)
    res = res.filter(k => {
      const selectedStart = new Date(year, month - 1, 1);
      const selectedEnd = new Date(year, month, 0);
      
      const kpiStart = k.start_date ? new Date(k.start_date) : null;
      const kpiEnd = k.end_date ? new Date(k.end_date) : null;
      
      if (kpiStart && kpiEnd) {
        // Return true if periods overlap
        return kpiStart <= selectedEnd && kpiEnd >= selectedStart;
      }
      
      const d = new Date((k.start_date ?? k.end_date) || k.created_at);
      return d.getFullYear() === year && (d.getMonth() + 1) === month;
    });
    
    return res;
  }, [kpiEvals, year, month, filteredEmployees]);

  const filteredTasks = useMemo(() => {
    const empIds = new Set(filteredEmployees.map(e => e.id));
    return tasks.filter((t) => empIds.has(t.assigned_to));
  }, [tasks, filteredEmployees]);

  const unitMap = useMemo(() => {
    const m = new Map<string, string>();
    units.forEach((u) => m.set(u.id, u.name));
    return m;
  }, [units]);

  const instansiMap = useMemo(() => {
    const m = new Map<string, string>();
    allInstitutions.forEach((i) => m.set(i.id, i.name));
    return m;
  }, [allInstitutions]);

  // =============== REPORT GENERATORS ===============

  const getAttendanceReport = useCallback(() => {
    const isGlobal = !effectiveInstansiId && filterInstansiId === "all";
    const headers = isGlobal
      ? ["Nama", term, "Cabang", "ID Karyawan", "Hadir", "Telat (Hari)", "Telat (Menit)", "Lembur (Menit)", "Cuti", "Sakit", "Izin", "Mangkir"]
      : ["Nama", term, "ID Karyawan", "Hadir", "Telat (Hari)", "Telat (Menit)", "Lembur (Menit)", "Cuti", "Sakit", "Izin", "Mangkir"];
      
    const empStats = new Map<string, any>();
    
    filteredEmployees.forEach(e => {
       empStats.set(e.id, { 
         cabang: instansiMap.get(e.instansi_id) || "-",
         nama: e.name || "-",
         nip: e.employee_id_number || "-",
         unit: unitMap.get(e.unit_id) || "-",
         hadir: 0, telat: 0, total_late_minutes: 0, lembur: 0,
         cuti: 0, sakit: 0, izin: 0, mangkir: 0
       });
    });

    filteredAttendance.forEach(a => {
       const s = empStats.get(a.employee_id);
       if (!s) return;

       if (a.daily_status === 'Cuti') s.cuti++;
       else if (a.daily_status === 'Sakit') s.sakit++;
       else if (a.daily_status === 'Izin') s.izin++;
       else if (a.daily_status === 'Mangkir') s.mangkir++;
       else {
         if (a.check_in || a.daily_status === 'Hadir') s.hadir++;
         if (a.late_minutes && a.late_minutes > 0) { 
           s.telat++; 
           s.total_late_minutes += a.late_minutes; 
         }
         if (a.overtime_minutes && a.overtime_minutes > 0) {
           s.lembur += a.overtime_minutes;
         }
       }
    });

    const rows = Array.from(empStats.values()).map(s => {
      const commonStats = [
        s.nip, String(s.hadir), String(s.telat), String(s.total_late_minutes), String(s.lembur),
        String(s.cuti), String(s.sakit), String(s.izin), String(s.mangkir)
      ];
      return isGlobal ? [s.nama, s.unit, s.cabang, ...commonStats] : [s.nama, s.unit, ...commonStats];
    });
    return { headers, rows };
  }, [filteredAttendance, filteredEmployees, unitMap, effectiveInstansiId, filterInstansiId, instansiMap, term]);


  const getKpiReport = useCallback(() => {
    const isGlobal = !effectiveInstansiId && filterInstansiId === "all";
    const headers = isGlobal
      ? ["Nama", term, "Cabang", "Periode", "Template", "Nilai", "Predikat", "Dinilai Oleh"]
      : ["Nama", term, "Periode", "Template", "Nilai", "Predikat", "Dinilai Oleh"];
      
    const rows = filteredKpi.map((k) => {
      let periodLabel = "—";
      if (k.start_date || k.end_date) {
        if (k.start_date && k.end_date) periodLabel = `${format(new Date(k.start_date), "dd/MM/yy")} - ${format(new Date(k.end_date), "dd/MM/yy")}`;
        else periodLabel = format(new Date((k.start_date ?? k.end_date)!), "dd/MM/yy");
      }
      
      let predikat = "—";
      if (k.total_score != null && k.kpi_templates) {
        const score = k.total_score;
        const sb = k.kpi_templates.threshold_sangat_baik ?? 85;
        const b = k.kpi_templates.threshold_baik ?? 70;
        const c = k.kpi_templates.threshold_cukup ?? 55;
        if (score >= sb) predikat = "Sangat Baik";
        else if (score >= b) predikat = "Baik";
        else if (score >= c) predikat = "Cukup";
        else predikat = "Kurang";
      }

      const evaluatorName = allEmployees.find((e) => e.user_id === k.evaluator_id)?.name || "—";
      
      const commonStats = [
        periodLabel,
        k.kpi_templates?.name || "-",
        k.total_score != null ? String(k.total_score) : "-",
        predikat,
        evaluatorName
      ];
      const nama = k.employees?.name || "-";
      const unit = unitMap.get(k.employees?.unit_id) || "-";
      return isGlobal ? [nama, unit, instansiMap.get(k.employees?.instansi_id) || "Tanpa Cabang", ...commonStats] : [nama, unit, ...commonStats];
    });
    return { headers, rows };
  }, [filteredKpi, unitMap, effectiveInstansiId, instansiMap, term, allEmployees]);

  const getApprovalsReport = useCallback(() => {
    const isGlobal = !effectiveInstansiId && filterInstansiId === "all";
    const typeLabel: Record<string, string> = { leave: "Cuti", permission: "Izin", overtime: "Lembur", sick: "Sakit", wfa: "WFA / WFH" };
    const statusLabel: Record<string, string> = {
      pending: "Menunggu", approved_unit_leader: "Disetujui",
      approved_hr: "Disetujui", rejected: "Ditolak",
    };
    const headers = isGlobal
      ? ["Nama", term, "Cabang", "Pengajuan", "Tanggal Kegiatan", "Durasi (Hari)", "Alasan", "Status"]
      : ["Nama", term, "Pengajuan", "Tanggal Kegiatan", "Durasi (Hari)", "Alasan", "Status"];

    const getDuration = (a: any) => {
      if (!a.start_date || !a.end_date) return 0;
      const start = new Date(a.start_date);
      const end = new Date(a.end_date);
      const employee = filteredEmployees.find(e => e.id === a.employee_id);
      const shift = shifts.find(s => s.id === employee?.shift_id);
      
      const shiftDays = shift?.work_days || [1,2,3,4,5]; 
      const validDays = shiftDays.map((d: number) => (d === 7 ? 0 : d));
      
      let count = 0;
      let curr = start;
      while (curr <= end) {
        const dateStr = format(curr, "yyyy-MM-dd");
        const dayOfWeek = curr.getDay(); 
        if (validDays.includes(dayOfWeek) && !holidays.some(h => h.date === dateStr)) {
          count++;
        }
        curr = addDays(curr, 1);
      }
      return count;
    };

    const rows = filteredApprovals.map((a) => {
      const emp = filteredEmployees.find(e => e.id === a.employee_id);
      
      let tglKegiatan = "—";
      if (a.start_date) {
        if (a.type === "overtime" || a.start_date === a.end_date) {
          tglKegiatan = format(parseISO(a.start_date), "dd/MM/yyyy");
        } else if (a.end_date) {
          tglKegiatan = `${format(parseISO(a.start_date), "dd/MM/yyyy")} - ${format(parseISO(a.end_date), "dd/MM/yyyy")}`;
        }
      }

      const commonStats = [
        typeLabel[a.type] || a.type,
        tglKegiatan,
        String(getDuration(a)),
        a.reason || "-",
        statusLabel[a.status] || a.status,
      ];
      const nama = emp?.name || "-";
      const unit = unitMap.get(emp?.unit_id || "") || "-";
      return isGlobal ? [nama, unit, instansiMap.get(a.instansi_id) || "Tanpa Cabang", ...commonStats] : [nama, unit, ...commonStats];
    });
    return { headers, rows };
  }, [filteredApprovals, filteredEmployees, shifts, holidays, unitMap, effectiveInstansiId, filterInstansiId, instansiMap, term]);

  const getOrganizationReport = useCallback(() => {
    const isGlobal = !effectiveInstansiId && filterInstansiId === "all";
    const headers = isGlobal
      ? [`${term}`, "Cabang", "Jumlah Karyawan", "Laki-laki", "Perempuan"]      : [`${term}`, "Jumlah Karyawan", "Laki-laki", "Perempuan"];
      
    const unitStats = new Map<string, { cabang: string, uName: string, total: number; l: number; p: number }>();
    
    filteredEmployees.forEach((e) => {
      const uName = unitMap.get(e.unit_id) || `Tanpa ${term}`;
      const cName = instansiMap.get(e.instansi_id) || "Tanpa Cabang";
      const key = isGlobal ? `${e.instansi_id}-${e.unit_id}` : uName;
      
      const s = unitStats.get(key) || { cabang: cName, uName, total: 0, l: 0, p: 0 };
      s.total++;
      if (e.gender === "Laki-laki") s.l++;
      else if (e.gender === "Perempuan") s.p++;
      unitStats.set(key, s);
    });
    
    const rows = Array.from(unitStats.values()).map((s) => {
      const baseRow = [String(s.total), String(s.l), String(s.p)];
      return isGlobal ? [s.uName, s.cabang, ...baseRow] : [s.uName, ...baseRow];
    });
    return { headers, rows };
  }, [filteredEmployees, unitMap, effectiveInstansiId, instansiMap, term]);

  const getTasksReport = useCallback(() => {
    const isGlobal = !effectiveInstansiId && filterInstansiId === "all";
    const headers = isGlobal
      ? ["Nama", term, "Cabang", "Total Tugas", "Selesai", "Proses", "Belum Mulai"]
      : ["Nama", term, "Total Tugas", "Selesai", "Proses", "Belum Mulai"];
      
    const empStats = new Map<string, any>();
    
    filteredTasks.forEach(t => {
       const emp = filteredEmployees.find(e => e.id === t.assigned_to);
       if (!emp) return;
       const s = empStats.get(emp.id) || { 
         cabang: instansiMap.get(emp.instansi_id) || "-",
         nama: emp.name || "-",
         unit: unitMap.get(emp.unit_id) || "-",
         total: 0, done: 0, progress: 0, todo: 0 
       };

       if (t.status === "cancelled") return;

       s.total++;
       if (t.status === "done") s.done++;
       else if (t.status === "in_progress" || t.status === "pending_review") s.progress++;
       else if (t.status === "todo") s.todo++;
       
       empStats.set(emp.id, s);
    });

    const rows = Array.from(empStats.values()).map(s => {
      const baseRow = [String(s.total), String(s.done), String(s.progress), String(s.todo)];
      return isGlobal ? [s.nama, s.unit, s.cabang, ...baseRow] : [s.nama, s.unit, ...baseRow];
    });
    return { headers, rows };
  }, [filteredTasks, filteredEmployees, unitMap, effectiveInstansiId, filterInstansiId, instansiMap, term]);

  const reportGenerators: Record<ReportType, () => { headers: string[]; rows: string[][] }> = {
    attendance: getAttendanceReport,
    kpi: getKpiReport,
    approvals: getApprovalsReport,
    organization: getOrganizationReport,
    tasks: getTasksReport,
  };

  const monthLabel = format(new Date(year, month - 1), "MMMM yyyy", { locale: localeId });

  const handlePreview = (type: ReportType, title: string) => {
    const { headers, rows } = reportGenerators[type]();
    setActiveReportType(type);
    setPreviewTitle(title);
    setPreviewHeaders(headers);
    setPreviewRows(rows);
    setPreviewOpen(true);
  };

  const handleExportCSV = (type: ReportType, filename: string) => {
    const { headers, rows } = reportGenerators[type]();
    if (rows.length === 0) { toast.error("Tidak ada data untuk diekspor"); return; }
    downloadCSV(`${filename}_${year}-${String(month).padStart(2, "0")}`, headers, rows);
    toast.success("File CSV berhasil diunduh");
  };

  const handleExportPDF = (type: ReportType, title: string, filename: string) => {
    const { headers, rows } = reportGenerators[type]();
    if (rows.length === 0) { toast.error("Tidak ada data untuk diekspor"); return; }
    const unitLabel = unitId === "all" ? `Semua ${term}` : (unitMap.get(unitId) || "");
    downloadPDF({
      filename: `${filename}_${year}-${String(month).padStart(2, "0")}`,
      title,
      subtitle: `Periode: ${monthLabel} • ${unitLabel} • ${rows.length} data`,
      headers,
      rows,
      orientation: headers.length > 5 ? "l" : "p",
    });
    toast.success("File PDF berhasil diunduh");
  };

  const filteredUnits = useMemo(() => {
    let res = units;
    if (!effectiveInstansiId && filterInstansiId !== "all") res = res.filter((u) => u.instansi_id === filterInstansiId);
    return res;
  }, [units, filterInstansiId, effectiveInstansiId]);

  const reports: { type: ReportType; title: string; desc: string; icon: any; color: string; count: number; countLabel: string; filename: string }[] = [
    { type: "attendance", title: "Rekap Kehadiran", desc: "Total kehadiran, keterlambatan, lembur, dan pulang cepat per karyawan", icon: Clock, color: "bg-[hsl(162,60%,40%)]", count: filteredEmployees.length, countLabel: "karyawan", filename: "Rekap_Kehadiran" },
    { type: "kpi", title: "Rekap KPI", desc: "Skor evaluasi KPI per karyawan berdasarkan periode penilaian", icon: BarChart3, color: "bg-[hsl(198,64%,40%)]", count: filteredKpi.length, countLabel: "evaluasi", filename: "Rekap_KPI" },
    { type: "approvals", title: "Rekap Pengajuan", desc: "Seluruh riwayat pengajuan (cuti, izin, sakit, wfa, lembur) beserta statusnya", icon: FileCheck, color: "bg-[hsl(38,80%,48%)]", count: filteredApprovals.length, countLabel: "pengajuan", filename: "Rekap_Pengajuan" },
    { type: "tasks", title: "Produktivitas Tugas", desc: "Statistik penyelesaian tugas (tasks) harian per karyawan", icon: CheckSquare, color: "bg-[hsl(210,100%,50%)]", count: filteredTasks.length, countLabel: "tugas", filename: "Rekap_Tugas" },
    { type: "organization", title: "Ringkasan Organisasi", desc: `Statistik distribusi karyawan per ${termLower} kerja dan gender`, icon: Building2, color: "bg-[hsl(280,50%,45%)]", count: filteredUnits.length, countLabel: term, filename: "Ringkasan_Organisasi" },
  ];

  if (!isAdminOrHr && !isDirector) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BarChart3 className="h-16 w-16 text-muted-foreground opacity-20 mb-4" />
          <h2 className="text-xl font-bold">Akses Ditolak</h2>
          <p className="text-muted-foreground">Anda tidak memiliki izin untuk mengakses halaman laporan.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Laporan</h1>
        </div>
      </div>

      <div className="space-y-6">
        <ReportFilters
          month={month} year={year} unitId={unitId} units={units}
          onMonthChange={setMonth} onYearChange={setYear} onUnitChange={setUnitId}
          isGlobal={!effectiveInstansiId}
          filterInstansiId={filterInstansiId}
          onInstansiChange={setFilterInstansiId}
          institutions={allInstitutions}
          term={term}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {reports.map((r) => (
            <ReportCard
              key={r.type}
              title={r.title}
              description={r.desc}
              icon={r.icon}
              iconColor={r.color}
              count={r.count}
              countLabel={r.countLabel}
              loading={loading}
              onPreview={() => handlePreview(r.type, r.title)}
              onExportCSV={() => handleExportCSV(r.type, r.filename)}
              onExportPDF={() => handleExportPDF(r.type, r.title, r.filename)}
            />
          ))}
        </div>
      </div>

      <ReportPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={`${previewTitle} — ${monthLabel}`}
        headers={previewHeaders}
        rows={previewRows}
        onExportCSV={() => {
          const r = reports.find((r) => r.type === activeReportType)!;
          handleExportCSV(r.type, r.filename);
        }}
        onExportPDF={() => {
          const r = reports.find((r) => r.type === activeReportType)!;
          handleExportPDF(r.type, r.title, r.filename);
        }}
      />
    </DashboardLayout>
  );
}
