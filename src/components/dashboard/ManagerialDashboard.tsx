import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, FileCheck, ListTodo } from "lucide-react";
import { WeeklyAttendanceChart } from "./WeeklyAttendanceChart";
import { UnitDistributionChart } from "./UnitDistributionChart";
import { ExpiringContractsCard } from "./ExpiringContractsCard";
import { RecentApprovalsCard } from "./RecentApprovalsCard";
import { TodayAgendaCard } from "./TodayAgendaCard";

interface Stats {
  totalEmployees: number;
  presentToday: number;
  pendingApprovals: number;
  activeTasks: number;
}

interface ManagerialDashboardProps {
  stats: Stats;
  attendanceRecords: any[];
  employees: any[];
  allEmployees: any[];
  units: any[];
  approvals: any[];
  agendas: any[];
  loading: boolean;
  isUnitLeader?: boolean;
}

export function ManagerialDashboard({
  stats,
  attendanceRecords,
  employees,
  allEmployees,
  units,
  approvals,
  agendas,
  loading,
  isUnitLeader = false,
}: ManagerialDashboardProps) {
  const statCards = [
    {
      label: "Karyawan Aktif",
      value: stats.totalEmployees,
      icon: Users,
      gradient: "from-[hsl(232,59%,21%)] to-[hsl(232,50%,30%)]",
      iconBg: "bg-white/15",
    },
    {
      label: "Hadir Hari Ini",
      value: stats.presentToday,
      icon: Clock,
      gradient: "from-[hsl(162,60%,35%)] to-[hsl(162,50%,45%)]",
      iconBg: "bg-white/15",
    },
    {
      label: "Pengajuan Baru",
      value: stats.pendingApprovals,
      icon: FileCheck,
      gradient: "from-[hsl(38,80%,45%)] to-[hsl(38,70%,55%)]",
      iconBg: "bg-white/15",
    },
    {
      label: "Tugas Aktif",
      value: stats.activeTasks,
      icon: ListTodo,
      gradient: "from-[hsl(198,64%,35%)] to-[hsl(198,55%,48%)]",
      iconBg: "bg-white/15",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards — modern gradient style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${s.gradient} p-5 text-white shadow-lg hover:shadow-xl transition-shadow`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">{s.label}</p>
                <p className="text-3xl font-bold mt-1 tracking-tight">
                  {loading ? "—" : s.value}
                </p>
              </div>
              <div className={`p-2.5 rounded-lg ${s.iconBg}`}>
                <s.icon className="h-5 w-5 text-white" />
              </div>
            </div>
            {/* Decorative circle */}
            <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/5" />
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className={`grid grid-cols-1 ${!isUnitLeader ? "lg:grid-cols-2" : ""} gap-4`}>
        <WeeklyAttendanceChart attendanceRecords={attendanceRecords} loading={loading} />
        {!isUnitLeader && (
          <UnitDistributionChart employees={employees} units={units} loading={loading} />
        )}
      </div>

      {/* Info Cards Row */}
      <div className={`grid grid-cols-1 ${!isUnitLeader ? "lg:grid-cols-3" : "lg:grid-cols-2"} gap-4`}>
        <RecentApprovalsCard approvals={approvals} loading={loading} />
        <TodayAgendaCard agendas={agendas} loading={loading} />
        {!isUnitLeader && (
          <ExpiringContractsCard employees={allEmployees} units={units} loading={loading} />
        )}
      </div>
    </div>
  );
}
