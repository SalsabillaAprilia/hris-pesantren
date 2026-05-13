import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Crown, ArrowRight } from "lucide-react";

interface UnitCardProps {
  unit: any;
  employeeCount: number;
  leaderName?: string;
  onClick: () => void;
}

// Subtle accent variants — all derived from the system's primary (navy) + accent (steel blue) palette
const ACCENTS = [
  { strip: "from-[hsl(232,59%,21%)] to-[hsl(232,59%,35%)]",   icon: "bg-[hsl(232,59%,21%)]",   badge: "bg-[hsl(232,59%,96%)] text-[hsl(232,59%,21%)]",   stat: "bg-[hsl(232,40%,97%)]" },
  { strip: "from-[hsl(198,64%,35%)] to-[hsl(198,64%,50%)]",   icon: "bg-[hsl(198,64%,35%)]",   badge: "bg-[hsl(198,64%,94%)] text-[hsl(198,64%,30%)]",   stat: "bg-[hsl(198,40%,97%)]" },
  { strip: "from-[hsl(220,60%,25%)] to-[hsl(220,60%,38%)]",   icon: "bg-[hsl(220,60%,25%)]",   badge: "bg-[hsl(220,40%,96%)] text-[hsl(220,60%,25%)]",   stat: "bg-[hsl(220,30%,97%)]" },
  { strip: "from-[hsl(232,50%,30%)] to-[hsl(198,64%,45%)]",   icon: "bg-[hsl(232,50%,30%)]",   badge: "bg-[hsl(215,50%,96%)] text-[hsl(232,50%,30%)]",   stat: "bg-[hsl(215,30%,97%)]" },
  { strip: "from-[hsl(198,64%,28%)] to-[hsl(232,59%,42%)]",   icon: "bg-[hsl(198,64%,28%)]",   badge: "bg-[hsl(198,50%,95%)] text-[hsl(198,64%,25%)]",   stat: "bg-[hsl(198,30%,97%)]" },
  { strip: "from-[hsl(215,55%,22%)] to-[hsl(215,55%,38%)]",   icon: "bg-[hsl(215,55%,22%)]",   badge: "bg-[hsl(215,40%,96%)] text-[hsl(215,55%,22%)]",   stat: "bg-[hsl(215,25%,97%)]" },
];

export function UnitCard({ unit, employeeCount, leaderName, onClick }: UnitCardProps) {
  const getAccentIndex = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % ACCENTS.length;
  };

  const accent = ACCENTS[getAccentIndex(unit.name || "Default")];

  return (
    <Card
      className="group relative cursor-pointer overflow-hidden border border-slate-200/80 bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 active:scale-[0.98]"
      onClick={onClick}
    >
      {/* Top accent strip */}
      <div className={`absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r ${accent.strip}`} />

      {/* Subtle background glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-50/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <CardHeader className="relative z-10 flex flex-row items-start gap-3 pt-5 pb-3">
        {/* Icon */}
        <div className={`h-11 w-11 rounded-xl ${accent.icon} flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform duration-300`}>
          <Building2 className="h-5 w-5 text-white" />
        </div>

        {/* Title + description */}
        <div className="flex-1 min-w-0 pt-0.5">
          <CardTitle className="text-base font-bold text-slate-800 truncate leading-tight">
            {unit.name}
          </CardTitle>
          <div className="h-8 mt-1">
            {unit.description && (
              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                {unit.description}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative z-10 pt-1 pb-4 space-y-3">
        {/* Stats row */}
        <div className={`flex items-stretch rounded-lg ${accent.stat} border border-slate-100 overflow-hidden`}>
          {/* Karyawan */}
          <div className="flex-1 flex flex-col items-center justify-center py-2.5 px-3 gap-0.5">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              <Users className="h-3 w-3" />
              Karyawan
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-extrabold text-slate-800">{employeeCount}</span>
              <span className="text-[10px] text-slate-400 font-medium">orang</span>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px bg-slate-200/80 my-2" />

          {/* Kepala Unit */}
          <div className="flex-1 flex flex-col items-center justify-center py-2.5 px-3 gap-0.5">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              <Crown className="h-3 w-3 text-amber-400" />
              Kepala Unit
            </div>
            {leaderName ? (
              <span className="text-xs font-bold text-slate-700 truncate max-w-full mt-0.5 text-center">
                {leaderName.split(" ")[0]}
              </span>
            ) : (
              <span className="text-[11px] text-slate-300 italic mt-0.5">Belum diatur</span>
            )}
          </div>
        </div>

        {/* Hover CTA */}
        <div className="flex items-center justify-between opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-300">
          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${accent.badge}`}>
            Lihat Detail
          </span>
          <div className={`h-6 w-6 rounded-full ${accent.icon} flex items-center justify-center shadow-sm`}>
            <ArrowRight className="h-3.5 w-3.5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
