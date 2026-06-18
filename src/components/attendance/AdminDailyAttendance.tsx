import { useState, useRef, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useTerminology } from "@/hooks/useTerminology";

interface AdminDailyAttendanceProps {
  records: any[];
  loading: boolean;
}

export function AdminDailyAttendance({ records, loading }: AdminDailyAttendanceProps) {
  const { term } = useTerminology();
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [isScrolled, setIsScrolled] = useState(false);
  const [expandedCells, setExpandedCells] = useState<Record<string, boolean>>({});
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

  const toggleExpand = (cellId: string) => {
    setExpandedCells(prev => ({ ...prev, [cellId]: !prev[cellId] }));
  };

  const filteredRecords = useMemo(() => {
    return records
      .filter(r => r.date === selectedDate)
      .sort((a, b) => {
        const nameA = (a.employees?.name || "").toLowerCase();
        const nameB = (b.employees?.name || "").toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [records, selectedDate]);

  const totalHadir   = filteredRecords.filter(r => r.check_in && !['Mangkir','Izin','Cuti','Sakit'].includes(r.daily_status)).length;
  const totalTelat   = filteredRecords.filter(r => r.late_minutes && r.late_minutes > 0).length;
  const totalIzin    = filteredRecords.filter(r => ['Izin','Cuti','Sakit'].includes(r.daily_status)).length;
  const totalMangkir = filteredRecords.filter(r => r.daily_status === 'Mangkir').length;

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

      <div className="relative border rounded-md bg-white flex flex-col">
        <div
          ref={scrollContainerRef}
          onScroll={handleHorizontalScroll}
          className="overflow-x-auto overflow-y-visible flex-1 h-auto relative"
        >
          <table className="w-full caption-bottom text-sm relative border-separate border-spacing-0 min-w-[1250px]">
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
                <TableHead
                  className={`sticky left-[40px] z-[40] bg-muted transition-none w-[180px] min-w-[180px] font-semibold whitespace-nowrap
                    ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.3)]' : 'shadow-none'}`}
                >
                  Nama
                </TableHead>
                <TableHead className="font-semibold w-[120px] whitespace-nowrap text-left">ID Karyawan</TableHead>
                <TableHead className="font-semibold w-[130px] whitespace-nowrap text-center">{term}</TableHead>
                <TableHead className="font-semibold w-[130px] whitespace-nowrap text-left">Jabatan</TableHead>
                <TableHead className="font-semibold w-[100px] whitespace-nowrap text-center">Datang</TableHead>
                <TableHead className="font-semibold w-[100px] whitespace-nowrap text-center">Keluar</TableHead>
                <TableHead className="font-semibold w-[90px] whitespace-nowrap text-center">Lembur</TableHead>
                <TableHead className="font-semibold w-[90px] whitespace-nowrap text-center">Terlambat</TableHead>
                <TableHead className="font-semibold w-[100px] whitespace-nowrap text-center">Pulang Cepat</TableHead>
                <TableHead className="font-semibold w-[100px] whitespace-nowrap text-center">Status</TableHead>
                <TableHead className="font-semibold w-[120px] whitespace-nowrap text-center">Lokasi</TableHead>
                <TableHead className="font-semibold w-[200px] whitespace-nowrap">Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={13} className="text-center py-8 text-sm text-muted-foreground">Memuat...</TableCell></TableRow>
              ) : filteredRecords.length === 0 ? (
                <TableRow><TableCell colSpan={13} className="text-center py-8 text-sm text-muted-foreground">Tidak ada data untuk tanggal ini</TableCell></TableRow>
              ) : (
                filteredRecords.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/50 transition-colors h-11 group border-b text-sm">
                    <TableCell className={`sticky left-0 z-[20] bg-white text-center transition-all duration-75 w-[40px] max-w-[40px] min-w-[40px] group-hover:bg-[#f8fafc] py-1.5 text-slate-500`}>
                      {filteredRecords.indexOf(r) + 1}
                    </TableCell>
                    <TableCell
                      onClick={() => r.employees?.name && toggleExpand(`${r.id}-name`)}
                      className={`sticky left-[40px] z-[20] bg-white font-semibold transition-all duration-75 w-[180px] max-w-[180px] min-w-[180px] group-hover:bg-[#f8fafc] py-1.5 cursor-pointer text-slate-900
                        ${expandedCells[`${r.id}-name`] ? 'whitespace-normal break-words' : 'truncate'}
                        ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.25)]' : 'shadow-none'}`}
                    >
                      {r.employees?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-slate-900 py-1.5 text-left">{r.employees?.employee_id_number ?? "—"}</TableCell>
                    <TableCell 
                      onClick={() => r.employees?.units?.name && toggleExpand(`${r.id}-unit`)}
                      className={`text-slate-900 py-1.5 max-w-[130px] text-center cursor-pointer transition-all duration-200 ${expandedCells[`${r.id}-unit`] ? 'whitespace-normal break-words' : 'truncate'}`}
                    >
                      {r.employees?.units?.name ?? "—"}
                    </TableCell>
                    <TableCell 
                      onClick={() => r.employees?.position && toggleExpand(`${r.id}-position`)}
                      className={`text-slate-900 py-1.5 max-w-[130px] text-left cursor-pointer transition-all duration-200 ${expandedCells[`${r.id}-position`] ? 'whitespace-normal break-words' : 'truncate'}`}
                    >
                      {r.employees?.position ?? "—"}
                    </TableCell>
                    <TableCell className="text-slate-900 py-1.5 text-center">
                      {r.check_in ? format(new Date(r.check_in), "HH:mm") : "—"}
                    </TableCell>
                    <TableCell className="text-slate-900 py-1.5 text-center">
                      {r.check_out ? format(new Date(r.check_out), "HH:mm") : "—"}
                    </TableCell>
                    <TableCell className="text-slate-900 py-1.5 text-center">
                      {r.overtime_minutes ? `${r.overtime_minutes} menit` : "—"}
                    </TableCell>
                    <TableCell className="py-1.5 text-center">
                      {r.late_minutes ? <span className="text-slate-900">{r.late_minutes} menit</span> : "—"}
                    </TableCell>
                    <TableCell className="py-1.5 text-center">
                      {r.early_leave_minutes ? <span className="text-slate-900">{r.early_leave_minutes} menit</span> : "—"}
                    </TableCell>
                    <TableCell className="py-1.5 text-center">
                      {r.daily_status === 'Hadir' || r.daily_status === 'WFA' ? (
                        <span className="text-[11px] font-semibold text-[hsl(142,45%,25%)] bg-[hsl(142,45%,96%)] px-2 py-0.5 rounded border border-[hsl(142,45%,90%)] whitespace-nowrap">{r.daily_status}</span>
                      ) : r.daily_status === 'Mangkir' ? (
                        <span className="text-[11px] font-semibold text-[hsl(0,55%,35%)] bg-[hsl(0,55%,96%)] px-2 py-0.5 rounded border border-[hsl(0,55%,90%)] whitespace-nowrap">Mangkir</span>
                      ) : r.daily_status === 'Terlambat' ? (
                        <span className="text-[11px] font-semibold text-[hsl(38,55%,30%)] bg-[hsl(38,55%,94%)] px-2 py-0.5 rounded border border-[hsl(38,55%,88%)] whitespace-nowrap">Terlambat</span>
                      ) : (
                        <span className="text-[11px] font-semibold text-[hsl(232,59%,21%)] bg-[hsl(232,59%,96%)] px-2 py-0.5 rounded border border-[hsl(232,59%,90%)] whitespace-nowrap">{r.daily_status || 'Hadir'}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-900 py-1.5 text-center">
                      <div className="flex gap-2 justify-center">
                        {r.check_in_location && r.check_in_location !== "Location not available" ? (
                          <a href={`https://www.google.com/maps/search/?api=1&query=${r.check_in_location}`} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline transition-colors">Datang</a>
                        ) : null}
                        {r.check_out_location && r.check_out_location !== "Location not available" ? (
                          <a href={`https://www.google.com/maps/search/?api=1&query=${r.check_out_location}`} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline transition-colors">Pulang</a>
                        ) : null}
                        {!r.check_in_location && !r.check_out_location && <span className="text-slate-400">—</span>}
                      </div>
                    </TableCell>
                    <TableCell 
                      onClick={() => r.notes && toggleExpand(`${r.id}-notes`)}
                      className={`text-slate-500 py-1.5 max-w-[200px] cursor-pointer transition-all duration-200 ${expandedCells[`${r.id}-notes`] ? 'whitespace-normal break-words' : 'truncate'}`} 
                      title={r.notes || undefined}
                    >
                      {r.notes ?? "—"}
                    </TableCell>
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
