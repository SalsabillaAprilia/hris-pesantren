import { Badge } from "@/components/ui/badge";

export const calculateMasaKerja = (joinDate: string | null) => {
  if (!joinDate) return "—";
  const start = new Date(joinDate);
  const end = new Date();
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  if (months < 0) {
    years--;
    months += 12;
  }
  return `${years} thn ${months} bln`;
};

export const getStatusBadge = (status: string) => {
  if (status === 'active') {
    return <span className="text-[11px] font-semibold text-[hsl(142,45%,25%)] bg-[hsl(142,45%,96%)] px-2 py-0.5 rounded border border-[hsl(142,45%,90%)] whitespace-nowrap">Aktif</span>;
  }
  if (status === 'inactive') {
    return <span className="text-[11px] font-semibold text-[hsl(0,55%,35%)] bg-[hsl(0,55%,96%)] px-2 py-0.5 rounded border border-[hsl(0,55%,90%)] whitespace-nowrap">Nonaktif</span>;
  }
  if (status === 'on_leave') {
    return <span className="text-[11px] font-semibold text-[hsl(38,55%,30%)] bg-[hsl(38,55%,94%)] px-2 py-0.5 rounded border border-[hsl(38,55%,88%)] whitespace-nowrap">Cuti</span>;
  }
  
  return (
    <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap">
      {status}
    </span>
  );
};
