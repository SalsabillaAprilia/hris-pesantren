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

  return (
    <div className="relative border rounded-md bg-white flex flex-col">
      <div
        ref={scrollContainerRef}
        onScroll={handleHorizontalScroll}
        className="overflow-x-auto overflow-y-visible flex-1 h-auto relative"
      >
        <table className="w-full caption-bottom text-sm relative border-separate border-spacing-0 min-w-[500px]">
          <TableHeader
            ref={headerRef}
            className="z-20 transition-none [&_th]:sticky [&_th]:top-[var(--sticky-offset)] [&_th:not(.sticky)]:z-30 [&_th:not(.sticky)]:bg-muted"
            style={{ "--sticky-offset": "0px" } as React.CSSProperties}
          >
            <TableRow className="border-none hover:bg-transparent">
              {isAdminOrHr && (
                <TableHead
                  className={`sticky left-0 z-[40] bg-muted transition-none w-[180px] min-w-[180px] font-semibold
                    ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.3)]' : 'shadow-none'}`}
                >
                  Karyawan
                </TableHead>
              )}
              <TableHead className="font-semibold">Tanggal</TableHead>
              <TableHead className="font-semibold">Check-in</TableHead>
              <TableHead className="font-semibold">Check-out</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={isAdminOrHr ? 4 : 3} className="text-center py-8 text-xs text-muted-foreground">
                  Memuat...
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdminOrHr ? 4 : 3} className="text-center py-8 text-xs text-muted-foreground">
                  Belum ada data absensi
                </TableCell>
              </TableRow>
            ) : (
              records.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/50 transition-colors h-11 group border-b text-xs">
                  {isAdminOrHr && (
                    <TableCell
                      className={`sticky left-0 z-[20] bg-white font-semibold transition-all duration-75 w-[180px] max-w-[180px] min-w-[180px] group-hover:bg-[#f8fafc] py-1.5 text-xs truncate text-slate-900
                        ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.25)]' : 'shadow-none'}`}
                    >
                      {r.employees?.name ?? "—"}
                    </TableCell>
                  )}
                  <TableCell className="text-xs text-slate-900 py-1.5">
                    {format(new Date(r.date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-xs text-slate-900 py-1.5">
                    {r.check_in ? format(new Date(r.check_in), "HH:mm") : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-slate-900 py-1.5">
                    {r.check_out ? format(new Date(r.check_out), "HH:mm") : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </table>
      </div>
    </div>
  );
}
