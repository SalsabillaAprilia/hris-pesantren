import { useState, useMemo, useRef, useEffect } from "react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

interface AdminSummaryAttendanceProps {
  records: any[];
  loading: boolean;
}

export function AdminSummaryAttendance({ records, loading }: AdminSummaryAttendanceProps) {
  const [startDate, setStartDate] = useState<string>(
    format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
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
  }, [records, startDate, endDate]);

  const handleHorizontalScroll = () => {
    if (scrollContainerRef.current) {
      const scrolled = scrollContainerRef.current.scrollLeft > 2;
      if (scrolled !== isScrolled) setIsScrolled(scrolled);
    }
  };

  const summaryData = useMemo(() => {
    const filtered = records.filter(r => r.date >= startDate && r.date <= endDate);
    const map = new Map<string, any>();
    filtered.forEach(r => {
      const empId = r.employee_id;
      if (!map.has(empId)) {
        map.set(empId, {
          employee_id: empId,
          name: r.employees?.name ?? "—",
          employee_id_number: r.employees?.employee_id_number ?? "—",
          hadir: 0, telat: 0, total_late_minutes: 0,
          overtime: 0, cuti: 0, sakit: 0, izin: 0, mangkir: 0,
        });
      }
      const stat = map.get(empId);
      if (r.daily_status === 'Cuti') stat.cuti++;
      else if (r.daily_status === 'Sakit') stat.sakit++;
      else if (r.daily_status === 'Izin') stat.izin++;
      else if (r.daily_status === 'Mangkir') stat.mangkir++;
      else {
        if (r.check_in) stat.hadir++;
        if (r.late_minutes && r.late_minutes > 0) { stat.telat++; stat.total_late_minutes += r.late_minutes; }
        if (r.overtime_minutes && r.overtime_minutes > 0) stat.overtime += r.overtime_minutes;
      }
    });
    return Array.from(map.values());
  }, [records, startDate, endDate]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-muted/20 border rounded-lg mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Periode Laporan:</label>
          <div className="flex items-center gap-2">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm w-[135px] h-9 px-2 bg-white shadow-sm" />
            <span className="text-muted-foreground text-sm font-medium">—</span>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm w-[135px] h-9 px-2 bg-white shadow-sm" />
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          Ringkasan <span className="font-bold text-slate-900">{summaryData.length}</span> karyawan
        </div>
      </div>

      <div className="relative border rounded-md bg-white flex flex-col">
        <div
          ref={scrollContainerRef}
          onScroll={handleHorizontalScroll}
          className="overflow-x-auto overflow-y-visible flex-1 h-auto relative"
        >
          <table className="w-full caption-bottom text-sm relative border-separate border-spacing-0 min-w-[1100px]">
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
                <TableHead
                  className={`sticky left-[40px] z-[40] bg-muted transition-none w-[180px] min-w-[180px] font-semibold
                    ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.3)]' : 'shadow-none'}`}
                >
                  Nama
                </TableHead>
                <TableHead className="font-semibold w-[120px]">ID Karyawan</TableHead>
                <TableHead className="font-semibold w-[80px] text-center">Hadir</TableHead>
                <TableHead className="font-semibold w-[80px] text-center">Terlambat</TableHead>
                <TableHead className="font-semibold w-[110px] text-center">Durasi Telat</TableHead>
                <TableHead className="font-semibold w-[90px] text-center">Lembur</TableHead>
                <TableHead className="font-semibold w-[70px] text-center">Cuti</TableHead>
                <TableHead className="font-semibold w-[70px] text-center">Sakit</TableHead>
                <TableHead className="font-semibold w-[70px] text-center">Izin</TableHead>
                <TableHead className="font-semibold w-[80px] text-center">Mangkir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-sm text-muted-foreground">Memuat...</TableCell></TableRow>
              ) : summaryData.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-sm text-muted-foreground">Tidak ada data untuk periode ini</TableCell></TableRow>
              ) : (
                summaryData.map((stat) => (
                  <TableRow key={stat.employee_id} className="hover:bg-muted/50 transition-colors h-11 group border-b text-sm">
                    <TableCell className={`sticky left-0 z-[20] bg-white text-center transition-all duration-75 w-[40px] max-w-[40px] min-w-[40px] group-hover:bg-[#f8fafc] py-1.5 text-slate-500`}>
                      {summaryData.indexOf(stat) + 1}
                    </TableCell>
                    <TableCell
                      className={`sticky left-[40px] z-[20] bg-white font-semibold transition-all duration-75 w-[180px] max-w-[180px] min-w-[180px] group-hover:bg-[#f8fafc] py-1.5 truncate text-slate-900
                        ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.25)]' : 'shadow-none'}`}
                    >
                      {stat.name}
                    </TableCell>
                    <TableCell className="text-slate-900 py-1.5">{stat.employee_id_number}</TableCell>
                    <TableCell className="text-sm text-slate-900 py-1.5 text-center">{stat.hadir}</TableCell>
                    <TableCell className="text-sm text-slate-900 py-1.5 text-center">{stat.telat}</TableCell>
                    <TableCell className="text-sm py-1.5 text-center">
                      {stat.total_late_minutes > 0 ? <span className="text-red-500 font-medium">{stat.total_late_minutes}mnt</span> : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-900 py-1.5 text-center">{stat.overtime > 0 ? `${stat.overtime}mnt` : "—"}</TableCell>
                    <TableCell className="text-sm text-slate-900 py-1.5 text-center">{stat.cuti}</TableCell>
                    <TableCell className="text-sm text-slate-900 py-1.5 text-center">{stat.sakit}</TableCell>
                    <TableCell className="text-sm text-slate-900 py-1.5 text-center">{stat.izin}</TableCell>
                    <TableCell className="text-sm text-slate-900 py-1.5 text-center">{stat.mangkir}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </table>
        </div>
      </div>
    </div>
  );
}
