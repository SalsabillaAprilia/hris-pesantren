import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

interface AdminDailyAttendanceProps {
  records: any[];
  loading: boolean;
}

export function AdminDailyAttendance({ records, loading }: AdminDailyAttendanceProps) {
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
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
  }, [records, selectedDate]);

  const handleHorizontalScroll = () => {
    if (scrollContainerRef.current) {
      const scrolled = scrollContainerRef.current.scrollLeft > 2;
      if (scrolled !== isScrolled) setIsScrolled(scrolled);
    }
  };

  const filteredRecords = records.filter(r => r.date === selectedDate);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-muted/20 border rounded-lg mb-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Tanggal Kehadiran:</label>
          <div className="w-[150px]">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-sm h-9 px-3 bg-white shadow-sm"
            />
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          Menampilkan <span className="font-bold text-slate-900">{filteredRecords.length}</span> rekam kehadiran
        </div>
      </div>

      <div className="relative border rounded-md bg-white flex flex-col">
        <div
          ref={scrollContainerRef}
          onScroll={handleHorizontalScroll}
          className="overflow-x-auto overflow-y-visible flex-1 h-auto relative"
        >
          <table className="w-full caption-bottom text-sm relative border-separate border-spacing-0 min-w-[1200px]">
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
                <TableHead className="font-semibold w-[130px]">Unit</TableHead>
                <TableHead className="font-semibold w-[130px]">Jabatan</TableHead>
                <TableHead className="font-semibold w-[100px]">Masuk</TableHead>
                <TableHead className="font-semibold w-[100px]">Keluar</TableHead>
                <TableHead className="font-semibold w-[90px]">Lembur</TableHead>
                <TableHead className="font-semibold w-[90px]">Terlambat</TableHead>
                <TableHead className="font-semibold w-[90px]">Status</TableHead>
                <TableHead className="font-semibold">Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-sm text-muted-foreground">Memuat...</TableCell></TableRow>
              ) : filteredRecords.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-sm text-muted-foreground">Tidak ada data untuk tanggal ini</TableCell></TableRow>
              ) : (
                filteredRecords.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/50 transition-colors h-11 group border-b text-sm">
                    <TableCell className={`sticky left-0 z-[20] bg-white text-center transition-all duration-75 w-[40px] max-w-[40px] min-w-[40px] group-hover:bg-[#f8fafc] py-1.5 text-slate-500`}>
                      {filteredRecords.indexOf(r) + 1}
                    </TableCell>
                    <TableCell
                      className={`sticky left-[40px] z-[20] bg-white font-semibold transition-all duration-75 w-[180px] max-w-[180px] min-w-[180px] group-hover:bg-[#f8fafc] py-1.5 truncate text-slate-900
                        ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.25)]' : 'shadow-none'}`}
                    >
                      {r.employees?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-slate-900 py-1.5">{r.employees?.employee_id_number ?? "—"}</TableCell>
                    <TableCell className="text-slate-900 py-1.5 truncate max-w-[130px]">{r.employees?.units?.name ?? "—"}</TableCell>
                    <TableCell className="text-slate-900 py-1.5 truncate max-w-[130px]">{r.employees?.position ?? "—"}</TableCell>
                    <TableCell className="text-slate-900 py-1.5">{r.check_in ? format(new Date(r.check_in), "HH:mm") : "—"}</TableCell>
                    <TableCell className="text-slate-900 py-1.5">{r.check_out ? format(new Date(r.check_out), "HH:mm") : "—"}</TableCell>
                    <TableCell className="text-slate-900 py-1.5">{r.overtime_minutes ? `${r.overtime_minutes}mnt` : "—"}</TableCell>
                    <TableCell className="py-1.5">
                      {r.late_minutes ? <span className="text-red-500 font-medium">{r.late_minutes}mnt</span> : "—"}
                    </TableCell>
                    <TableCell className="text-slate-900 py-1.5">{r.daily_status ?? "Hadir"}</TableCell>
                    <TableCell className="text-slate-500 py-1.5 truncate max-w-[120px]">{r.notes ?? "—"}</TableCell>
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
