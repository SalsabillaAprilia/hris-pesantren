import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AttendanceLogTableProps {
  records: any[];
  loading: boolean;
  isAdminOrHr: boolean;
}

export function AttendanceLogTable({ records, loading, isAdminOrHr }: AttendanceLogTableProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLTableSectionElement>(null);

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

  const handleHorizontalScroll = () => {
    if (scrollContainerRef.current) {
      const scrolled = scrollContainerRef.current.scrollLeft > 2;
      if (scrolled !== isScrolled) setIsScrolled(scrolled);
    }
  };

  const totalHadir = records.filter(r => r.check_in).length;
  const totalTelat = records.filter(r => r.late_minutes && r.late_minutes > 0).length;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const totalMangkir = records.filter(r => !r.check_in && new Date(r.date) < todayStart).length;

  return (
    <div className="space-y-4">
      {!isAdminOrHr && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-muted/20 border rounded-lg">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-slate-700 whitespace-nowrap">Riwayat Presensi Saya</h3>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-xs font-semibold">
              Hadir: {totalHadir}
            </div>
            <div className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-xs font-semibold">
              Telat: {totalTelat}
            </div>
            <div className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-xs font-semibold">
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
                  className={`sticky left-0 z-[40] bg-muted transition-none w-[40px] min-w-[40px] font-semibold text-center
                    ${isScrolled ? 'bg-muted' : ''}`}
                >
                  No.
                </TableHead>
                {isAdminOrHr && (
                  <TableHead
                    className={`sticky left-[40px] z-[40] bg-muted transition-none w-[180px] min-w-[180px] font-semibold
                      ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.3)]' : 'shadow-none'}`}
                  >
                    Karyawan
                  </TableHead>
                )}
                <TableHead className="font-semibold">Tanggal</TableHead>
                <TableHead className="font-semibold">Check-in</TableHead>
                <TableHead className="font-semibold">Check-out</TableHead>
                <TableHead className="font-semibold text-center w-[120px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={isAdminOrHr ? 6 : 5} className="text-center py-8 text-sm text-muted-foreground">
                    Memuat...
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdminOrHr ? 6 : 5} className="text-center py-8 text-sm text-muted-foreground">
                    Belum ada data absensi
                  </TableCell>
                </TableRow>
              ) : (
                records.map((r) => {
                  const isPast = new Date(r.date) < todayStart;
                  const isMangkir = !r.check_in && isPast;
                  const statusLabel = r.daily_status || (isMangkir ? "Mangkir" : r.check_in ? "Hadir" : "Belum mulai");
                  
                  return (
                    <TableRow key={r.id} className="hover:bg-muted/50 transition-colors h-11 group border-b text-sm">
                      <TableCell className={`sticky left-0 z-[20] bg-white text-center transition-all duration-75 w-[40px] max-w-[40px] min-w-[40px] group-hover:bg-[#f8fafc] py-1.5 text-slate-500 ${!isAdminOrHr && isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.25)]' : ''}`}>
                        {records.indexOf(r) + 1}
                      </TableCell>
                      {isAdminOrHr && (
                        <TableCell
                          className={`sticky left-[40px] z-[20] bg-white font-semibold transition-all duration-75 w-[180px] max-w-[180px] min-w-[180px] group-hover:bg-[#f8fafc] py-1.5 truncate text-slate-900
                            ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.25)]' : 'shadow-none'}`}
                        >
                          {r.employees?.name ?? "—"}
                        </TableCell>
                      )}
                      <TableCell className="text-slate-900 py-1.5 font-medium">
                        {format(new Date(r.date), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-slate-900 py-1.5">
                        {r.check_in ? format(new Date(r.check_in), "HH:mm") : "—"}
                        {r.late_minutes && r.late_minutes > 0 ? (
                          <span className="ml-2 text-[10px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">+{r.late_minutes}m</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-slate-900 py-1.5">
                        {r.check_out ? format(new Date(r.check_out), "HH:mm") : "—"}
                      </TableCell>
                      <TableCell className="text-slate-900 py-1.5 text-center">
                        {isMangkir ? (
                          <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">Mangkir</span>
                        ) : statusLabel.toLowerCase() === "hadir" ? (
                           <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">Hadir</span>
                        ) : statusLabel === "Belum mulai" ? (
                           <span className="text-xs font-semibold text-slate-500">—</span>
                        ) : (
                           <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">{statusLabel}</span>
                        )}
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
