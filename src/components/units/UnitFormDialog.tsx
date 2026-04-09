import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Employee } from "@/types/employee";

interface UnitFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: any;
  unitMembers: Employee[];
  onSubmit: (data: any) => Promise<void>;
  loading: boolean;
}

export function UnitFormDialog({
  open,
  onOpenChange,
  mode,
  initialData,
  unitMembers,
  onSubmit,
  loading
}: UnitFormDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [leaderId, setLeaderId] = useState<string>("none");

  useEffect(() => {
    if (open) {
      setName(initialData?.name || "");
      setDescription(initialData?.description || "");
      setLeaderId(initialData?.leader_id || "none");
    }
  }, [open, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, description, leader_id: leaderId === "none" ? null : leaderId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <DialogHeader className="p-6 border-b bg-muted/30">
            <DialogTitle className="text-xl font-bold tracking-tight">
              {mode === "create" ? "Tambah Unit Baru" : "Edit Data Unit"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <div className="h-4 w-1 bg-primary rounded-full"></div>
                Informasi Dasar Unit
              </div>
              
              <div className="grid gap-5 pl-3 border-l-2 border-muted/50 py-1">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-bold text-muted-foreground/90">Nama Unit *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-10 text-sm text-slate-900 shadow-sm"
                    placeholder="Masukkan nama unit"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-bold text-muted-foreground/90">Deskripsi</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Deskripsi singkat mengenai unit ini..."
                    className="min-h-[100px] text-sm text-slate-900 shadow-sm resize-none"
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <div className="h-4 w-1 bg-primary rounded-full"></div>
                Manajemen Kepala Unit
              </div>
              
              <div className="grid gap-5 pl-3 border-l-2 border-muted/50 py-1">
                {mode === "edit" ? (
                  <div className="space-y-2">
                    <Label htmlFor="leader" className="text-sm font-bold text-muted-foreground/90">Kepala Unit</Label>
                    <Select value={leaderId} onValueChange={setLeaderId}>
                      <SelectTrigger className="h-10 text-sm text-slate-900 shadow-sm">
                        <SelectValue placeholder="Pilih Kepala Unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Tanpa Pemimpin</SelectItem>
                        {unitMembers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground italic mt-1">
                      *Hanya menampilkan karyawan yang terdaftar di unit ini
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-muted/50 rounded-xl border border-dashed border-muted-foreground/20">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Penunjukan <strong>Kepala Unit</strong> dapat dilakukan melalui tombol <strong>Edit</strong> setelah unit ini berhasil dibuat dan memiliki anggota.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 border-t bg-muted/30 flex justify-end gap-3">
            <Button type="button" variant="outline" className="min-w-[120px] h-10 text-sm" onClick={() => onOpenChange(false)} disabled={loading}>
              Batal
            </Button>
            <Button type="submit" disabled={loading} className="min-w-[140px] h-10 shadow-md bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all transform active:scale-95 px-6">
              {loading ? "Menyimpan..." : (mode === "create" ? "Simpan Unit" : "Simpan Perubahan")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
