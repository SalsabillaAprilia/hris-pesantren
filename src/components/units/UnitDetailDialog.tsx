import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Employee } from "@/types/employee";
import { Building2, User, Users, ArrowRight, Edit, Trash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UnitDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: any;
  members: Employee[];
  leader: Employee | null;
  onViewEmployee: (emp: Employee) => void;
  isAdminOrHr: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function UnitDetailDialog({
  open,
  onOpenChange,
  unit,
  members,
  leader,
  onViewEmployee,
  isAdminOrHr,
  onEdit,
  onDelete
}: UnitDetailDialogProps) {
  if (!unit) return null;

  const maleCount = members.filter(m => m.gender === "Laki-laki").length;
  const femaleCount = members.filter(m => m.gender === "Perempuan").length;
  const displayMembers = members.filter(m => m.id !== leader?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
        <DialogHeader className="p-6 border-b bg-primary/5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="h-16 w-16 rounded-2xl bg-white border-2 border-white shadow-md flex items-center justify-center shrink-0">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-1 py-1 min-w-0">
                <DialogTitle className="text-2xl font-bold tracking-tight truncate">{unit.name}</DialogTitle>
              </div>
            </div>
            {isAdminOrHr && (
              <div className="flex items-center gap-2 pr-6 shrink-0">
                <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5 font-semibold text-slate-700 hover:text-primary">
                  <Edit className="h-3.5 w-3.5 text-slate-400" /> Edit Data
                </Button>
                <Button variant="outline" size="sm" onClick={onDelete} className="gap-1.5 font-semibold bg-red-50 border-red-100 text-red-600 hover:bg-red-100 hover:text-red-700 hover:border-red-200 shadow-none">
                  <Trash className="h-3.5 w-3.5" /> Hapus
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Deskripsi */}
          {unit.description ? (
            <div className="text-sm text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 break-words">
              {unit.description}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl px-4 py-3">
              Tidak ada deskripsi untuk unit ini.
            </p>
          )}

          {/* Stats Section */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-xs text-muted-foreground font-medium mb-1">Total Anggota</p>
              <p className="text-2xl font-bold text-slate-900">{members.length}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-xs text-muted-foreground font-medium mb-1">Laki-laki</p>
              <p className="text-2xl font-bold text-blue-600">{maleCount}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-xs text-muted-foreground font-medium mb-1">Perempuan</p>
              <p className="text-2xl font-bold text-pink-600">{femaleCount}</p>
            </div>
          </div>

          {/* Leaders Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Kepala Unit
            </h3>
            {leader ? (
              <div 
                className="flex items-center justify-between p-3 rounded-xl border border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-all group"
                onClick={() => onViewEmployee(leader)}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                    <AvatarImage src={leader.avatar_url || ""} className="object-cover" />
                    <AvatarFallback className="bg-primary/20 text-primary font-bold">
                      {leader.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{leader.name}</p>
                    <p className="text-xs text-muted-foreground">{leader.position || "Kepala Unit"}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] h-5 opacity-0 group-hover:opacity-100 transition-opacity">
                  Lihat Profil
                </Badge>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic bg-slate-50 p-3 rounded-lg border border-dashed text-center">
                Belum ada kepala unit ditunjuk
              </p>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Anggota Unit ({displayMembers.length})
            </h3>
            <div className="space-y-2">
              {displayMembers.length > 0 ? (
                displayMembers.map((m) => (
                  <div 
                    key={m.id} 
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-primary/30 hover:bg-slate-50 cursor-pointer transition-all group"
                    onClick={() => onViewEmployee(m)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 border border-white shadow-sm">
                        <AvatarImage src={m.avatar_url || ""} className="object-cover" />
                        <AvatarFallback className="bg-slate-100 text-slate-500 text-[10px] font-bold">
                          {m.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-slate-900 group-hover:text-primary transition-colors">{m.name}</p>
                        <p className="text-[11px] text-muted-foreground">{m.position || "Anggota"}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] h-5 opacity-0 group-hover:opacity-100 transition-opacity">
                      Lihat Profil
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-center text-muted-foreground py-4">Belum ada anggota di unit ini</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
