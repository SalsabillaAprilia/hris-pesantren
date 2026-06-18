import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PendingAgendaCardProps {
  pendingAgendas: any[];
  loading: boolean;
}

export function PendingAgendaCard({ pendingAgendas, loading }: PendingAgendaCardProps) {
  const navigate = useNavigate();
  return (
    <Card 
      className="bg-card rounded-xl border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => navigate("/agenda?tab=tim")}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          Menunggu Review Agenda
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
            Memuat data...
          </div>
        ) : pendingAgendas.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">
            Belum ada agenda tim menunggu direview
          </div>
        ) : (
          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {pendingAgendas.slice(0, 5).map((agenda, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{agenda.employees?.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Tanggal Kegiatan: {agenda.start_date}
                  </p>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap shrink-0 ml-3 text-[hsl(38,55%,30%)] bg-[hsl(38,55%,94%)] border-[hsl(38,55%,88%)]">
                  Menunggu
                </span>
              </div>
            ))}
            {pendingAgendas.length > 5 && (
              <div className="text-center pt-2">
                <span className="text-xs text-muted-foreground hover:text-blue-600 cursor-pointer font-medium">
                  Lihat {pendingAgendas.length - 5} lainnya...
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
