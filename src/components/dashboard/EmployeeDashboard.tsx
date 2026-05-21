import { CheckInOutWidget } from "@/components/attendance/CheckInOutWidget";
import { MyAttendanceSummary } from "./MyAttendanceSummary";
import { MyTasksCard } from "./MyTasksCard";
import { TodayAgendaCard } from "./TodayAgendaCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileCheck } from "lucide-react";
import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useMemo } from "react";

interface EmployeeDashboardProps {
  employee: any;
  todayRecord: any;
  attendanceRecords: any[];
  tasks: any[];
  agendas: any[];
  approvals: any[];
  loading: boolean;
  onCheckInSuccess: () => void;
}

const statusConfig: Record<string, { label: string; class: string }> = {
  pending: {
    label: "Menunggu",
    class: "text-[hsl(38,55%,30%)] bg-[hsl(38,55%,94%)] border-[hsl(38,55%,88%)]",
  },
  approved_unit_leader: {
    label: "Disetujui KU",
    class: "text-[hsl(198,55%,25%)] bg-[hsl(198,55%,94%)] border-[hsl(198,55%,88%)]",
  },
  approved_hr: {
    label: "Disetujui",
    class: "text-[hsl(142,45%,25%)] bg-[hsl(142,45%,96%)] border-[hsl(142,45%,90%)]",
  },
  rejected: {
    label: "Ditolak",
    class: "text-[hsl(0,55%,35%)] bg-[hsl(0,55%,96%)] border-[hsl(0,55%,90%)]",
  },
};

const typeLabel: Record<string, string> = {
  leave: "Cuti",
  permission: "Izin",
  overtime: "Lembur",
};

export function EmployeeDashboard({
  employee,
  todayRecord,
  attendanceRecords,
  tasks,
  agendas,
  approvals,
  loading,
  onCheckInSuccess,
}: EmployeeDashboardProps) {
  const recentApprovals = useMemo(() => {
    return approvals
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3)
      .map((a) => ({
        id: a.id,
        type: typeLabel[a.type] || a.type,
        status: a.status,
        startDate: format(parseISO(a.start_date), "dd MMM", { locale: localeId }),
        endDate: format(parseISO(a.end_date), "dd MMM", { locale: localeId }),
      }));
  }, [approvals]);

  return (
    <div className="space-y-6">
      {/* Check-in Widget */}
      <div className="max-w-2xl">
        <CheckInOutWidget
          employee={employee}
          todayRecord={todayRecord}
          onSuccess={onCheckInSuccess}
        />
      </div>

      {/* Ringkasan Kehadiran Bulan Ini */}
      <MyAttendanceSummary
        attendanceRecords={attendanceRecords}
        approvals={approvals}
        loading={loading}
      />

      {/* Tugas + Agenda Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MyTasksCard tasks={tasks} loading={loading} />
        <TodayAgendaCard agendas={agendas} loading={loading} />
      </div>

      {/* Status Pengajuan Terakhir */}
      <Card className="bg-card rounded-xl border shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-primary" />
            Pengajuan Terakhir Saya
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[80px] flex items-center justify-center text-muted-foreground text-sm">
              Memuat data...
            </div>
          ) : recentApprovals.length === 0 ? (
            <div className="py-4 text-center text-muted-foreground text-sm">
              Belum ada pengajuan
            </div>
          ) : (
            <div className="space-y-2">
              {recentApprovals.map((item) => {
                const cfg = statusConfig[item.status] || statusConfig.pending;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.type}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {item.startDate} – {item.endDate}
                      </p>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${cfg.class}`}
                    >
                      {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
