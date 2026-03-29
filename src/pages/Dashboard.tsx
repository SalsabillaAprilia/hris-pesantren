import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, FileCheck, ListTodo } from "lucide-react";

interface Stats {
  totalEmployees: number;
  presentToday: number;
  pendingApprovals: number;
  activeTasks: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalEmployees: 0,
    presentToday: 0,
    pendingApprovals: 0,
    activeTasks: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const [emp, att, appr, tasks] = await Promise.all([
          supabase.from("employees").select("id", { count: "exact", head: true }).eq("status", "active"),
          supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", today),
          supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabase.from("tasks").select("id", { count: "exact", head: true }).in("status", ["todo", "in_progress"]),
        ]);
        
        setStats({
          totalEmployees: emp.count ?? 0,
          presentToday: att.count ?? 0,
          pendingApprovals: appr.count ?? 0,
          activeTasks: tasks.count ?? 0,
        });
      } catch (err) {
        console.error("Dashboard: Unexpected error", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

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
        <p className="page-description">Ringkasan data organisasi pesantren</p>
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
