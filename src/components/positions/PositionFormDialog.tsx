import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  useEffect(() => {
    if (open) {
      if (mode === "edit" && initialData) {
        setName(initialData.name || "");
      } else {
        setName("");
      }
    }
  }, [open, mode, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    onSubmit({
      name: name.trim()
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden shadow-2xl border-none">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-6 border-b bg-muted/30">
            <DialogTitle className="text-xl font-bold tracking-tight">
              {mode === "create" ? "Tambah Jabatan Baru" : "Edit Nama Jabatan"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-bold text-muted-foreground/90">Nama Jabatan <span className="text-rose-500">*</span></Label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
                placeholder="Misal: Kepala SDM"
                className="h-10 text-slate-900 shadow-sm"
              />
            </div>
          </div>
          
          <DialogFooter className="p-6 border-t bg-muted/10 gap-2 sm:gap-0 flex sm:justify-end">
            <Button type="button" variant="outline" className="min-w-[120px] h-10 text-sm font-semibold" onClick={() => onOpenChange(false)} disabled={loading}>
              Batal
            </Button>
            <Button type="submit" disabled={loading || !name.trim()} className="min-w-[120px] h-10 text-sm font-bold shadow-md">
              {loading ? "Menyimpan..." : "Simpan Data"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
