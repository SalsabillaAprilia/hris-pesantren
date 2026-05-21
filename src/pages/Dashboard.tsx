import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
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

export default function Dashboard() {
  const { employee, isAdminOrHr, isEmployee, hasRole, isDirector } = useAuth();
  const isUnitLeader = hasRole("unit_leader");

  const [stats, setStats] = useState<Stats>({
    totalEmployees: 0,
    presentToday: 0,
    pendingApprovals: 0,
    activeTasks: 0,
  });
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Data untuk chart & card
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [agendas, setAgendas] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  // Riwayat presensi personal (untuk karyawan)
  const [personalAttendance, setPersonalAttendance] = useState<any[]>([]);
  const [personalApprovals, setPersonalApprovals] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const today = format(new Date(), "yyyy-MM-dd");

      if (isAdminOrHr || isDirector) {
        // ========= DATA MANAJERIAL =========
        const [empRes, attRes, apprRes, tasksRes, unitsRes, agendasRes] = await Promise.all([
          supabaseFetchWithTimeout(
            supabase.from("employees").select("*").eq("status", "active"),
            20000
          ),
          supabaseFetchWithTimeout(
            supabase.from("attendance").select("*").gte("date", format(new Date(Date.now() - 7 * 86400000), "yyyy-MM-dd")).order("date", { ascending: false }),
            20000
          ),
          supabaseFetchWithTimeout(
            supabase.from("approvals").select("*, employees(name)").order("created_at", { ascending: false }).limit(20),
            20000
          ),
          supabaseFetchWithTimeout(
            supabase.from("tasks").select("*").in("status", ["todo", "in_progress"]),
            20000
          ),
          supabaseFetchWithTimeout(
            supabase.from("units").select("*"),
            20000
          ),
          supabaseFetchWithTimeout(
            supabase.from("agendas").select("*, employees(name)").eq("date", today).order("time", { ascending: true }),
            20000
          ),
        ]);

        const activeEmps = empRes?.data || [];
        const attData = attRes?.data || [];
        const apprData = apprRes?.data || [];
        const tasksData = tasksRes?.data || [];
        const unitsData = unitsRes?.data || [];
        const agendasData = agendasRes?.data || [];

        setEmployees(activeEmps);
        setAttendanceRecords(attData);
        setApprovals(apprData);
        setTasks(tasksData);
        setUnits(unitsData);
        setAgendas(agendasData);

        // Stat cards
        const todayAtt = attData.filter((r: any) => r.date === today);
        const pendingAppr = apprData.filter((r: any) => r.status === "pending");
        setStats({
          totalEmployees: activeEmps.length,
          presentToday: todayAtt.length,
          pendingApprovals: pendingAppr.length,
          activeTasks: tasksData.length,
        });
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

        setPersonalAttendance(personalAttRes?.data || []);
        setPersonalApprovals(personalApprRes?.data || []);
        setTasks(personalTasksRes?.data || []);
        setAgendas(personalAgendasRes?.data || []);

        // Fetch today's attendance record untuk check-in widget
        const { data: recent } = await supabase
          .from("attendance")
          .select("*")
          .eq("employee_id", employee.id)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (recent) {
          if (recent.date === today) {
            setTodayRecord(recent);
          } else if (!recent.check_out && recent.check_in) {
            const checkInTime = new Date(recent.check_in).getTime();
            const now = new Date().getTime();
            const hoursDiff = (now - checkInTime) / (1000 * 60 * 60);
            if (hoursDiff <= 18) {
              setTodayRecord(recent);
            }
          }
        }
      }
    } catch (err) {
      console.error("Dashboard: Unexpected error", err);
    } finally {
      setLoading(false);
    }
  }, [employee, isAdminOrHr, isEmployee, isDirector]);

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

      {/* Dashboard Manajerial: super_admin & hr & director */}
      {(isAdminOrHr || isDirector) && (
        <ManagerialDashboard
          stats={stats}
          attendanceRecords={attendanceRecords}
          employees={employees}
          units={units}
          approvals={approvals}
          agendas={agendas}
          loading={loading}
        />
      )}

      {/* Dashboard Karyawan Pribadi: employee & unit_leader */}
      {isEmployee && employee && (
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
