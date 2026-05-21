import { useEffect, useState, useCallback, useMemo } from "react";
import { format, startOfMonth, endOfMonth, parseISO, getDaysInMonth } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabaseFetchWithTimeout } from "@/utils/supabase-fetch";
import { toast } from "sonner";
import { Clock, Users, BarChart3, FileCheck, Building2 } from "lucide-react";
import { ReportCard } from "@/components/reports/ReportCard";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ReportPreviewDialog } from "@/components/reports/ReportPreviewDialog";
import { downloadCSV } from "@/utils/export-csv";
import { downloadPDF } from "@/utils/export-pdf";

type ReportType = "attendance" | "employees" | "kpi" | "approvals" | "organization";

export default function Reports() {
  const { isAdminOrHr } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [unitId, setUnitId] = useState("all");
  const [loading, setLoading] = useState(true);

  // Raw data
  const [employees, setEmployees] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [kpiEvals, setKpiEvals] = useState<any[]>([]);

  // Preview dialog
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [activeReportType, setActiveReportType] = useState<ReportType>("attendance");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const monthStr = String(month).padStart(2, "0");
      const start = `${year}-${monthStr}-01`;
      const endDate = endOfMonth(new Date(year, month - 1));
      const end = format(endDate, "yyyy-MM-dd");

      const [empRes, unitRes, attRes, apprRes, kpiRes] = await Promise.all([
        supabaseFetchWithTimeout(supabase.from("employees").select("*").eq("status", "active"), 20000),
        supabaseFetchWithTimeout(supabase.from("units").select("*"), 20000),
        supabaseFetchWithTimeout(
          supabase.from("attendance").select("*, employees(name, unit_id)")
            .gte("date", start).lte("date", end).order("date"),
          20000
        ),
        supabaseFetchWithTimeout(
          supabase.from("approvals").select("*, employees(name, unit_id)")
            .gte("start_date", start).lte("start_date", end).order("created_at", { ascending: false }),
          20000
        ),
        supabaseFetchWithTimeout(
          supabase.from("kpi_evaluations").select("*, employees(name, unit_id), kpi_templates(name)")
            .eq("period", `${year}-${monthStr}`).order("created_at", { ascending: false }),
          20000
        ),
      ]);

      setEmployees(empRes?.data || []);
      setUnits(unitRes?.data || []);
      setAttendance(attRes?.data || []);
      setApprovals(apprRes?.data || []);
      setKpiEvals(kpiRes?.data || []);
    } catch (err) {
      console.error("Reports: fetch error", err);
      toast.error("Gagal memuat data laporan");
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filtered by unit
  const filteredEmployees = useMemo(() =>
    unitId === "all" ? employees : employees.filter((e) => e.unit_id === unitId),
    [employees, unitId]
  );
  const filteredAttendance = useMemo(() =>
    unitId === "all" ? attendance : attendance.filter((a) => a.employees?.unit_id === unitId),
    [attendance, unitId]
  );
  const filteredApprovals = useMemo(() =>
    unitId === "all" ? approvals : approvals.filter((a) => a.employees?.unit_id === unitId),
    [approvals, unitId]
  );
  const filteredKpi = useMemo(() =>
    unitId === "all" ? kpiEvals : kpiEvals.filter((k) => k.employees?.unit_id === unitId),
    [kpiEvals, unitId]
  );

  const unitMap = useMemo(() => {
    const m = new Map<string, string>();
    units.forEach((u) => m.set(u.id, u.name));
    return m;
  }, [units]);

  // =============== REPORT GENERATORS ===============

  const getAttendanceReport = useCallback(() => {
    const headers = ["Nama", "Tanggal", "Check-in", "Check-out", "Status", "Telat (mnt)", "Unit"];
    const rows = filteredAttendance.map((a) => [
      a.employees?.name || "-",
      a.date ? format(parseISO(a.date), "dd/MM/yyyy") : "-",
      a.check_in ? format(parseISO(a.check_in), "HH:mm") : "-",
      a.check_out ? format(parseISO(a.check_out), "HH:mm") : "-",
      a.daily_status || "-",
      String(a.late_minutes ?? 0),
      unitMap.get(a.employees?.unit_id) || "-",
    ]);
    return { headers, rows };
  }, [filteredAttendance, unitMap]);

  const getEmployeesReport = useCallback(() => {
    const headers = ["Nama", "NIP", "Email", "Unit", "Jabatan", "Gender", "Tgl Masuk", "Status"];
    const rows = filteredEmployees.map((e) => [
      e.name || "-",
      e.employee_id_number || "-",
      e.email || "-",
      unitMap.get(e.unit_id) || "-",
      e.position || "-",
      e.gender || "-",
      e.join_date ? format(parseISO(e.join_date), "dd/MM/yyyy") : "-",
      e.status === "active" ? "Aktif" : e.status === "inactive" ? "Nonaktif" : "Cuti",
    ]);
    return { headers, rows };
  }, [filteredEmployees, unitMap]);

  const getKpiReport = useCallback(() => {
    const headers = ["Nama", "Template KPI", "Periode", "Skor Total", "Unit"];
    const rows = filteredKpi.map((k) => [
      k.employees?.name || "-",
      k.kpi_templates?.name || "-",
      k.period || "-",
      k.total_score != null ? String(k.total_score) : "-",
      unitMap.get(k.employees?.unit_id) || "-",
    ]);
    return { headers, rows };
  }, [filteredKpi, unitMap]);

  const getApprovalsReport = useCallback(() => {
    const typeLabel: Record<string, string> = { leave: "Cuti", permission: "Izin", overtime: "Lembur" };
    const statusLabel: Record<string, string> = {
      pending: "Menunggu", approved_unit_leader: "Disetujui KU",
      approved_hr: "Disetujui HR", rejected: "Ditolak",
    };
    const headers = ["Nama", "Tipe", "Mulai", "Selesai", "Alasan", "Status", "Unit"];
    const rows = filteredApprovals.map((a) => [
      a.employees?.name || "-",
      typeLabel[a.type] || a.type,
      a.start_date ? format(parseISO(a.start_date), "dd/MM/yyyy") : "-",
      a.end_date ? format(parseISO(a.end_date), "dd/MM/yyyy") : "-",
      a.reason || "-",
      statusLabel[a.status] || a.status,
      unitMap.get(a.employees?.unit_id) || "-",
    ]);
    return { headers, rows };
  }, [filteredApprovals, unitMap]);

  const getOrganizationReport = useCallback(() => {
    const headers = ["Unit Kerja", "Jumlah Karyawan", "Laki-laki", "Perempuan"];
    const unitStats = new Map<string, { total: number; l: number; p: number }>();
    filteredEmployees.forEach((e) => {
      const uName = unitMap.get(e.unit_id) || "Tanpa Unit";
      const s = unitStats.get(uName) || { total: 0, l: 0, p: 0 };
      s.total++;
      if (e.gender === "Laki-laki") s.l++;
      else if (e.gender === "Perempuan") s.p++;
      unitStats.set(uName, s);
    });
    const rows = Array.from(unitStats.entries()).map(([name, s]) => [
      name, String(s.total), String(s.l), String(s.p),
    ]);
    return { headers, rows };
  }, [filteredEmployees, unitMap]);

  const reportGenerators: Record<ReportType, () => { headers: string[]; rows: string[][] }> = {
    attendance: getAttendanceReport,
    employees: getEmployeesReport,
    kpi: getKpiReport,
    approvals: getApprovalsReport,
    organization: getOrganizationReport,
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
    const unitLabel = unitId === "all" ? "Semua Unit" : (unitMap.get(unitId) || "");
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

  const reports: { type: ReportType; title: string; desc: string; icon: any; color: string; count: number; countLabel: string; filename: string }[] = [
    { type: "attendance", title: "Rekap Kehadiran", desc: "Data check-in/out, keterlambatan, dan status harian per karyawan", icon: Clock, color: "bg-[hsl(162,60%,40%)]", count: filteredAttendance.length, countLabel: "record", filename: "Rekap_Kehadiran" },
    { type: "employees", title: "Daftar Karyawan", desc: "Data master karyawan aktif beserta unit, jabatan, dan informasi personal", icon: Users, color: "bg-[hsl(232,59%,28%)]", count: filteredEmployees.length, countLabel: "orang", filename: "Daftar_Karyawan" },
    { type: "kpi", title: "Rekap KPI", desc: "Skor evaluasi KPI per karyawan berdasarkan periode penilaian", icon: BarChart3, color: "bg-[hsl(198,64%,40%)]", count: filteredKpi.length, countLabel: "evaluasi", filename: "Rekap_KPI" },
    { type: "approvals", title: "Rekap Izin & Cuti", desc: "Seluruh pengajuan cuti, izin, dan lembur beserta status persetujuan", icon: FileCheck, color: "bg-[hsl(38,80%,48%)]", count: filteredApprovals.length, countLabel: "pengajuan", filename: "Rekap_Izin_Cuti" },
    { type: "organization", title: "Ringkasan Organisasi", desc: "Statistik distribusi karyawan per unit kerja dan gender", icon: Building2, color: "bg-[hsl(280,50%,45%)]", count: units.length, countLabel: "unit", filename: "Ringkasan_Organisasi" },
  ];

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1 className="page-title">Laporan</h1>
      </div>

      <div className="space-y-6">
        <ReportFilters
          month={month} year={year} unitId={unitId} units={units}
          onMonthChange={setMonth} onYearChange={setYear} onUnitChange={setUnitId}
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
