import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface ReportFiltersProps {
  month: number;
  year: number;
  unitId: string;
  units: any[];
  onMonthChange: (m: number) => void;
  onYearChange: (y: number) => void;
  onUnitChange: (u: string) => void;
}

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function ReportFilters({
  month, year, unitId, units, onMonthChange, onYearChange, onUnitChange,
}: ReportFiltersProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-3 p-4 bg-muted/20 border rounded-lg">
      <div className="space-y-1.5 min-w-[140px]">
        <Label className="text-xs text-muted-foreground font-semibold">Bulan</Label>
        <Select value={String(month)} onValueChange={(v) => onMonthChange(Number(v))}>
          <SelectTrigger className="h-9 text-sm shadow-sm"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-[250px]">
            {MONTHS.map((m, i) => (
              <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 min-w-[100px]">
        <Label className="text-xs text-muted-foreground font-semibold">Tahun</Label>
        <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
          <SelectTrigger className="h-9 text-sm shadow-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 min-w-[160px]">
        <Label className="text-xs text-muted-foreground font-semibold">Unit Kerja</Label>
        <Select value={unitId} onValueChange={onUnitChange}>
          <SelectTrigger className="h-9 text-sm shadow-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Unit</SelectItem>
            {units.map((u: any) => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
