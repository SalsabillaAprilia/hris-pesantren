import { useState, useRef, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Employee } from "@/types/employee";
import { getStatusBadge, calculateMasaKerja } from "@/utils/employee-format";
import { useTerminology } from "@/hooks/useTerminology";
import { format } from "date-fns";

interface EmployeeTableProps {
  employees: Employee[];
  activeTab: string;
  onViewDetail: (emp: Employee) => void;
  loading: boolean;
  isSuperAdmin?: boolean;
}

export function EmployeeTable({ employees, activeTab, onViewDetail, loading, isSuperAdmin }: EmployeeTableProps) {
  const { term, kepalaTerm } = useTerminology();
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLTableSectionElement>(null);

  // We extract the calculation logic so we can call it manually WITHOUT Triggering React Renders!
  const recalculateSticky = () => {
    const mainEl = document.querySelector('main');
    if (!mainEl || !scrollContainerRef.current || !headerRef.current) return;

    const rect = scrollContainerRef.current.getBoundingClientRect();
    const stickThreshold = Math.max(0, mainEl.getBoundingClientRect().top);
    
    let finalOffset = 0;
    if (rect.top < stickThreshold) {
      const maxOffset = rect.height - 44; // approx header height + some padding
      const offset = Math.min(stickThreshold - rect.top, maxOffset);
      finalOffset = Math.max(0, offset);
    }
    
    // Direct DOM manipulation completely skips React re-render, eliminating scroll jitter!
    headerRef.current.style.setProperty('--sticky-offset', `${finalOffset}px`);
    if (finalOffset > 0) {
      headerRef.current.classList.add('[&_th]:shadow-sm');
    } else {
      headerRef.current.classList.remove('[&_th]:shadow-sm');
    }
  };

  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (!mainEl) return;

    let ticking = false;

    // Use fast native RAF scroll listener to update offset without React states
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          recalculateSticky();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('resize', handleScroll);
    
    // Initial check
    handleScroll();
    
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  // Force recalculation when data changes because UI modals (like add/edit employee)
  // temporarily block scrolling and might leave stale bounding rects
  useEffect(() => {
    // Add small delay to let DOM settle after render
    const timer = setTimeout(recalculateSticky, 50);
    return () => clearTimeout(timer);
  }, [employees, activeTab]);

  const handleHorizontalScroll = () => {
    if (scrollContainerRef.current) {
      const scrolled = scrollContainerRef.current.scrollLeft > 2;
      if (scrolled !== isScrolled) {
        setIsScrolled(scrolled);
      }
    }
  };


  return (
    <div className="relative border rounded-md bg-white flex flex-col">
      {/* Container with horizontal scroll. Vertical scroll is handled by the main page. */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleHorizontalScroll}
        className="overflow-x-auto overflow-y-visible flex-1 h-auto relative"
      >
        <table className="w-full caption-bottom text-sm relative border-separate border-spacing-0 min-w-[1200px]">
          <TableHeader 
            ref={headerRef}
            className="z-20 transition-none [&_th]:sticky [&_th]:top-[var(--sticky-offset)] [&_th:not(.sticky)]:z-30 [&_th:not(.sticky)]:bg-muted"
            style={{ 
              "--sticky-offset": "0px",
            } as React.CSSProperties}
          >
            <TableRow className="border-none hover:bg-transparent">
              <TableHead 
                className={`sticky left-0 z-[40] bg-muted transition-none w-[40px] min-w-[40px] font-semibold text-center
                  ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.3)]' : 'shadow-none'}`}
              >
                No.
              </TableHead>
              {/* STICKY COLUMN HEADER: NAMA */}
              <TableHead 
                className={`sticky left-[41px] z-[40] bg-muted transition-none w-[180px] min-w-[180px] font-semibold 
                  ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.3)]' : 'shadow-none'}`}
              >
                Nama
              </TableHead>

              {activeTab === "personal" && (
                <>
                  <TableHead className="font-semibold text-left whitespace-nowrap">ID Karyawan</TableHead>
                  <TableHead className="font-semibold text-left whitespace-nowrap">Jenis Kelamin</TableHead>
                  <TableHead className="font-semibold text-center whitespace-nowrap">Kewarganegaraan</TableHead>
                  <TableHead className="font-semibold text-center whitespace-nowrap">Data Identitas</TableHead>
                  <TableHead className="font-semibold text-center whitespace-nowrap">Tanggal Lahir</TableHead>
                  <TableHead className="font-semibold text-center whitespace-nowrap">Agama</TableHead>
                  <TableHead className="font-semibold text-center whitespace-nowrap">Pendidikan</TableHead>
                </>
              )}

              {activeTab === "contact" && (
                <>
                  <TableHead className="font-semibold text-center whitespace-nowrap">WhatsApp</TableHead>
                  <TableHead className="font-semibold text-left whitespace-nowrap">Email</TableHead>
                  <TableHead className="font-semibold text-left whitespace-nowrap">Alamat</TableHead>
                  <TableHead className="font-semibold text-left whitespace-nowrap">Domisili</TableHead>
                </>
              )}

              {activeTab === "employment" && (
                <>
                  <TableHead className="font-semibold text-left whitespace-nowrap">ID Karyawan</TableHead>
                  <TableHead className="font-semibold text-center whitespace-nowrap">Status</TableHead>
                  <TableHead className="font-semibold text-center whitespace-nowrap">{term}</TableHead>
                  <TableHead className="font-semibold text-left whitespace-nowrap">Jabatan</TableHead>
                  <TableHead className="font-semibold text-center whitespace-nowrap">Jadwal Kerja</TableHead>
                  <TableHead className="font-semibold text-center whitespace-nowrap">Bergabung</TableHead>
                  <TableHead className="font-semibold text-center whitespace-nowrap">Masa Kerja</TableHead>
                  <TableHead className="font-semibold text-center whitespace-nowrap">Akhir Kontrak</TableHead>
                  {isSuperAdmin && (
                    <TableHead className="font-semibold text-center whitespace-nowrap">Role Sistem</TableHead>
                  )}
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={12} className="h-32 text-center text-muted-foreground animate-pulse">
                  Memuat data karyawan...
                </TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="h-32 text-center text-muted-foreground">
                  Tidak ada data karyawan ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              employees.map((emp) => (
              <TableRow 
                key={emp.id} 
                className="cursor-pointer hover:bg-muted/50 transition-colors h-11 group border-b border-gray-200 text-sm"
                onClick={() => onViewDetail(emp)}
              >
                <TableCell className={`sticky left-0 z-[20] bg-white text-center transition-all duration-75 w-[40px] max-w-[40px] min-w-[40px] group-hover:bg-[#f8fafc] py-1.5 text-slate-500 ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.25)]' : 'shadow-none'}`}>
                  {employees.indexOf(emp) + 1}
                </TableCell>
                {/* STICKY COLUMN CELL: NAMA */}
                <TableCell className={`sticky left-[41px] z-[20] bg-white font-semibold transition-all duration-75 w-[180px] max-w-[180px] min-w-[180px] group-hover:bg-[#f8fafc] py-1.5 truncate text-slate-900 ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.25)]' : 'shadow-none'}`}>
                  {emp.name}
                </TableCell>

                {activeTab === "personal" && (
                  <>
                    <TableCell className="text-slate-900 py-1.5 text-left">{emp.employee_id_number || "—"}</TableCell>
                    <TableCell className="py-1.5 text-slate-900 text-left">{emp.gender || "—"}</TableCell>
                    <TableCell className="py-1.5 text-slate-900 text-center">{emp.nationality || "—"}</TableCell>
                    <TableCell className="py-1.5 truncate max-w-[150px] text-slate-900 text-center">
                      {emp.identity_card_type && `${emp.identity_card_type}: `}{emp.identity_card_number || "—"}
                    </TableCell>
                    <TableCell className="py-1.5 whitespace-nowrap text-slate-900 text-center">
                      {emp.birth_date ? format(new Date(emp.birth_date), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="py-1.5 text-slate-900 text-center">{emp.religion || "—"}</TableCell>
                    <TableCell className="py-1.5 text-slate-900 text-center">{emp.education_level || "—"}</TableCell>
                  </>
                )}

                {activeTab === "contact" && (
                  <>
                    <TableCell className="text-slate-900 py-1.5 text-center">{emp.whatsapp_number || "—"}</TableCell>
                    <TableCell className="py-1.5 truncate max-w-[180px] text-slate-900 text-left">{emp.email || "—"}</TableCell>
                    <TableCell className="py-1.5 text-slate-900 truncate max-w-[200px] text-left">{emp.address || "—"}</TableCell>
                    <TableCell className="py-1.5 text-slate-900 truncate max-w-[200px] text-left">{emp.address_domicile || "—"}</TableCell>
                  </>
                )}

                {activeTab === "employment" && (
                  <>
                    <TableCell className="text-slate-900 py-1.5 whitespace-nowrap text-left">{emp.employee_id_number || "—"}</TableCell>
                    <TableCell className="py-1.5 origin-center whitespace-nowrap text-center">{getStatusBadge(emp.status)}</TableCell>
                    <TableCell className="py-1.5 truncate max-w-[150px] text-slate-900 text-center">{emp.units?.name || "—"}</TableCell>
                    <TableCell className="py-1.5 truncate max-w-[150px] text-slate-900 text-left">{emp.positions?.name || "—"}</TableCell>
                    <TableCell className="py-1.5 truncate max-w-[150px] text-slate-900 text-center text-[13px]">{emp.shifts ? `${emp.shifts.name}` : "—"}</TableCell>
                    <TableCell className="py-1.5 whitespace-nowrap text-slate-900 text-center">
                      {emp.join_date ? format(new Date(emp.join_date), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="font-normal py-1.5 whitespace-nowrap text-slate-900 text-center">
                      {calculateMasaKerja(emp.join_date)}
                    </TableCell>
                    <TableCell className="py-1.5 whitespace-nowrap text-slate-900 text-center">
                      {emp.contract_end_date ? format(new Date(emp.contract_end_date), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell className="py-1.5 text-slate-900 whitespace-nowrap text-center">
                        <span className="text-[11px] font-semibold text-[hsl(232,59%,21%)] bg-[hsl(232,59%,96%)] px-2 py-0.5 rounded border border-[hsl(232,59%,90%)] whitespace-nowrap">
                          {emp.role === 'super_admin' ? 'Super Admin' :
                           emp.role === 'hr' ? 'HRD' :
                           emp.role === 'unit_leader' ? kepalaTerm :
                           emp.role === 'employee' ? 'Karyawan' :
                           emp.role ? emp.role.replace('_', ' ') : "—"}
                        </span>
                      </TableCell>
                    )}
                  </>
                )}
              </TableRow>
            )))}
          </TableBody>
        </table>
      </div>
    </div>
  );
}
