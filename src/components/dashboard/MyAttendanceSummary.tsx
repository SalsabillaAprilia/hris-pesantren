import { useMemo } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle2, AlertCircle, XCircle, CalendarOff } from "lucide-react";

interface MyAttendanceSummaryProps {
  attendanceRecords: any[];
  approvals: any[];
  loading: boolean;
}

export function MyAttendanceSummary({ attendanceRecords, approvals, loading }: MyAttendanceSummaryProps) {
  const summary = useMemo(() => {
    const now = new Date();
    const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

    const thisMonthRecords = attendanceRecords.filter(
      (r) => r.date >= monthStart && r.date <= monthEnd
    );

    const hadir = thisMonthRecords.filter(
      (r) => r.daily_status && !r.daily_status.toLowerCase().includes("mangkir") && (!r.late_minutes || r.late_minutes === 0)
    ).length;

    const telat = thisMonthRecords.filter((r) => r.late_minutes && r.late_minutes > 0).length;

    const mangkir = thisMonthRecords.filter(
      (r) => r.daily_status && r.daily_status.toLowerCase().includes("mangkir")
    ).length;

    // Izin/cuti yang disetujui bulan ini
    const approvedLeaves = approvals.filter((a) => {
      if (!["approved_unit_leader", "approved_hr"].includes(a.status)) return false;
      return a.start_date >= monthStart && a.start_date <= monthEnd;
    }).length;

    return { hadir, telat, mangkir, izin: approvedLeaves };
  }, [attendanceRecords, approvals]);

  const items = [
    {
      label: "Hadir",
      value: summary.hadir,
      icon: CheckCircle2,
      colorClass: "text-[hsl(142,45%,25%)] bg-[hsl(142,45%,96%)] border-[hsl(142,45%,90%)]",
      iconColor: "text-[hsl(142,45%,35%)]",
    },
    {
      label: "Telat",
      value: summary.telat,
      icon: AlertCircle,
      colorClass: "text-[hsl(38,55%,30%)] bg-[hsl(38,55%,94%)] border-[hsl(38,55%,88%)]",
      iconColor: "text-[hsl(38,80%,45%)]",
    },
    {
      label: "Izin/Cuti",
      value: summary.izin,
      icon: CalendarOff,
      colorClass: "text-[hsl(232,59%,21%)] bg-[hsl(232,59%,96%)] border-[hsl(232,59%,90%)]",
      iconColor: "text-[hsl(232,59%,40%)]",
    },
    {
      label: "Mangkir",
      value: summary.mangkir,
      icon: XCircle,
      colorClass: "text-[hsl(0,55%,35%)] bg-[hsl(0,55%,96%)] border-[hsl(0,55%,90%)]",
      iconColor: "text-[hsl(0,55%,45%)]",
    },
  ];

  return (
    <Card className="bg-card rounded-xl border shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Kehadiran Bulan Ini
          </CardTitle>
          <span className="text-[11px] text-muted-foreground">
            {format(new Date(), "MMMM yyyy", { locale: localeId })}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[80px] flex items-center justify-center text-muted-foreground text-sm">
            Memuat data...
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {items.map((item) => (
              <div
                key={item.label}
                className={`flex flex-col items-center py-3 px-2 rounded-lg border ${item.colorClass} transition-colors`}
              >
                <item.icon className={`h-5 w-5 mb-1 ${item.iconColor}`} />
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-[11px] font-medium">{item.label}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
