import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Crown } from "lucide-react";

interface UnitCardProps {
  unit: any;
  employeeCount: number;
  leaderName?: string;
  onClick: () => void;
}

export function UnitCard({ unit, employeeCount, leaderName, onClick }: UnitCardProps) {
  return (
    <Card 
      className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-slate-200 overflow-hidden relative active:scale-[0.98]"
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center gap-4 pb-2 relative z-10">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors duration-300">
          <Building2 className="h-6 w-6" />
        </div>
        <div className="flex-1 overflow-hidden">
          <CardTitle className="text-lg font-bold truncate group-hover:text-primary transition-colors">{unit.name}</CardTitle>
          <p className="text-xs text-muted-foreground truncate">{unit.description || "Unit organisasi"}</p>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 pt-2 relative z-10">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Karyawan</p>
            <div className="flex items-center gap-1.5 text-slate-900">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xl font-bold">{employeeCount}</span>
            </div>
          </div>
          
          {leaderName && (
            <div className="flex flex-col border-l border-slate-100 pl-4">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Kepala Unit</p>
              <div className="flex items-center gap-1.5 text-[#F16D34]">
                <Crown className="h-3.5 w-3.5" />
                <span className="text-xs font-bold truncate">{leaderName.split(' ')[0]}</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-primary font-bold opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0">
          LIHAT DETAIL UNIT
          <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
            →
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
