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
  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Memuat data karyawan...</div>;
  }

  if (employees.length === 0) {
    return <div className="p-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">Tidak ada data karyawan ditemukan.</div>;
  }

  return (
    <div className="relative border rounded-md bg-white">
      {/* Container with horizontal scroll and fixed height for vertical scroll */}
      <div className="overflow-auto max-h-[calc(100vh-320px)]">
        <Table className="relative border-collapse min-w-[1200px]">
          <TableHeader className="sticky top-0 z-20 bg-muted hover:bg-muted shadow-sm">
            <TableRow>
              {/* STICKY COLUMN HEADER: NAMA */}
              <TableHead className="sticky left-0 z-30 bg-muted text-foreground font-bold border-r w-[250px] min-w-[250px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                Nama Lengkap
              </TableHead>

              {activeTab === "personal" && (
                <>
                  <TableHead className="w-[120px]">ID Karyawan</TableHead>
                  <TableHead className="w-[100px]">Gender</TableHead>
                  <TableHead className="w-[100px]">Warga</TableHead>
                  <TableHead className="w-[150px]">Data Identitas</TableHead>
                  <TableHead className="w-[120px]">Tgl Lahir</TableHead>
                  <TableHead className="w-[100px]">Agama</TableHead>
                  <TableHead className="w-[100px]">Pendidikan</TableHead>
                </>
              )}

              {activeTab === "contact" && (
                <>
                  <TableHead className="w-[150px]">WhatsApp</TableHead>
                  <TableHead className="w-[180px]">Email</TableHead>
                  <TableHead className="w-[250px]">Alamat (KTP)</TableHead>
                  <TableHead className="w-[250px]">Domisili</TableHead>
                </>
              )}

              {activeTab === "employment" && (
                <>
                  <TableHead className="w-[120px]">ID Karyawan</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[150px]">Unit Kerja</TableHead>
                  <TableHead className="w-[150px]">Jabatan</TableHead>
                  <TableHead className="w-[120px]">Tgl Gabung</TableHead>
                  <TableHead className="w-[120px]">Masa Kerja</TableHead>
                  <TableHead className="w-[120px]">Akhir Kontrak</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((emp) => (
              <TableRow 
                key={emp.id} 
                className="cursor-pointer hover:bg-muted/50 transition-colors h-14 group"
                onClick={() => onViewDetail(emp)}
              >
                {/* STICKY COLUMN CELL: NAMA */}
                <TableCell className="sticky left-0 z-10 bg-white font-semibold border-r w-[250px] min-w-[250px] group-hover:bg-muted/50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  {emp.name}
                </TableCell>

                {activeTab === "personal" && (
                  <>
                    <TableCell className="font-mono text-xs">{emp.employee_id_number || "—"}</TableCell>
                    <TableCell>{emp.gender || "—"}</TableCell>
                    <TableCell>{emp.nationality || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase">{emp.identity_card_type || "No ID"}</span>
                        <span className="text-xs">{emp.identity_card_number || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {emp.birth_date ? new Date(emp.birth_date).toLocaleDateString("id-ID") : "—"}
                    </TableCell>
                    <TableCell>{emp.religion || "—"}</TableCell>
                    <TableCell>{emp.education_level || "—"}</TableCell>
                  </>
                )}

                {activeTab === "contact" && (
                  <>
                    <TableCell className="text-xs">{emp.whatsapp_number || emp.phone || "—"}</TableCell>
                    <TableCell className="text-xs truncate max-w-[180px]">{emp.email || "—"}</TableCell>
                    <TableCell className="text-xs line-clamp-1 py-4">{emp.address || "—"}</TableCell>
                    <TableCell className="text-xs line-clamp-1 py-4">{emp.address_domicile || "—"}</TableCell>
                  </>
                )}

                {activeTab === "employment" && (
                  <>
                    <TableCell className="font-mono text-xs">{emp.employee_id_number || "—"}</TableCell>
                    <TableCell>{getStatusBadge(emp.status)}</TableCell>
                    <TableCell className="text-xs font-medium">{emp.units?.name || "—"}</TableCell>
                    <TableCell className="text-xs">{emp.position || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {emp.join_date ? new Date(emp.join_date).toLocaleDateString("id-ID") : "—"}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {calculateMasaKerja(emp.join_date)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {emp.contract_end_date ? new Date(emp.contract_end_date).toLocaleDateString("id-ID") : "—"}
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
