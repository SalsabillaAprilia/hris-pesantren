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
import { useTerminology } from "@/hooks/useTerminology";

interface UnitFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: any;
  unitMembers: Employee[];
  onSubmit: (data: any) => Promise<void>;
  loading: boolean;
  onCancel?: () => void;
}

export function UnitFormDialog({
  open,
  onOpenChange,
  mode,
  initialData,
  unitMembers,
  onSubmit,
  loading,
  onCancel
}: UnitFormDialogProps) {
  const { term, termLower, kepalaTerm } = useTerminology();
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
              {mode === "create" ? `Tambah ${term} Baru` : `Edit Data ${term}`}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-bold text-muted-foreground/90">Nama {term} *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-9 text-sm text-slate-900 shadow-sm"
                placeholder={`Masukkan nama ${termLower}`}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-bold text-muted-foreground/90">Deskripsi</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`Deskripsi singkat mengenai ${termLower} ini...`}
                className="min-h-[100px] text-sm text-slate-900 shadow-sm resize-none"
              />
            </div>

            {mode === "edit" ? (
              <div className="space-y-2">
                <Label htmlFor="leader" className="text-sm font-bold text-muted-foreground/90">{kepalaTerm}</Label>
                <Select value={leaderId} onValueChange={setLeaderId}>
                  <SelectTrigger className="h-9 text-sm text-slate-900 shadow-sm">
                    <SelectValue placeholder={`Pilih ${kepalaTerm}`} />
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
                  *Hanya menampilkan karyawan yang terdaftar di {termLower} ini
                </p>
              </div>
            ) : (
              <div className="p-4 bg-muted/50 rounded-xl border border-dashed border-muted-foreground/20">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Penunjukan <strong>{kepalaTerm}</strong> dapat dilakukan melalui tombol <strong>Edit</strong> setelah {termLower} memiliki anggota.
                </p>
              </div>
            )}
          </div>

          <div className="p-6 border-t bg-muted/30 flex justify-end gap-3">
            <Button type="button" variant="outline" className="min-w-[140px] h-10 text-sm" onClick={() => onCancel ? onCancel() : onOpenChange(false)} disabled={loading}>
              Batal
            </Button>
            <Button type="submit" disabled={loading} className="min-w-[140px] h-10 shadow-md bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all transform active:scale-95 px-6">
              {loading ? "Menyimpan..." : (mode === "create" ? `Simpan ${term}` : "Simpan Perubahan")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
