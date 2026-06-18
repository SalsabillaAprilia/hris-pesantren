import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface PositionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData: any;
  onSubmit: (data: any) => Promise<void>;
  loading: boolean;
}

export function PositionFormDialog({ open, onOpenChange, mode, initialData, onSubmit, loading }: PositionFormDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      if (mode === "edit" && initialData) {
        setName(initialData.name || "");
        setDescription(initialData.description || "");
      } else {
        setName("");
        setDescription("");
      }
    }
  }, [open, mode, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    onSubmit({
      name: name.trim(),
      description: description.trim() || null
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <DialogHeader className="p-6 border-b bg-muted/30">
            <DialogTitle className="text-xl font-bold tracking-tight">
              {mode === "create" ? "Tambah Jabatan Baru" : "Edit Jabatan"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-bold text-muted-foreground/90">Nama Jabatan *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Masukkan Nama Jabatan"
                className="h-9 text-sm text-slate-900 shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-bold text-muted-foreground/90">Rincian Tugas (Opsional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Pisahkan tiap tugas dengan baris baru (Enter)"
                className="min-h-[100px] text-sm text-slate-900 shadow-sm custom-scrollbar"
              />
              <p className="text-xs text-slate-500">Gunakan baris baru (Enter) untuk memisahkan setiap poin rincian tugas.</p>
            </div>
          </div>

          <div className="p-6 border-t bg-muted/30 flex justify-end gap-3">
            <Button type="button" variant="outline" className="min-w-[140px] h-10 text-sm" onClick={() => onOpenChange(false)} disabled={loading}>
              Batal
            </Button>
            <Button type="submit" disabled={loading || !name.trim()} className="min-w-[140px] h-10 shadow-md bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all transform active:scale-95 px-6">
              {loading ? "Menyimpan..." : (mode === "create" ? "Simpan Jabatan" : "Simpan Perubahan")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
