import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { useTerminology } from "@/hooks/useTerminology";

// Palette harmonis berdasarkan warna sistem (navy + teal + warm)
const COLORS = [
  "hsl(232, 59%, 30%)",   // navy
  "hsl(198, 64%, 45%)",   // teal/accent
  "hsl(162, 60%, 45%)",   // success green
  "hsl(38, 80%, 55%)",    // warm amber
  "hsl(280, 50%, 50%)",   // purple
  "hsl(350, 60%, 55%)",   // rose
  "hsl(170, 45%, 55%)",   // mint
  "hsl(20, 70%, 55%)",    // orange
];

interface UnitDistributionChartProps {
  employees: any[];
  units: any[];
  loading: boolean;
}

export function UnitDistributionChart({ employees, units, loading }: UnitDistributionChartProps) {
  const { term } = useTerminology();

  const chartData = useMemo(() => {
    const unitMap = new Map<string, string>();
    units.forEach((u: any) => unitMap.set(u.id, u.name));

    const counts = new Map<string, number>();
    employees.forEach((e: any) => {
      const unitName = e.unit_id ? (unitMap.get(e.unit_id) || "Lainnya") : `Tanpa ${term}`;
      counts.set(unitName, (counts.get(unitName) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [employees, units]);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card className="bg-card rounded-xl border shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          Distribusi Karyawan per {term}
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
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={2}
                stroke="white"
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(232, 20%, 90%)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  fontSize: "12px",
                  backgroundColor: "white",
                }}
                formatter={(value: number, name: string) => [
                  `${value} orang (${total > 0 ? Math.round((value / total) * 100) : 0}%)`,
                  name,
                ]}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "11px" }}
                formatter={(value: string) => {
                  const item = chartData.find((d) => d.name === value);
                  return `${value} (${item?.value || 0})`;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
