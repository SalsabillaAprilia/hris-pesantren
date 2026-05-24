import { useEffect, useState, useCallback, useRef } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useInstansiFilter } from "@/hooks/useInstansiFilter";
import { supabaseFetchWithTimeout } from "@/utils/supabase-fetch";
import { ManagerialDashboard } from "@/components/dashboard/ManagerialDashboard";
import { EmployeeDashboard } from "@/components/dashboard/EmployeeDashboard";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Selamat Pagi";
  if (hour < 15) return "Selamat Siang";
  if (hour < 18) return "Selamat Sore";
  return "Selamat Malam";
}

interface Stats {
  totalEmployees: number;
  presentToday: number;
  pendingApprovals: number;
  activeTasks: number;
}

let globalDashboardStatsCache: Stats | null = null;
let globalDashboardTodayRecordCache: any | null = null;
let globalDashboardAttendanceRecordsCache: any[] | null = null;
let globalDashboardEmployeesCache: any[] | null = null;
let globalDashboardAllEmployeesCache: any[] | null = null;
let globalDashboardUnitsCache: any[] | null = null;
let globalDashboardApprovalsCache: any[] | null = null;
let globalDashboardAgendasCache: any[] | null = null;
let globalDashboardTasksCache: any[] | null = null;
let globalDashboardPersonalAttendanceCache: any[] | null = null;
let globalDashboardPersonalApprovalsCache: any[] | null = null;

