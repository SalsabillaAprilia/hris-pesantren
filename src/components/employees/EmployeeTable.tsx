import { useState, useRef, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Employee } from "@/types/employee";
import { getStatusBadge, calculateMasaKerja } from "@/utils/employee-format";

interface EmployeeTableProps {
  employees: Employee[];
  activeTab: string;
  onViewDetail: (emp: Employee) => void;
  loading: boolean;
}

export function EmployeeTable({ employees, activeTab, onViewDetail, loading }: EmployeeTableProps) {
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

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Memuat data karyawan...</div>;
  }

  if (employees.length === 0) {
    return <div className="p-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">Tidak ada data karyawan ditemukan.</div>;
  }

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
              {/* STICKY COLUMN HEADER: NAMA */}
              <TableHead 
                className={`sticky left-0 z-[40] bg-muted transition-none w-[180px] min-w-[180px] font-semibold 
                  ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.3)]' : 'shadow-none'}`}
              >
                Nama
              </TableHead>

              {activeTab === "personal" && (
                <>
                  <TableHead className="w-[120px] font-semibold">ID Karyawan</TableHead>
                  <TableHead className="w-[100px] font-semibold">Jenis Kelamin</TableHead>
                  <TableHead className="w-[100px] font-semibold">Kewarganegaraan</TableHead>
                  <TableHead className="w-[150px] font-semibold">Data Identitas</TableHead>
                  <TableHead className="w-[120px] font-semibold">Tanggal Lahir</TableHead>
                  <TableHead className="w-[100px] font-semibold">Agama</TableHead>
                  <TableHead className="w-[100px] font-semibold">Pendidikan</TableHead>
                </>
              )}

              {activeTab === "contact" && (
                <>
                  <TableHead className="w-[150px] font-semibold">WhatsApp</TableHead>
                  <TableHead className="w-[180px] font-semibold">Email</TableHead>
                  <TableHead className="w-[250px] font-semibold">Alamat</TableHead>
                  <TableHead className="w-[250px] font-semibold">Domisili</TableHead>
                </>
              )}

              {activeTab === "employment" && (
                <>
                  <TableHead className="w-[120px] font-semibold">ID Karyawan</TableHead>
                  <TableHead className="w-[100px] font-semibold">Status</TableHead>
                  <TableHead className="w-[150px] font-semibold">Unit Kerja</TableHead>
                  <TableHead className="w-[150px] font-semibold">Jabatan</TableHead>
                  <TableHead className="w-[120px] font-semibold">Bergabung</TableHead>
                  <TableHead className="w-[120px] font-semibold">Masa Kerja</TableHead>
                  <TableHead className="w-[120px] font-semibold">Akhir Kontrak</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((emp) => (
              <TableRow 
                key={emp.id} 
                className="cursor-pointer hover:bg-muted/50 transition-colors h-11 group border-b text-xs"
                onClick={() => onViewDetail(emp)}
              >
                {/* STICKY COLUMN CELL: NAMA */}
                <TableCell className={`sticky left-0 z-[20] bg-white font-semibold transition-all duration-75 w-[180px] max-w-[180px] min-w-[180px] group-hover:bg-[#f8fafc] py-1.5 text-xs truncate text-slate-900 ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.25)]' : 'shadow-none'}`}>
                  {emp.name}
                </TableCell>

                {activeTab === "personal" && (
                  <>
                    <TableCell className="text-[10px] text-slate-900 py-1.5">{emp.employee_id_number || "—"}</TableCell>
                    <TableCell className="py-1.5 text-xs text-slate-900">{emp.gender || "—"}</TableCell>
                    <TableCell className="py-1.5 text-xs text-slate-900">{emp.nationality || "—"}</TableCell>
                    <TableCell className="py-1.5 text-[10px] truncate max-w-[150px] text-slate-900">
                      {emp.identity_card_type && `${emp.identity_card_type}: `}{emp.identity_card_number || "—"}
                    </TableCell>
                    <TableCell className="text-xs py-1.5 whitespace-nowrap text-slate-900">
                      {emp.birth_date ? new Date(emp.birth_date).toLocaleDateString("id-ID") : "—"}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs text-slate-900">{emp.religion || "—"}</TableCell>
                    <TableCell className="py-1.5 text-xs text-slate-900">{emp.education_level || "—"}</TableCell>
                  </>
                )}

                {activeTab === "contact" && (
                  <>
                    <TableCell className="text-xs text-slate-900 py-1.5">{emp.whatsapp_number || "—"}</TableCell>
                    <TableCell className="text-xs py-1.5 truncate max-w-[180px] text-slate-900">{emp.email || "—"}</TableCell>
                    <TableCell className="text-xs py-1.5 text-slate-900 truncate max-w-[200px]">{emp.address || "—"}</TableCell>
                    <TableCell className="text-xs py-1.5 text-slate-900 truncate max-w-[200px]">{emp.address_domicile || "—"}</TableCell>
                  </>
                )}

                {activeTab === "employment" && (
                  <>
                    <TableCell className="text-[10px] text-slate-900 py-1.5">{emp.employee_id_number || "—"}</TableCell>
                    <TableCell className="py-1.5 scale-90 origin-left">{getStatusBadge(emp.status)}</TableCell>
                    <TableCell className="text-xs py-1.5 truncate max-w-[150px] text-slate-900">{emp.units?.name || "—"}</TableCell>
                    <TableCell className="text-xs py-1.5 truncate max-w-[150px] text-slate-900">{emp.position || "—"}</TableCell>
                    <TableCell className="text-xs py-1.5 whitespace-nowrap text-slate-900">
                      {emp.join_date ? new Date(emp.join_date).toLocaleDateString("id-ID") : "—"}
                    </TableCell>
                    <TableCell className="text-[10px] font-normal py-1.5 whitespace-nowrap text-slate-900">
                      {calculateMasaKerja(emp.join_date)}
                    </TableCell>
                    <TableCell className="text-xs py-1.5 whitespace-nowrap text-slate-900">
                      {emp.contract_end_date ? new Date(emp.contract_end_date).toLocaleDateString("id-ID") : "—"}
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </table>
      </div>
    </div>
  );
}
