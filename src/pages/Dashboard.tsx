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

interface DashboardCache {
  stats: Stats;
  todayRecord: any | null;
  attendanceRecords: any[];
  employees: any[];
  allEmployees: any[];
  units: any[];
  approvals: any[];
  agendas: any[];
  tasks: any[];
  personalAttendance: any[];
  personalApprovals: any[];
}

const defaultStats: Stats = {
  totalEmployees: 0,
  presentToday: 0,
  pendingApprovals: 0,
  activeTasks: 0,
};

const globalDashboardCaches: Record<string, DashboardCache> = {};

export default function Dashboard() {
  const { employee, isAdminOrHr, isEmployee, hasRole, isDirector, isGlobalRole, selectedInstansiId, allInstitutions } = useAuth();
  const { effectiveInstansiId } = useInstansiFilter();
  const isUnitLeader = hasRole("unit_leader");
  const isGlobalMode = isGlobalRole && !selectedInstansiId;

  const cacheKey = effectiveInstansiId || "global";
  const initialCache = globalDashboardCaches[cacheKey];

  const [lastCacheKey, setLastCacheKey] = useState(cacheKey);

  const [stats, setStats] = useState<Stats>(initialCache?.stats || defaultStats);
  const [todayRecord, setTodayRecord] = useState<any>(initialCache?.todayRecord || null);
  const [loading, setLoading] = useState(!initialCache);

  // Data untuk chart & card
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>(initialCache?.attendanceRecords || []);
  const [employees, setEmployees] = useState<any[]>(initialCache?.employees || []);
  const [allEmployees, setAllEmployees] = useState<any[]>(initialCache?.allEmployees || []);
  const [units, setUnits] = useState<any[]>(initialCache?.units || []);
  const [approvals, setApprovals] = useState<any[]>(initialCache?.approvals || []);
  const [agendas, setAgendas] = useState<any[]>(initialCache?.agendas || []);
  const [tasks, setTasks] = useState<any[]>(initialCache?.tasks || []);
  // Riwayat presensi personal (untuk karyawan)
  const [personalAttendance, setPersonalAttendance] = useState<any[]>(initialCache?.personalAttendance || []);
  const [personalApprovals, setPersonalApprovals] = useState<any[]>(initialCache?.personalApprovals || []);

  if (cacheKey !== lastCacheKey) {
    const cache = globalDashboardCaches[cacheKey];
    setLastCacheKey(cacheKey);
    setStats(cache?.stats || defaultStats);
    setTodayRecord(cache?.todayRecord || null);
    setLoading(!cache);
    setAttendanceRecords(cache?.attendanceRecords || []);
    setEmployees(cache?.employees || []);
    setAllEmployees(cache?.allEmployees || []);
    setUnits(cache?.units || []);
    setApprovals(cache?.approvals || []);
    setAgendas(cache?.agendas || []);
    setTasks(cache?.tasks || []);
    setPersonalAttendance(cache?.personalAttendance || []);
    setPersonalApprovals(cache?.personalApprovals || []);
  }

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchData = useCallback(async () => {
    // If there is no cache for current branch, set loading true
    if (!globalDashboardCaches[effectiveInstansiId || "global"]) {
      setLoading(true);
    }
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
              return supabase.from("user_roles").select("user_id, role, instansi_id");
            })(),
            20000
          ),
        ]);

        const rolesMap = new Map();
        (rolesRes?.data || []).forEach((r: any) => {
          if (r.instansi_id) {
            rolesMap.set(`${r.user_id}_${r.instansi_id}`, r.role);
          } else {
            rolesMap.set(`${r.user_id}_global`, r.role);
          }
        });
        
        // Filter karyawan yang statusnya aktif DAN rolenya hanya 'employee' atau 'unit_leader'
        const activeEmps = (empRes?.data || []).filter((emp: any) => {
          let r = rolesMap.get(`${emp.user_id}_${emp.instansi_id}`);
          if (!r) r = rolesMap.get(`${emp.user_id}_global`);
          if (!r) r = "employee"; // Default 'employee' jika belum ada role eksplisit
          
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
            filteredEmps = activeEmps.filter(e => e.unit_id === myUnitId && e.user_id !== employee?.user_id);
            filteredAllEmps = filteredAllEmps.filter(e => e.unit_id === myUnitId && e.user_id !== employee?.user_id);
            const subordinateIds = new Set(filteredAllEmps.map(e => e.id));
            attData = attData.filter(a => subordinateIds.has(a.employee_id));
            apprData = apprData.filter(a => subordinateIds.has(a.employee_id));
            tasksData = tasksData.filter((t: any) => subordinateIds.has(t.assigned_to));
            unitsData = unitsData.filter((u: any) => u.id === myUnitId);
            agendasData = agendasData.filter((a: any) => subordinateIds.has(a.employee_id));
          } else {
            filteredEmps = [];
            filteredAllEmps = [];
            attData = [];
            apprData = [];
            tasksData = [];
            unitsData = [];
            agendasData = [];
          }
        }

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
          
          const currentCacheKey = effectiveInstansiId || "global";
          globalDashboardCaches[currentCacheKey] = {
            ...(globalDashboardCaches[currentCacheKey] || {}),
            stats: newStats,
            employees: filteredEmps,
            allEmployees: filteredAllEmps,
            attendanceRecords: attData,
            approvals: apprData,
            tasks: tasksData,
            units: unitsData,
            agendas: agendasData,
            // Ensure we don't wipe out personal data if it exists
            todayRecord: globalDashboardCaches[currentCacheKey]?.todayRecord || null,
            personalAttendance: globalDashboardCaches[currentCacheKey]?.personalAttendance || [],
            personalApprovals: globalDashboardCaches[currentCacheKey]?.personalApprovals || []
          };
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
          
          const currentCacheKey = effectiveInstansiId || "global";
          globalDashboardCaches[currentCacheKey] = {
            ...(globalDashboardCaches[currentCacheKey] || {}),
            personalAttendance: personalAttRes?.data || [],
            personalApprovals: personalApprRes?.data || [],
            tasks: personalTasksRes?.data || [],
            agendas: personalAgendasRes?.data || [],
            todayRecord: todayResData,
            // Ensure we don't wipe out managerial data if it exists
            stats: globalDashboardCaches[currentCacheKey]?.stats || defaultStats,
            employees: globalDashboardCaches[currentCacheKey]?.employees || [],
            allEmployees: globalDashboardCaches[currentCacheKey]?.allEmployees || [],
            attendanceRecords: globalDashboardCaches[currentCacheKey]?.attendanceRecords || [],
            approvals: globalDashboardCaches[currentCacheKey]?.approvals || [],
            units: globalDashboardCaches[currentCacheKey]?.units || [],
          };
        }
      }
    } catch (err) {
      console.error("Dashboard: Unexpected error", err);
    } finally {
      if (isMounted.current) {
        setLoading(false);
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
          isGlobalMode={isGlobalMode}
          institutions={allInstitutions}
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
