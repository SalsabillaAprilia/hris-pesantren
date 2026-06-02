import * as React from "react"
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react"
import { format, parse } from "date-fns"
import { id } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface MonthPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

export function MonthPicker({ value, onChange, className }: MonthPickerProps) {
  const [open, setOpen] = React.useState(false);
  
  // Extract year from "YYYY-MM"
  const parsedDate = value ? parse(value, "yyyy-MM", new Date()) : new Date();
  const [currentYear, setCurrentYear] = React.useState(parsedDate.getFullYear());

  // Reset internal year state when popup opens
  React.useEffect(() => {
    if (open && value) {
      setCurrentYear(parse(value, "yyyy-MM", new Date()).getFullYear());
    }
  }, [open, value]);

  const handleMonthSelect = (monthIndex: number) => {
    const paddedMonth = (monthIndex + 1).toString().padStart(2, "0");
    onChange(`${currentYear}-${paddedMonth}`);
    setOpen(false); // Auto close after selection
  };

  const getDisplayValue = () => {
    if (!value) return "Pilih Bulan";
    return format(parse(value, "yyyy-MM", new Date()), "MMMM yyyy", { locale: id });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[160px] h-9 text-sm justify-start text-left font-medium bg-white/50 shadow-sm border-primary/20 transition-all transform active:scale-95",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
          {getDisplayValue()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-4 rounded-xl shadow-xl border-slate-200" align="start">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 bg-transparent p-0 text-slate-500 hover:text-slate-900 border-slate-200"
              onClick={() => setCurrentYear((prev) => prev - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-bold text-slate-800">
              {currentYear}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 bg-transparent p-0 text-slate-500 hover:text-slate-900 border-slate-200"
              onClick={() => setCurrentYear((prev) => prev + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            {MONTHS.map((month, index) => {
              const paddedMonth = (index + 1).toString().padStart(2, "0");
              const isSelected = value === `${currentYear}-${paddedMonth}`;
              
              return (
                <Button
                  key={month}
                  variant={isSelected ? "default" : "ghost"}
                  className={cn(
                    "h-9 text-sm font-medium rounded-lg transition-all",
                    isSelected 
                      ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90" 
                      : "text-slate-600 hover:bg-accent hover:text-accent-foreground"
                  )}
                  onClick={() => handleMonthSelect(index)}
                >
                  {month.slice(0, 3)}
                </Button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
