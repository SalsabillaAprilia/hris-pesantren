import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

interface TodayAgendaCardProps {
  agendas: any[];
  loading: boolean;
}

const statusConfig: Record<string, { label: string; class: string }> = {
  todo: {
    label: "Belum",
    class: "text-[hsl(232,59%,21%)] bg-[hsl(232,59%,96%)] border-[hsl(232,59%,90%)]",
  },
  on_progress: {
    label: "Berjalan",
    class: "text-[hsl(38,55%,30%)] bg-[hsl(38,55%,94%)] border-[hsl(38,55%,88%)]",
  },
  done: {
    label: "Selesai",
    class: "text-[hsl(142,45%,25%)] bg-[hsl(142,45%,96%)] border-[hsl(142,45%,90%)]",
  },
  cancelled: {
    label: "Batal",
    class: "text-[hsl(0,55%,35%)] bg-[hsl(0,55%,96%)] border-[hsl(0,55%,90%)]",
  },
};

export function TodayAgendaCard({ agendas, loading }: TodayAgendaCardProps) {
  const todayAgendas = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return agendas
      .filter((a) => a.date === today)
      .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
      .slice(0, 5)
      .map((a) => ({
        id: a.id,
        activity: a.activity,
        time: a.time ? a.time.substring(0, 5) : "--:--",
        status: a.status,
        employeeName: a.employees?.name || "-",
      }));
  }, [agendas]);

  return (
    <Card className="bg-card rounded-xl border shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Agenda Hari Ini
          </CardTitle>
          <span className="text-[11px] text-muted-foreground">
            {format(new Date(), "dd MMMM yyyy", { locale: localeId })}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
            Memuat data...
          </div>
        ) : todayAgendas.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">
            Tidak ada agenda hari ini
          </div>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {todayAgendas.map((item) => {
              const cfg = statusConfig[item.status] || statusConfig.todo;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="text-center shrink-0 w-12">
                    <p className="text-sm font-bold text-primary">{item.time}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{item.activity}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{item.employeeName}</p>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap shrink-0 ${cfg.class}`}
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
  );
}
