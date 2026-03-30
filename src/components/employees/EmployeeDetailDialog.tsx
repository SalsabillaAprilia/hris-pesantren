import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Employee } from "@/types/employee";
import { getStatusBadge, calculateMasaKerja } from "@/utils/employee-format";
import { Edit, Trash, User as UserIcon, Phone, Briefcase, FileDown } from "lucide-react";

interface EmployeeDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  isAdminOrHr: boolean;
  onEdit: (emp: Employee) => void;
  onDelete: (emp: Employee) => void;
}

export function EmployeeDetailDialog({
  open,
  onOpenChange,
  employee,
  isAdminOrHr,
  onEdit,
  onDelete
}: EmployeeDetailDialogProps) {
  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
        <DialogHeader className="p-8 border-b bg-primary/5">
          <div className="flex items-start justify-between">
            <div className="flex gap-4 items-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary border-2 border-primary/20">
                <UserIcon className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-2xl font-bold tracking-tight">{employee.name}</DialogTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-muted-foreground">{employee.employee_id_number || "Tanpa ID"}</span>
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30"></div>
                  {getStatusBadge(employee.status)}
                </div>
              </div>
            </div>
            {isAdminOrHr && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onEdit(employee)} className="gap-2">
                  <Edit className="h-4 w-4" /> Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => onDelete(employee)} className="gap-2">
                  <Trash className="h-4 w-4" /> Hapus
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-8">
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="personal" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Data Pribadi</TabsTrigger>
              <TabsTrigger value="contact" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Kontak & Alamat</TabsTrigger>
              <TabsTrigger value="employment" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Kepegawaian</TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                <DetailItem label="Nama Lengkap" value={employee.name} />
                <DetailItem label="ID Karyawan" value={employee.employee_id_number} />
                <DetailItem label="Tempat Lahir" value={employee.birth_place} />
                <DetailItem label="Tanggal Lahir" value={employee.birth_date ? new Date(employee.birth_date).toLocaleDateString("id-ID") : null} />
                <DetailItem label="Jenis Kelamin" value={employee.gender} />
                <DetailItem label="Agama" value={employee.religion} />
                <DetailItem label="Status Perkawinan" value={employee.marital_status} />
                <DetailItem label="Kewarganegaraan" value={employee.nationality} />
              </div>
            </TabsContent>

            <TabsContent value="contact" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                <DetailItem label="Email (Username)" value={employee.email} />
                <DetailItem label="Telepon" value={employee.phone} />
                <DetailItem label="Nomor WhatsApp" value={employee.whatsapp_number} isHighlight />
                <DetailItem label="Tipe Identitas" value={employee.identity_card_type} />
                <DetailItem label="Nomor Identitas" value={employee.identity_card_number} />
                <div className="md:col-span-2">
                  <DetailItem label="Alamat Sesuai KTP" value={employee.address} isFullWidth />
                </div>
                <div className="md:col-span-2">
                  <DetailItem label="Alamat Domisili" value={employee.address_domicile} isFullWidth />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="employment" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                <DetailItem label="Unit Kerja" value={employee.units?.name} isHighlight />
                <DetailItem label="Jabatan" value={employee.position} />
                <DetailItem label="Tanggal Bergabung" value={employee.join_date ? new Date(employee.join_date).toLocaleDateString("id-ID") : null} />
                <DetailItem label="Masa Kerja" value={calculateMasaKerja(employee.join_date)} />
                <DetailItem label="Status Karyawan" value={employee.status === "active" ? "Aktif" : (employee.status === "inactive" ? "Nonaktif" : "Cuti")} />
                <DetailItem label="Akhir Kontrak / Kerja" value={employee.contract_end_date ? new Date(employee.contract_end_date).toLocaleDateString("id-ID") : null} />
                <DetailItem label="Jenjang Pendidikan" value={employee.education_level} />
                <DetailItem label="Institusi" value={employee.education_institution} />
                <div className="md:col-span-2">
                   <DetailItem label="Program Studi" value={employee.education_major} isFullWidth />
                </div>
                {employee.attachment_url && (
                   <div className="md:col-span-2 pt-4">
                     <Button variant="outline" className="gap-2" asChild>
                       <a href={employee.attachment_url} target="_blank" rel="noreferrer">
                         <FileDown className="h-4 w-4" /> Lihat Dokumen Lampiran
                       </a>
                     </Button>
                   </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailItem({ label, value, isHighlight = false, isFullWidth = false }: { 
  label: string; 
  value: string | null | undefined; 
  isHighlight?: boolean;
  isFullWidth?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${isFullWidth ? "w-full" : ""}`}>
      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">{label}</span>
      <p className={`text-base font-medium ${isHighlight ? "text-primary" : "text-slate-900"}`}>
        {value || "—"}
      </p>
    </div>
  );
}
