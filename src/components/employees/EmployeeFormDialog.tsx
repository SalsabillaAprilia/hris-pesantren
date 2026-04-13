import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PersonalSection } from "./form-sections/PersonalSection";
import { ContactSection } from "./form-sections/ContactSection";
import { EmploymentSection } from "./form-sections/EmploymentSection";

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  form: any;
  setForm: (form: any) => void;
  units: any[];
  shifts: any[];
  isSuperAdmin: boolean;
  isSaving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function EmployeeFormDialog({
  open,
  onOpenChange,
  mode,
  form,
  setForm,
  units,
  shifts,
  isSuperAdmin,
  isSaving,
  onSubmit
}: EmployeeFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
        <DialogHeader className="p-6 border-b bg-muted/30">
          <DialogTitle className="text-xl font-bold tracking-tight">
            {mode === "create" ? "Tambah Karyawan Baru" : "Edit Data Karyawan"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-10">
            <PersonalSection form={form} setForm={setForm} />
            <ContactSection form={form} setForm={setForm} mode={mode} />
            <EmploymentSection 
              form={form} 
              setForm={setForm} 
              units={units}
              shifts={shifts}
              isSuperAdmin={isSuperAdmin} 
              mode={mode} 
            />
          </div>
          
          <div className="p-6 border-t bg-muted/30 flex justify-end gap-3">
            <Button type="button" variant="outline" className="min-w-[140px] h-10 text-sm" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Batal
            </Button>
            <Button type="submit" disabled={isSaving} className="min-w-[140px] h-10 shadow-md bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all transform active:scale-95 px-6">
              {isSaving ? "Menyimpan..." : (mode === "create" ? "Simpan Data" : "Simpan Perubahan")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
