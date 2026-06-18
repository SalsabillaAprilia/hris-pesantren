import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DetailHeader, DetailSection, DetailItem } from "@/components/ui/detail-layout";
import { Label } from "@/components/ui/label";
import { Check, X, ClipboardCheck, MessageSquare, User, FileText } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface ApprovalDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  approval: any;
  onStatusChange: (id: string, status: "approved" | "rejected") => void;
  loading: boolean;
  readOnly?: boolean;
}

export function ApprovalDetailModal({
  open,
  onOpenChange,
  approval,
  onStatusChange,
  loading,
  readOnly = false
}: ApprovalDetailModalProps) {
  if (!approval) return null;

  const mapTypeLabel = (dbType: string) => {
    const map: Record<string, string> = { leave: "Cuti", permission: "Izin", overtime: "Lembur", sick: "Sakit", wfa: "WFA / WFH" };
    return map[dbType] ?? dbType;
  };

  const statusBadge = (status: string) => {
    switch(status) {
      case "approved_hr":
      case "approved_unit_leader":
        return <span className="text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap text-[hsl(142,45%,25%)] bg-[hsl(142,45%,96%)] border-[hsl(142,45%,90%)]">Disetujui</span>;
      case "pending":
        return <span className="text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap text-[hsl(38,55%,30%)] bg-[hsl(38,55%,94%)] border-[hsl(38,55%,88%)]">Menunggu</span>;
      case "rejected":
        return <span className="text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap text-[hsl(0,55%,35%)] bg-[hsl(0,55%,96%)] border-[hsl(0,55%,90%)]">Ditolak</span>;
      default:
        return <span className="text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap text-[hsl(232,59%,21%)] bg-[hsl(232,59%,96%)] border-[hsl(232,59%,90%)]">{status}</span>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none bg-slate-50">
        <DetailHeader 
          title="Detail Pengajuan"
          badge={statusBadge(approval.status)}
          actions={
            !readOnly && approval.status === "pending" ? (
              <>
                <Button variant="outline" size="sm" onClick={() => onStatusChange(approval.id, "rejected")} disabled={loading} className="h-8 gap-1.5 font-semibold bg-red-50 border-red-100 text-red-600 hover:bg-red-100 hover:text-red-700 hover:border-red-200 shadow-none transition-all">
                  <X className="h-3.5 w-3.5" /> Tolak
                </Button>
                <Button variant="outline" size="sm" onClick={() => onStatusChange(approval.id, "approved")} disabled={loading} className="h-8 gap-1.5 font-semibold bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 hover:border-emerald-200 shadow-none transition-all">
                  <Check className="h-3.5 w-3.5" /> Setujui
                </Button>
              </>
            ) : undefined
          }
        />
        
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <DetailSection icon={User} title="Informasi Pengaju">
            <DetailItem label="Nama Karyawan" value={approval.employees?.name ?? "—"} />
            <DetailItem label="Unit" value={approval.employees?.units?.name ?? "—"} />
          </DetailSection>

          <DetailSection icon={ClipboardCheck} title="Informasi Pengajuan">
            <DetailItem label="Jenis Pengajuan" value={mapTypeLabel(approval.type)} />
            <DetailItem 
              label="Tanggal Kegiatan" 
              value={
                approval.type === "overtime" || (approval.start_date === approval.end_date) 
                  ? format(new Date(approval.start_date), "dd MMMM yyyy", { locale: id })
                  : `${format(new Date(approval.start_date), "dd MMMM yyyy", { locale: id })} - ${format(new Date(approval.end_date), "dd MMMM yyyy", { locale: id })}`
              } 
            />
            {approval.type === "overtime" && approval.start_time && (
              <DetailItem label="Jam Lembur" value={`${approval.start_time.slice(0,5)} - ${approval.end_time?.slice(0,5)}`} />
            )}
          </DetailSection>

          <DetailSection icon={MessageSquare} title="Keterangan Tambahan">
            <div className="col-span-1 md:col-span-2">
              <DetailItem label="Alasan Pengajuan" value={approval.reason} />
            </div>
            
            {approval.attachment_url && (
              <div className="col-span-1 md:col-span-2">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-muted-foreground">Lampiran Dokumen</Label>
                  <div className="pt-1">
                    <a href={approval.attachment_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md text-xs font-semibold border border-blue-200 transition-colors">
                      <FileText className="h-3.5 w-3.5" /> Buka Dokumen Pendukung
                    </a>
                  </div>
                </div>
              </div>
            )}

            {approval.status === "rejected" && approval.reject_reason && (
              <div className="col-span-1 md:col-span-2 mt-2">
                <DetailItem 
                  label="Catatan Penolakan" 
                  value={<span className="text-red-600 font-medium">{approval.reject_reason}</span>} 
                />
              </div>
            )}
          </DetailSection>
        </div>
      </DialogContent>
    </Dialog>
  );
}
