import { useState, useRef } from "react";
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

  const handleScroll = () => {
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
    <div className="relative border rounded-md bg-white">
      {/* Container with horizontal scroll and fixed height for vertical scroll */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="overflow-auto max-h-[calc(100vh-320px)]"
      >
        <table className="w-full caption-bottom text-sm relative border-separate border-spacing-0 min-w-[1200px]">
          <TableHeader className="sticky top-0 z-20 bg-muted hover:bg-muted shadow-sm">
            <TableRow>
              {/* STICKY COLUMN HEADER: NAMA */}
              <TableHead className={`sticky left-0 z-[40] bg-muted transition-all duration-75 w-[180px] min-w-[180px] font-semibold ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.3)]' : 'shadow-none'}`}>
                Nama Lengkap
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
