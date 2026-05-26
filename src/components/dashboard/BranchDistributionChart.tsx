import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// Palette harmonis berdasarkan warna sistem
const COLORS = [
  "hsl(232, 59%, 30%)",
  "hsl(198, 64%, 45%)",
  "hsl(162, 60%, 45%)",
  "hsl(38, 80%, 55%)",
  "hsl(280, 50%, 50%)",
  "hsl(350, 60%, 55%)",
  "hsl(170, 45%, 55%)",
  "hsl(20, 70%, 55%)",
];

interface BranchDistributionChartProps {
  /** Semua karyawan dari semua cabang (tanpa filter instansi) */
  allEmployees: any[];
  /** Daftar semua institusi/cabang */
  institutions: any[];
  loading: boolean;
}

export function BranchDistributionChart({
  allEmployees,
  institutions,
  loading,
}: BranchDistributionChartProps) {
  const chartData = useMemo(() => {
    const instMap = new Map<string, string>();
    institutions.forEach((i: any) => instMap.set(i.id, i.name));

    const counts = new Map<string, number>();
    allEmployees.forEach((e: any) => {
      const branchName = e.instansi_id
        ? (instMap.get(e.instansi_id) || "Tidak Diketahui")
        : "Tanpa Cabang";
      counts.set(branchName, (counts.get(branchName) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [allEmployees, institutions]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="rounded-lg border bg-white p-2.5 shadow-md"
          style={{ fontSize: "12px" }}
        >
          <p className="font-semibold text-foreground mb-1">{label}</p>
          <p className="text-muted-foreground">
            <span className="font-bold text-foreground">{payload[0].value}</span> karyawan
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-card rounded-xl border shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          Distribusi Karyawan per Cabang
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">
            Memuat data...
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">
            Belum ada data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              barCategoryGap="30%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(232,20%,94%)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "hsl(232,20%,50%)" }}
                axisLine={false}
                tickLine={false}
                interval={0}
                tickFormatter={(v: string) => v.length > 12 ? v.substring(0, 10) + "…" : v}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: "hsl(232,20%,50%)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(232,20%,97%)" }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
