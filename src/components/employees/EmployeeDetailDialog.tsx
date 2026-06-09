import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Employee } from "@/types/employee";
import { getStatusBadge, calculateMasaKerja } from "@/utils/employee-format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Edit, Trash, User as UserIcon, Phone, Briefcase, FileDown } from "lucide-react";
import { useTerminology } from "@/hooks/useTerminology";
import { DetailHeader, DetailSection, DetailItem } from "@/components/ui/detail-layout";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface EmployeeDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  isAdminOrHr: boolean;
  isSuperAdmin?: boolean;
  onEdit?: (emp: Employee) => void;
  onDelete?: (emp: Employee) => void;
}

export function EmployeeDetailDialog({
  open,
  onOpenChange,
  employee,
  isAdminOrHr,
  isSuperAdmin = false,
  onEdit,
  onDelete
}: EmployeeDetailDialogProps) {
  const { term, kepalaTerm } = useTerminology();
  const [showImage, setShowImage] = useState(false);

  if (!employee) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
        <DetailHeader
          title={employee.name}
          subtitle={employee.employee_id_number || "Tanpa ID"}
          badge={getStatusBadge(employee.status)}
          avatarUrl={employee.avatar_url}
          fallbackInitials={employee.name.charAt(0)}
          onAvatarClick={() => employee.avatar_url && setShowImage(true)}
          actions={
            isAdminOrHr && (onEdit || onDelete) && (
              <>
                {onEdit && (
                  <Button variant="outline" size="sm" onClick={() => onEdit(employee)} className="gap-1.5 font-semibold text-slate-700 hover:text-primary">
                    <Edit className="h-3.5 w-3.5 text-slate-400" /> Edit Data
                  </Button>
                )}
                {onDelete && (
                  <Button variant="outline" size="sm" onClick={() => onDelete(employee)} className="gap-1.5 font-semibold bg-red-50 border-red-100 text-red-600 hover:bg-red-100 hover:text-red-700 hover:border-red-200 shadow-none">
                    <Trash className="h-3.5 w-3.5" /> Hapus
                  </Button>
                )}
              </>
            )
          }
        />

        <div className="flex-1 overflow-y-auto p-8">
          <div className="space-y-10">
            {/* Seksi Data Pribadi */}
            <DetailSection icon={UserIcon} title="Data Pribadi">
              <DetailItem label="Nama Lengkap" value={employee.name} />
              <DetailItem label="ID Karyawan" value={employee.employee_id_number} />
              <DetailItem label="Tempat Lahir" value={employee.birth_place} />
              <DetailItem label="Tanggal Lahir" value={employee.birth_date ? format(new Date(employee.birth_date), "dd MMMM yyyy", { locale: id }) : null} />
              <DetailItem label="Jenis Kelamin" value={employee.gender} />
              <DetailItem label="Agama" value={employee.religion} />
              <DetailItem label="Status Perkawinan" value={employee.marital_status} />
              <DetailItem label="Kewarganegaraan" value={employee.nationality} />
            </DetailSection>

            {/* Seksi Kontak */}
            <DetailSection icon={Phone} title="Informasi Kontak">
              <DetailItem label="Email" value={employee.email} />
              <DetailItem label="Nomor WhatsApp" value={employee.whatsapp_number} isHighlight />
              <DetailItem label="Kartu Identitas" value={employee.identity_card_type} />
              <DetailItem label="ID Kartu Identitas" value={employee.identity_card_number} />
              <DetailItem label="Alamat Kartu Identitas" value={employee.address} className="md:col-span-2" />
              <DetailItem label="Alamat Domisili" value={employee.address_domicile} className="md:col-span-2" />
            </DetailSection>

            {/* Seksi Kepegawaian */}
            <DetailSection icon={Briefcase} title="Kepegawaian & Pendidikan">
              <DetailItem label={`${term}`} value={employee.units?.name} isHighlight />
              <DetailItem label="Jabatan" value={employee.positions?.name} />
              <DetailItem label="Jadwal Kerja" value={employee.shifts ? `${employee.shifts.name} (${employee.shifts.start_time?.slice(0,5)} - ${employee.shifts.end_time?.slice(0,5)})` : "—"} />
              <DetailItem label="Status Karyawan" value={employee.status === "active" ? "Aktif" : (employee.status === "inactive" ? "Nonaktif" : "Cuti")} />
              <DetailItem label="Tanggal Bergabung" value={employee.join_date ? format(new Date(employee.join_date), "dd MMMM yyyy", { locale: id }) : null} />
              <DetailItem label="Masa Kerja" value={calculateMasaKerja(employee.join_date)} />
              <DetailItem label="Akhir Kontrak" value={employee.contract_end_date ? format(new Date(employee.contract_end_date), "dd MMMM yyyy", { locale: id }) : null} />
              <DetailItem label="Jenjang Pendidikan" value={employee.education_level} />
              <DetailItem label="Lembaga Pendidikan" value={employee.education_institution} />
              <DetailItem label="Program Studi" value={employee.education_major} />
                {isSuperAdmin && (
                  <DetailItem label="Role Sistem" value={
                    employee.role === 'super_admin' ? 'Super Admin' :
                    employee.role === 'hr' ? 'HRD' :
                    employee.role === 'unit_leader' ? kepalaTerm :
                    employee.role === 'employee' ? 'Karyawan' :
                    employee.role ? employee.role.replace('_', ' ') : "—"
                  } />
                )}
                {employee.attachment_url && (
                   <div className="md:col-span-2 pt-4">
                     <Button variant="outline" className="gap-2" asChild>
                       <a href={employee.attachment_url} target="_blank" rel="noreferrer">
                         <FileDown className="h-4 w-4" /> Lihat Dokumen Lampiran
                       </a>
                     </Button>
                   </div>
                )}
            </DetailSection>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={showImage} onOpenChange={setShowImage}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-transparent border-none shadow-none flex justify-center items-center [&>button]:bg-black/50 [&>button]:text-white [&>button]:hover:bg-black/80 [&>button]:rounded-full [&>button]:p-2 [&>button]:right-4 [&>button]:top-4 [&>button]:opacity-100 [&>button]:ring-0 [&_svg]:h-6 [&_svg]:w-6">
        {employee.avatar_url && (
          <img 
            src={employee.avatar_url} 
            alt={`Foto Profil ${employee.name}`} 
            className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl ring-4 ring-white/20" 
          />
        )}
      </DialogContent>
    </Dialog>
  </>
  );
}

