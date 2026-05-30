import { useMemo } from "react";
import { format, differenceInDays, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ExpiringContractsCardProps {
  employees: any[];
  units: any[];
  loading: boolean;
  isGlobalMode?: boolean;
}

export function ExpiringContractsCard({ employees, units, loading, isGlobalMode }: ExpiringContractsCardProps) {
  const navigate = useNavigate();

  const expiringEmployees = useMemo(() => {
    const today = new Date();
    const unitMap = new Map<string, string>();
    units.forEach((u: any) => unitMap.set(u.id, u.name));

    return employees
      .filter((e: any) => {
        if (!e.contract_end_date) return false;
        const endDate = parseISO(e.contract_end_date);
        const daysLeft = differenceInDays(endDate, today);
        return daysLeft >= 0 && daysLeft <= 30;
      })
      .map((e: any) => {
        const endDate = parseISO(e.contract_end_date);
        const daysLeft = differenceInDays(endDate, today);
        return {
          id: e.id,
          name: e.name,
          unit: e.unit_id ? (unitMap.get(e.unit_id) || "-") : "-",
          endDate: format(endDate, "dd MMM yyyy", { locale: localeId }),
          daysLeft,
          status: e.status, // We can also add status to display
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [employees, units]);

  return (
    <Card className="bg-card rounded-xl border shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[hsl(38,92%,50%)]" />
            Kontrak Segera Habis
          </CardTitle>
          {expiringEmployees.length > 0 && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap text-[hsl(38,55%,30%)] bg-[hsl(38,55%,94%)] border-[hsl(38,55%,88%)]">
              {expiringEmployees.length} orang
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
            Memuat data...
          </div>
        ) : expiringEmployees.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">
            <p>Tidak ada kontrak yang akan habis dalam 30 hari ke depan</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {expiringEmployees.map((emp) => (
              <div
                key={emp.id}
                onClick={() => !isGlobalMode && navigate("/employees")}
                className={`flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 transition-colors group ${
                  !isGlobalMode ? "hover:bg-muted/50 cursor-pointer" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium text-foreground truncate transition-colors ${!isGlobalMode ? "group-hover:text-primary" : ""}`}>
                    {emp.name} {emp.status === "on_leave" && <span className="text-[10px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded ml-1">Cuti</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{emp.unit}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-[11px] text-muted-foreground">{emp.endDate}</p>
                  <span
                    className={`text-[11px] font-semibold ${
                      emp.daysLeft <= 7
                        ? "text-[hsl(0,55%,35%)]"
                        : "text-[hsl(38,55%,30%)]"
                    }`}
                  >
                    {emp.daysLeft === 0 ? "Hari ini!" : `${emp.daysLeft} hari lagi`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
