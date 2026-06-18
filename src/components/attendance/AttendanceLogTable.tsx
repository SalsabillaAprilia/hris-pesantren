import { useState, useMemo, useRef, useEffect } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AttendanceLogTableProps {
  records: any[];
  loading: boolean;
  isAdminOrHr: boolean;
}

export function AttendanceLogTable({ records, loading, isAdminOrHr }: AttendanceLogTableProps) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>(String(now.getMonth() + 1).padStart(2, "0"));
  const [selectedYear, setSelectedYear] = useState<string>(String(now.getFullYear()));
  const [isScrolled, setIsScrolled] = useState(false);
  const [expandedCells, setExpandedCells] = useState<Record<string, boolean>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLTableSectionElement>(null);

  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i));
  const months = [
    { value: "01", label: "Januari" }, { value: "02", label: "Februari" },
    { value: "03", label: "Maret" }, { value: "04", label: "April" },
    { value: "05", label: "Mei" }, { value: "06", label: "Juni" },
    { value: "07", label: "Juli" }, { value: "08", label: "Agustus" },
    { value: "09", label: "September" }, { value: "10", label: "Oktober" },
    { value: "11", label: "November" }, { value: "12", label: "Desember" },
  ];

  const filteredRecords = useMemo(() => {
    return records
      .filter(r => {
        const d = r.date?.slice(0, 7); // "yyyy-MM"
        return d === `${selectedYear}-${selectedMonth}`;
      })
      .sort((a, b) => {
        if (a.date !== b.date) {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        const nameA = a.employees?.name || "";
        const nameB = b.employees?.name || "";
        return nameA.localeCompare(nameB);
      });
  }, [records, selectedMonth, selectedYear]);

  const recalculateSticky = () => {
    const mainEl = document.querySelector('main');
    if (!mainEl || !scrollContainerRef.current || !headerRef.current) return;
    const rect = scrollContainerRef.current.getBoundingClientRect();
    const stickThreshold = Math.max(0, mainEl.getBoundingClientRect().top);
    let finalOffset = 0;
    if (rect.top < stickThreshold) {
      const maxOffset = rect.height - 44;
      const offset = Math.min(stickThreshold - rect.top, maxOffset);
      finalOffset = Math.max(0, offset);
    }
    headerRef.current.style.setProperty('--sticky-offset', `${finalOffset}px`);
  };

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => { recalculateSticky(); ticking = false; });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('resize', handleScroll);
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(recalculateSticky, 50);
    return () => clearTimeout(timer);
  }, [records]);

  const toggleExpand = (cellId: string) => {
    setExpandedCells(prev => ({ ...prev, [cellId]: !prev[cellId] }));
  };

  const handleHorizontalScroll = () => {
    if (scrollContainerRef.current) {
      const scrolled = scrollContainerRef.current.scrollLeft > 2;
      if (scrolled !== isScrolled) setIsScrolled(scrolled);
    }
  };

  const totalHadir = filteredRecords.filter(r => r.check_in && !['Mangkir','Izin','Cuti','Sakit'].includes(r.daily_status)).length;
  const totalTelat = filteredRecords.filter(r => r.late_minutes && r.late_minutes > 0).length;
  
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const totalMangkir = filteredRecords.filter(r => r.daily_status === 'Mangkir').length;
  const totalIzin = filteredRecords.filter(r => ['Izin','Cuti','Sakit'].includes(r.daily_status)).length;

  return (
    <div className="space-y-4">
      {!isAdminOrHr && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-muted/20 border rounded-lg mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-700 whitespace-nowrap mr-2">Riwayat Presensi</h3>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-9 text-sm text-slate-900 shadow-sm border-primary/20 w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {months.map(m => (
                  <SelectItem key={m.value} value={m.value} className="text-sm">{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="h-9 text-sm text-slate-900 shadow-sm border-primary/20 w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={y} className="text-sm">{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="px-3 h-9 flex items-center bg-[hsl(142,45%,96%)] text-[hsl(142,45%,25%)] border border-[hsl(142,45%,90%)] rounded-md text-xs font-semibold">
              Hadir: {totalHadir}
            </div>
            <div className="px-3 h-9 flex items-center bg-[hsl(38,55%,94%)] text-[hsl(38,55%,30%)] border border-[hsl(38,55%,88%)] rounded-md text-xs font-semibold">
              Terlambat: {totalTelat}
            </div>
            <div className="px-3 h-9 flex items-center bg-[hsl(232,59%,96%)] text-[hsl(232,59%,21%)] border border-[hsl(232,59%,90%)] rounded-md text-xs font-semibold">
              Berhalangan: {totalIzin}
            </div>
            <div className="px-3 h-9 flex items-center bg-[hsl(0,55%,96%)] text-[hsl(0,55%,35%)] border border-[hsl(0,55%,90%)] rounded-md text-xs font-semibold">
              Mangkir: {totalMangkir}
            </div>
          </div>
        </div>
      )}

      <div className="relative border rounded-md bg-white flex flex-col">
        <div
          ref={scrollContainerRef}
          onScroll={handleHorizontalScroll}
          className="overflow-x-auto overflow-y-visible flex-1 h-auto relative"
        >
          <table className="w-full caption-bottom text-sm relative border-separate border-spacing-0 min-w-[600px]">
            <TableHeader
              ref={headerRef}
              className="z-20 transition-none [&_th]:sticky [&_th]:top-[var(--sticky-offset)] [&_th:not(.sticky)]:z-30 [&_th:not(.sticky)]:bg-muted"
              style={{ "--sticky-offset": "0px" } as React.CSSProperties}
            >
              <TableRow className="border-none hover:bg-transparent">
                <TableHead 
                  className={`sticky left-0 z-[40] bg-muted transition-none w-[40px] min-w-[40px] font-semibold text-center whitespace-nowrap
                    ${isScrolled ? 'bg-muted' : ''}`}
                >
                  No.
                </TableHead>
                {isAdminOrHr && (
                  <TableHead
                    className={`sticky left-[40px] z-[40] bg-muted transition-none w-[180px] min-w-[180px] font-semibold whitespace-nowrap
                      ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.3)]' : 'shadow-none'}`}
                  >
                    Karyawan
                  </TableHead>
                )}
                <TableHead className="font-semibold whitespace-nowrap text-left">Tanggal</TableHead>
                <TableHead className="font-semibold whitespace-nowrap text-center">Check-in</TableHead>
                <TableHead className="font-semibold whitespace-nowrap text-center">Check-out</TableHead>
                <TableHead className="font-semibold text-center w-[120px] whitespace-nowrap">Status</TableHead>
                <TableHead className="font-semibold w-[200px] whitespace-nowrap">Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={isAdminOrHr ? 7 : 6} className="text-center py-8 text-sm text-muted-foreground">
                    Memuat...
                  </TableCell>
                </TableRow>
              ) : filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdminOrHr ? 7 : 6} className="text-center py-8 text-sm text-muted-foreground">
                    Tidak ada data untuk bulan ini
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((r) => {
                  const isPast = new Date(r.date) < todayStart;
                  const isMangkir = !r.check_in && isPast;
                  
                  // Lupa check-out jika sudah ada check-in tapi belum check-out dan sudah lewat 18 jam
                  const isLupaCheckOut = r.check_in && !r.check_out && ((new Date().getTime() - new Date(r.check_in).getTime()) > 18 * 60 * 60 * 1000);
                  
                  const statusLabel = r.daily_status || (isMangkir ? "Mangkir" : isLupaCheckOut ? "Lupa Check-out" : r.check_in ? "Hadir" : "Belum mulai");
                  
                  return (
                    <TableRow key={r.id} className="hover:bg-muted/50 transition-colors h-11 group border-b text-sm">
                      <TableCell className={`sticky left-0 z-[20] bg-white text-center transition-all duration-75 w-[40px] max-w-[40px] min-w-[40px] group-hover:bg-[#f8fafc] py-1.5 text-slate-500 ${!isAdminOrHr && isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.25)]' : ''}`}>
                        {filteredRecords.indexOf(r) + 1}
                      </TableCell>
                      {isAdminOrHr && (
                        <TableCell
                          onClick={() => r.employees?.name && toggleExpand(`${r.id}-name`)}
                          className={`sticky left-[40px] z-[20] bg-white font-semibold transition-all duration-75 w-[180px] max-w-[180px] min-w-[180px] group-hover:bg-[#f8fafc] py-1.5 cursor-pointer text-slate-900
                            ${expandedCells[`${r.id}-name`] ? 'whitespace-normal break-words' : 'truncate'}
                            ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.25)]' : 'shadow-none'}`}
                        >
                          {r.employees?.name ?? "—"}
                        </TableCell>
                      )}
                      <TableCell className="text-slate-900 py-1.5">
                        {format(new Date(r.date), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-slate-900 py-1.5 text-center">
                        {r.check_in ? format(new Date(r.check_in), "HH:mm") : "—"}
                        {r.late_minutes && r.late_minutes > 0 ? (
                          <span className="ml-1 text-[11px] text-amber-600 font-medium">(+{r.late_minutes}m)</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-slate-900 py-1.5 text-center">
                        {r.check_out ? format(new Date(r.check_out), "HH:mm") : (isLupaCheckOut ? <span className="text-rose-500 text-xs italic">Lupa absen</span> : "—")}
                        {r.early_leave_minutes && r.early_leave_minutes > 0 ? (
                          <span className="ml-1 text-[11px] text-rose-600 font-medium">(-{r.early_leave_minutes}m)</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-slate-900 py-1.5 text-center">
                        {isMangkir ? (
                          <span className="text-[11px] font-semibold text-[hsl(0,55%,35%)] bg-[hsl(0,55%,96%)] px-2 py-0.5 rounded border border-[hsl(0,55%,90%)] whitespace-nowrap">Mangkir</span>
                        ) : isLupaCheckOut ? (
                          <span className="text-[11px] font-semibold text-[hsl(38,55%,30%)] bg-[hsl(38,55%,94%)] px-2 py-0.5 rounded border border-[hsl(38,55%,88%)] whitespace-nowrap">Lupa Check-out</span>
                        ) : statusLabel === "Hadir" || statusLabel === "WFA" ? (
                           <span className="text-[11px] font-semibold text-[hsl(142,45%,25%)] bg-[hsl(142,45%,96%)] px-2 py-0.5 rounded border border-[hsl(142,45%,90%)] whitespace-nowrap">{statusLabel}</span>
                        ) : statusLabel === "Terlambat" ? (
                           <span className="text-[11px] font-semibold text-[hsl(38,55%,30%)] bg-[hsl(38,55%,94%)] px-2 py-0.5 rounded border border-[hsl(38,55%,88%)] whitespace-nowrap">Terlambat</span>
                        ) : statusLabel === "Belum mulai" ? (
                           <span className="text-xs font-semibold text-slate-500">—</span>
                        ) : (
                           <span className="text-[11px] font-semibold text-[hsl(232,59%,21%)] bg-[hsl(232,59%,96%)] px-2 py-0.5 rounded border border-[hsl(232,59%,90%)] whitespace-nowrap">{statusLabel}</span>
                        )}
                      </TableCell>
                      <TableCell 
                        onClick={() => r.notes && toggleExpand(`${r.id}-notes`)}
                        className={`text-slate-500 py-1.5 max-w-[200px] cursor-pointer transition-all duration-200 ${expandedCells[`${r.id}-notes`] ? 'whitespace-normal break-words' : 'truncate'}`} 
                        title={r.notes || undefined}
                      >
                        {r.notes ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </table>
        </div>
      </div>
    </div>
  );
}
