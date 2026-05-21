import { useMemo } from "react";
import { format, subDays } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface WeeklyAttendanceChartProps {
  attendanceRecords: any[];
  loading: boolean;
}

export function WeeklyAttendanceChart({ attendanceRecords, loading }: WeeklyAttendanceChartProps) {
  const chartData = useMemo(() => {
    const today = new Date();
    const days: { date: string; label: string; Hadir: number; Telat: number; Mangkir: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i);
      const dateStr = format(d, "yyyy-MM-dd");
      const label = format(d, "EEE, dd", { locale: localeId });

      const dayRecords = attendanceRecords.filter((r) => r.date === dateStr);
      const hadir = dayRecords.filter(
        (r) => r.daily_status && !r.daily_status.toLowerCase().includes("mangkir") && (!r.late_minutes || r.late_minutes === 0)
      ).length;
      const telat = dayRecords.filter((r) => r.late_minutes && r.late_minutes > 0).length;
      // Mangkir = records explicitly marked as mangkir
      const mangkir = dayRecords.filter(
        (r) => r.daily_status && r.daily_status.toLowerCase().includes("mangkir")
      ).length;

      days.push({ date: dateStr, label, Hadir: hadir, Telat: telat, Mangkir: mangkir });
    }

    return days;
  }, [attendanceRecords]);

  return (
    <Card className="bg-card rounded-xl border shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Kehadiran 7 Hari Terakhir
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">
            Memuat data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(232, 20%, 90%)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "hsl(232, 20%, 45%)" }}
                axisLine={{ stroke: "hsl(232, 20%, 90%)" }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "hsl(232, 20%, 45%)" }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(232, 20%, 90%)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  fontSize: "12px",
                  backgroundColor: "white",
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              />
              <Bar dataKey="Hadir" fill="hsl(162, 60%, 45%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Telat" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Mangkir" fill="hsl(0, 70%, 50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
