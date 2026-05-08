import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Crown, ArrowRight } from "lucide-react";

interface UnitCardProps {
  unit: any;
  employeeCount: number;
  leaderName?: string;
  onClick: () => void;
}

const GRADIENTS = [
  { bg: "from-blue-500 to-blue-700", shadow: "shadow-blue-500/30", text: "text-blue-700", light: "bg-blue-50/80" },
  { bg: "from-indigo-400 to-indigo-600", shadow: "shadow-indigo-500/30", text: "text-indigo-600", light: "bg-indigo-50/80" },
  { bg: "from-sky-500 to-blue-600", shadow: "shadow-sky-500/30", text: "text-blue-600", light: "bg-sky-50/80" },
  { bg: "from-slate-600 to-slate-800", shadow: "shadow-slate-500/30", text: "text-slate-700", light: "bg-slate-50/80" },
  { bg: "from-cyan-600 to-blue-700", shadow: "shadow-cyan-600/30", text: "text-cyan-700", light: "bg-cyan-50/80" },
  { bg: "from-blue-600 to-indigo-800", shadow: "shadow-indigo-500/30", text: "text-indigo-700", light: "bg-blue-50/80" },
];

export function UnitCard({ unit, employeeCount, leaderName, onClick }: UnitCardProps) {
  // Generate a consistent index based on unit name
  const getGradientIndex = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % GRADIENTS.length;
  };

  const theme = GRADIENTS[getGradientIndex(unit.name || "Default")];

  return (
    <Card 
      className={`group hover:shadow-2xl transition-all duration-500 cursor-pointer border-slate-200/60 overflow-hidden relative active:scale-[0.98] bg-white hover:-translate-y-1 ${theme.shadow.replace('30', '10')}`}
      onClick={onClick}
    >
      {/* Dynamic Vibrant Background Decorations */}
      <div className={`absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 rounded-full bg-gradient-to-br ${theme.bg} opacity-[0.08] group-hover:opacity-[0.15] group-hover:scale-[1.8] transition-all duration-700 blur-2xl z-0`} />
      <div className={`absolute bottom-0 left-0 -ml-12 -mb-12 w-32 h-32 rounded-full bg-gradient-to-tr ${theme.bg} opacity-[0.05] group-hover:scale-[1.5] transition-all duration-700 blur-2xl z-0`} />
      
      {/* Top Colorful Accent Line */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.bg} opacity-70 group-hover:opacity-100 transition-opacity`} />
      
      <CardHeader className="flex flex-row items-start gap-4 pb-3 relative z-10 pt-5">
        <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${theme.bg} flex items-center justify-center shadow-lg ${theme.shadow} shrink-0 group-hover:scale-105 transition-transform duration-500`}>
          <Building2 className="h-7 w-7 text-white" />
        </div>
        <div className="flex-1 overflow-hidden pt-1">
          <CardTitle className="text-xl font-bold truncate text-slate-800 group-hover:text-slate-900 transition-colors duration-300">
            {unit.name}
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed font-medium">
            {unit.description || "Divisi struktur organisasi institusi pesantren."}
          </p>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 pt-2 relative z-10">
        <div className={`grid grid-cols-2 gap-4 ${theme.light} p-3 rounded-xl border border-white/50 group-hover:bg-white/80 transition-colors shadow-sm`}>
          <div className="flex flex-col">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <Users className="h-3 w-3" /> Karyawan
            </p>
            <div className="flex items-baseline gap-1.5 text-slate-800">
              <span className={`text-2xl font-bold ${theme.text}`}>{employeeCount}</span>
              <span className="text-xs text-slate-500 font-bold">Orang</span>
            </div>
          </div>
          
          <div className="flex flex-col border-l border-slate-300/40 pl-4">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <Crown className="h-3 w-3 text-[#F16D34]" /> Kepala Unit
            </p>
            {leaderName ? (
              <span className="text-sm font-bold text-slate-800 truncate pt-1">{leaderName.split(' ')[0]}</span>
            ) : (
              <span className="text-xs font-semibold text-slate-400 italic pt-1.5">Belum diatur</span>
            )}
          </div>
        </div>
        
        <div className={`pt-1 flex items-center justify-between text-xs ${theme.text} font-bold opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0`}>
          <span className="tracking-wide uppercase">Kelola Unit Ini</span>
          <div className={`h-7 w-7 rounded-full bg-gradient-to-br ${theme.bg} flex items-center justify-center text-white shadow-md ${theme.shadow}`}>
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