export default function Dashboard() {
  const { employee, isAdminOrHr, isEmployee, hasRole, isDirector } = useAuth();
  const { effectiveInstansiId } = useInstansiFilter();
  const isUnitLeader = hasRole("unit_leader");

  const [stats, setStats] = useState<Stats>(globalDashboardStatsCache || {
    totalEmployees: 0,
    presentToday: 0,
    pendingApprovals: 0,
    activeTasks: 0,
  });
  const [todayRecord, setTodayRecord] = useState<any>(globalDashboardTodayRecordCache);
  const [loading, setLoading] = useState(globalDashboardStatsCache === null);

  const isFirstFetch = useRef(globalDashboardStatsCache === null);
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Data untuk chart & card
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>(globalDashboardAttendanceRecordsCache || []);
  const [employees, setEmployees] = useState<any[]>(globalDashboardEmployeesCache || []);
  const [allEmployees, setAllEmployees] = useState<any[]>(globalDashboardAllEmployeesCache || []);
  const [units, setUnits] = useState<any[]>(globalDashboardUnitsCache || []);
  const [approvals, setApprovals] = useState<any[]>(globalDashboardApprovalsCache || []);
  const [agendas, setAgendas] = useState<any[]>(globalDashboardAgendasCache || []);
  const [tasks, setTasks] = useState<any[]>(globalDashboardTasksCache || []);
  // Riwayat presensi personal (untuk karyawan)
  const [personalAttendance, setPersonalAttendance] = useState<any[]>(globalDashboardPersonalAttendanceCache || []);
  const [personalApprovals, setPersonalApprovals] = useState<any[]>(globalDashboardPersonalApprovalsCache || []);

  const fetchData = useCallback(async () => {
    if (isFirstFetch.current) setLoading(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");

      if (isAdminOrHr || isDirector || isUnitLeader) {
        // ========= DATA MANAJERIAL =========
        const [empRes, attRes, apprRes, tasksRes, unitsRes, agendasRes, rolesRes] = await Promise.all([
          supabaseFetchWithTimeout(
            (() => {
              let q = supabase.from("employees").select("*").in("status", ["active", "on_leave"]);
              if (effectiveInstansiId) q = q.eq("instansi_id", effectiveInstansiId);
              return q;
            })(),
            20000
          ),
          supabaseFetchWithTimeout(
            (() => {
              let q = supabase.from("attendance").select("*").gte("date", format(new Date(Date.now() - 7 * 86400000), "yyyy-MM-dd")).order("date", { ascending: false });
              if (effectiveInstansiId) q = q.eq("instansi_id", effectiveInstansiId);
              return q;
            })(),
            20000
          ),
          supabaseFetchWithTimeout(
            (() => {
              let q = supabase.from("approvals").select("*, employees(name)").order("created_at", { ascending: false }).limit(20);
              if (effectiveInstansiId) q = q.eq("instansi_id", effectiveInstansiId);
              return q;
            })(),
            20000
          ),
          supabaseFetchWithTimeout(
            (() => {
              let q = supabase.from("tasks").select("*").in("status", ["todo", "in_progress"]);
              if (effectiveInstansiId) q = q.eq("instansi_id", effectiveInstansiId);
              return q;
            })(),
            20000
          ),
          supabaseFetchWithTimeout(
            (() => {
              let q = supabase.from("units").select("*");
              if (effectiveInstansiId) q = q.eq("instansi_id", effectiveInstansiId);
              return q;
            })(),
            20000
          ),
          supabaseFetchWithTimeout(
            (() => {
              let q = supabase.from("agendas").select("*, employees(name)").eq("date", today).order("time", { ascending: true });
              if (effectiveInstansiId) q = q.eq("instansi_id", effectiveInstansiId);
              return q;
            })(),
            20000
          ),
          supabaseFetchWithTimeout(
            (() => {
              let q = supabase.from("user_roles").select("user_id, role");
              if (effectiveInstansiId) q = q.eq("instansi_id", effectiveInstansiId);
              return q;
            })(),
            20000
          ),
        ]);

        const rolesMap = Object.fromEntries((rolesRes?.data || []).map((r: any) => [r.user_id, r.role]));
        
        // Filter karyawan yang statusnya aktif DAN rolenya hanya 'employee' atau 'unit_leader'
        const activeEmps = (empRes?.data || []).filter((emp: any) => {
          const r = rolesMap[emp.user_id] || "employee"; // Default 'employee' jika belum ada role eksplisit
          return emp.status === "active" && (r === "employee" || r === "unit_leader");
        });
        
        let filteredEmps = activeEmps;
        let filteredAllEmps = empRes?.data || [];
        let attData = attRes?.data || [];
        let apprData = apprRes?.data || [];
        let tasksData = tasksRes?.data || [];
        let unitsData = unitsRes?.data || [];
        let agendasData = agendasRes?.data || [];

        // --- FILTER KHUSUS UNIT LEADER ---
        if (isUnitLeader && !isAdminOrHr && !isDirector) {
          const myUnitId = employee?.unit_id;
          if (myUnitId) {
            filteredEmps = activeEmps.filter(e => e.unit_id === myUnitId);
            filteredAllEmps = filteredAllEmps.filter(e => e.unit_id === myUnitId);
            const subordinateIds = new Set(filteredAllEmps.map(e => e.id));
            attData = attData.filter(a => subordinateIds.has(a.employee_id));
            apprData = apprData.filter(a => subordinateIds.has(a.employee_id));
            tasksData = tasksData.filter((t: any) => subordinateIds.has(t.assigned_to));
            unitsData = unitsData.filter((u: any) => u.id === myUnitId);
          } else {
            filteredEmps = [];
            filteredAllEmps = [];
            attData = [];
            apprData = [];
            tasksData = [];
            unitsData = [];
          }
        }
        // --- DUMMY DATA INJECTION FOR UI TESTING ---
        const todayDate = format(new Date(), "yyyy-MM-dd");
        const yesterdayDate = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");
        
        if (attData.length === 0) {
           attData = [
             { id: '1', employee_id: 'e1', date: todayDate, status: 'present' },
             { id: '2', employee_id: 'e2', date: todayDate, status: 'present' },
             { id: '3', employee_id: 'e3', date: todayDate, status: 'late' },
             { id: '4', employee_id: 'e4', date: todayDate, status: 'absent' },
             { id: '5', employee_id: 'e1', date: yesterdayDate, status: 'present' },
             { id: '6', employee_id: 'e2', date: yesterdayDate, status: 'present' },
             { id: '7', employee_id: 'e3', date: yesterdayDate, status: 'present' },
           ] as any[];
        }

        if (apprData.length === 0) {
           apprData = [
             { id: 'a1', type: 'leave', status: 'pending', created_at: new Date().toISOString(), employees: { name: 'Ahmad Subarjo' }, start_date: '2026-06-01', end_date: '2026-06-03', reason: 'Cuti Tahunan' },
             { id: 'a2', type: 'overtime', status: 'pending', created_at: new Date(Date.now() - 3600000).toISOString(), employees: { name: 'Siti Aminah' }, start_date: '2026-05-25', end_date: '2026-05-25', reason: 'Lembur rekap data' },
           ] as any[];
        }

        if (agendasData.length === 0) {
           agendasData = [
             { id: 'ag1', title: 'Rapat Evaluasi Bulanan', time: '09:00', type: 'meeting', date: todayDate, employees: { name: 'Admin HR' } },
             { id: 'ag2', title: 'Kunjungan Pengurus Yayasan', time: '13:00', type: 'event', date: todayDate, employees: { name: 'Direktur' } },
           ] as any[];
        }

        filteredAllEmps.push(
          { id: 'dummy-e1', name: 'Budi Santoso (Dummy)', status: 'active', contract_end_date: format(new Date(Date.now() + 14 * 86400000), "yyyy-MM-dd"), unit_id: 'u1' } as any,
          { id: 'dummy-e2', name: 'Dewi Lestari (Dummy)', status: 'active', contract_end_date: format(new Date(Date.now() + 5 * 86400000), "yyyy-MM-dd"), unit_id: 'u2' } as any
        );
        unitsData.push(
          { id: 'u1', name: 'Unit Akademik' } as any,
          { id: 'u2', name: 'Unit Keuangan' } as any
        );
        // -------------------------------------------

        if (isMounted.current) {
          setEmployees(filteredEmps);
          setAllEmployees(filteredAllEmps);
          setAttendanceRecords(attData);
          setApprovals(apprData);
          setTasks(tasksData);
          setUnits(unitsData);
          setAgendas(agendasData);

          const totalEmployees = filteredEmps.length;
          const presentToday = attData.filter((r: any) => r.date === today && r.status === "present").length;
          const pendingApprovals = apprData.filter((r: any) => r.status === "pending").length;
          const activeTasks = tasksData.length;
          
          const newStats = {
            totalEmployees,
            presentToday,
            pendingApprovals,
            activeTasks,
          };
          setStats(newStats);
          
          globalDashboardStatsCache = newStats;
          globalDashboardEmployeesCache = activeEmps;
          globalDashboardAllEmployeesCache = empRes?.data || [];
          globalDashboardAttendanceRecordsCache = attData;
          globalDashboardApprovalsCache = apprData;
          globalDashboardTasksCache = tasksData;
          globalDashboardUnitsCache = unitsData;
          globalDashboardAgendasCache = agendasData;
        }
      }

      if (isEmployee && employee) {
        // ========= DATA KARYAWAN PRIBADI =========
        const thirtyDaysAgo = format(new Date(Date.now() - 30 * 86400000), "yyyy-MM-dd");

        const [personalAttRes, personalApprRes, personalTasksRes, personalAgendasRes] = await Promise.all([
          supabaseFetchWithTimeout(
            supabase.from("attendance").select("*").eq("employee_id", employee.id).gte("date", thirtyDaysAgo).order("date", { ascending: false }),
            20000
          ),
          supabaseFetchWithTimeout(
            supabase.from("approvals").select("*").eq("employee_id", employee.id).order("created_at", { ascending: false }).limit(10),
            20000
          ),
          supabaseFetchWithTimeout(
            supabase.from("tasks").select("*").eq("assigned_to", employee.id).in("status", ["todo", "in_progress"]).order("due_date", { ascending: true }),
            20000
          ),
          supabaseFetchWithTimeout(
            supabase.from("agendas").select("*, employees(name)").eq("employee_id", employee.id).eq("date", today).order("time", { ascending: true }),
            20000
          ),
        ]);

        // Fetch today's attendance record untuk check-in widget
        const { data: recent } = await supabase
          .from("attendance")
          .select("*")
          .eq("employee_id", employee.id)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let todayResData = null;

        if (recent) {
          if (recent.date === today) {
            todayResData = recent;
          } else if (!recent.check_out && recent.check_in) {
            const checkInTime = new Date(recent.check_in).getTime();
            const now = new Date().getTime();
            const hoursDiff = (now - checkInTime) / (1000 * 60 * 60);
            if (hoursDiff <= 18) {
              todayResData = recent;
            }
          }
        }

        if (isMounted.current) {
          setPersonalAttendance(personalAttRes?.data || []);
          setPersonalApprovals(personalApprRes?.data || []);
          setTasks(personalTasksRes?.data || []);
          setAgendas(personalAgendasRes?.data || []);
          setTodayRecord(todayResData);
          
          globalDashboardPersonalAttendanceCache = personalAttRes?.data || [];
          globalDashboardPersonalApprovalsCache = personalApprRes?.data || [];
          globalDashboardTasksCache = personalTasksRes?.data || [];
          globalDashboardAgendasCache = personalAgendasRes?.data || [];
          globalDashboardTodayRecordCache = todayResData;
        }
      }
    } catch (err) {
      console.error("Dashboard: Unexpected error", err);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        isFirstFetch.current = false;
      }
    }
  }, [employee, isAdminOrHr, isEmployee, isDirector, effectiveInstansiId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {`${getGreeting()}, ${employee?.name?.split(" ")[0] ?? "Admin"} 👋`}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(), "EEEE, dd MMMM yyyy", { locale: localeId })}
          </p>
        </div>
      </div>

      {/* Dashboard Manajerial: super_admin & hr & director & unit_leader */}
      {(isAdminOrHr || isDirector || isUnitLeader) && (
        <ManagerialDashboard
          stats={stats}
          attendanceRecords={attendanceRecords}
          employees={employees}
          allEmployees={allEmployees}
          units={units}
          approvals={approvals}
          agendas={agendas}
          loading={loading}
          isUnitLeader={isUnitLeader && !isAdminOrHr && !isDirector}
        />
      )}

      {/* Dashboard Karyawan Pribadi: employee yang bukan unit leader */}
      {(isEmployee && !isUnitLeader) && employee && (
        <EmployeeDashboard
          employee={employee}
          todayRecord={todayRecord}
          attendanceRecords={personalAttendance}
          tasks={tasks}
          agendas={agendas}
          approvals={personalApprovals}
          loading={loading}
          onCheckInSuccess={fetchData}
        />
      )}
    </DashboardLayout>
  );
}
