import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, FileCheck, ListTodo } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { CheckInOutWidget } from "@/components/attendance/CheckInOutWidget";
import { supabaseFetchWithTimeout } from "@/utils/supabase-fetch";

interface Stats {
  totalEmployees: number;
  presentToday: number;
  pendingApprovals: number;
  activeTasks: number;
}

export default function Dashboard() {
  const { employee, isAdminOrHr, isSuperAdmin } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalEmployees: 0,
    presentToday: 0,
    pendingApprovals: 0,
    activeTasks: 0,
  });
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      
      const fetchGlobalStats = async () => {
        const emp = await supabase.from("employees").select("id", { count: "exact", head: true }).eq("status", "active");
        if (!emp.error) setStats(prev => ({ ...prev, totalEmployees: emp.count ?? 0 }));
        
        const att = await supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", today);
        if (!att.error) setStats(prev => ({ ...prev, presentToday: att.count ?? 0 }));

        const appr = await supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "pending");
        if (!appr.error) setStats(prev => ({ ...prev, pendingApprovals: appr.count ?? 0 }));

        const tasks = await supabase.from("tasks").select("id", { count: "exact", head: true }).in("status", ["todo", "in_progress"]);
        if (!tasks.error) setStats(prev => ({ ...prev, activeTasks: tasks.count ?? 0 }));
      };

      const fetchUserAttendance = async () => {
        if (employee) {
          const { data } = await supabase
            .from("attendance")
            .select("*")
            .eq("employee_id", employee.id)
            .eq("date", today)
            .maybeSingle();
          setTodayRecord(data);
        }
      };

      await Promise.all([fetchGlobalStats(), fetchUserAttendance()]);
    } catch (err) {
      console.error("Dashboard: Unexpected error", err);
    } finally {
      setLoading(false);
    }
  }, [employee]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const statCards = [
    { label: "Total Karyawan", value: stats.totalEmployees, icon: Users, color: "text-primary" },
    { label: "Hadir Hari Ini", value: stats.presentToday, icon: Clock, color: "text-success" },
    { label: "Pending Approval", value: stats.pendingApprovals, icon: FileCheck, color: "text-warning" },
    { label: "Tugas Aktif", value: stats.activeTasks, icon: ListTodo, color: "text-accent-foreground" },
  ];

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>

      <div className="mb-8 max-w-2xl">
        <CheckInOutWidget 
          employee={employee} 
          todayRecord={todayRecord} 
          onSuccess={fetchStats} 
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loading ? "—" : s.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}
