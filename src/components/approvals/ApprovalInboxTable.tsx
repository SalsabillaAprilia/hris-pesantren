import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { format } from "date-fns";

interface ApprovalInboxTableProps {
  approvals: any[];
  loading: boolean;
  isAdminOrHr: boolean;
  isUnitLeader: boolean;
  onApprove: (id: string, currentStatus: string) => void;
  onReject: (id: string) => void;
}

export function ApprovalInboxTable({ 
  approvals, loading, isAdminOrHr, isUnitLeader, onApprove, onReject 
}: ApprovalInboxTableProps) {
  
  const statusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
      pending: { variant: "secondary", label: "Pending" },
      approved_unit_leader: { variant: "default", label: "Disetujui Ketua Unit" },
      approved_hr: { variant: "default", label: "Disetujui HR" },
      rejected: { variant: "destructive", label: "Ditolak" },
    };
    const m = map[status] ?? { variant: "secondary" as const, label: status };
    return <Badge variant={m.variant}>{m.label}</Badge>;
  };

  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Karyawan</TableHead>
            <TableHead>Jenis</TableHead>
            <TableHead>Tanggal</TableHead>
            <TableHead>Alasan</TableHead>
            <TableHead>Status</TableHead>
            {(isAdminOrHr || isUnitLeader) && <TableHead>Aksi</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>
          ) : approvals.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Tidak ada antrean persetujuan</TableCell></TableRow>
          ) : (
            approvals.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.employees?.name ?? "—"}</TableCell>
                <TableCell>{a.type === "leave" ? "Cuti" : "Izin"}</TableCell>
                <TableCell>{format(new Date(a.start_date), "dd/MM/yy")} - {format(new Date(a.end_date), "dd/MM/yy")}</TableCell>
                <TableCell className="max-w-[200px] truncate" title={a.reason}>{a.reason}</TableCell>
                <TableCell>{statusBadge(a.status)}</TableCell>
                {(isAdminOrHr || isUnitLeader) && (
                  <TableCell>
                    {a.status !== "approved_hr" && a.status !== "rejected" && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => onApprove(a.id, a.status)}>
                          <Check className="h-4 w-4 text-primary" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => onReject(a.id)}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
