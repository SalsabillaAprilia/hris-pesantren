import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download } from "lucide-react";

interface ExportCsvConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: any;
  setConfig: (config: any) => void;
  onDownload: () => void;
}

export function ExportCsvConfigDialog({
  open,
  onOpenChange,
  config,
  setConfig,
  onDownload
}: ExportCsvConfigDialogProps) {
  
  const selectAll = () => {
    const newConfig = { ...config };
    Object.keys(newConfig).forEach(key => newConfig[key] = true);
    setConfig(newConfig);
  };

  const deselectAll = () => {
    const newConfig = { ...config };
    Object.keys(newConfig).forEach(key => newConfig[key] = false);
    setConfig(newConfig);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] shadow-2xl border-none p-0 overflow-hidden bg-white">
        <DialogHeader className="p-6 border-b bg-muted/30">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Ekspor CSV
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">Pilih kolom yang ingin disertakan dalam file CSV.</p>
        </DialogHeader>
        
        <div className="p-6">
          <div className="flex justify-between items-center py-2 border-b mb-4 w-full">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-sm font-bold hover:bg-primary/10 hover:text-primary transition-colors px-2"
              onClick={selectAll}
            >
              Pilih Semua
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-sm font-bold text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors px-2"
              onClick={deselectAll}
            >
              Hapus Semua
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-4 max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar py-2">
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-primary bg-primary/5 p-1.5 px-2 rounded">Data Pribadi</h4>
              <div className="space-y-3.5 pl-1">
                <CsvOption id="name" label="Nama Lengkap" checked={config.name} onChange={(v) => setConfig({...config, name: v})} />
                <CsvOption id="id" label="ID Karyawan" checked={config.employee_id} onChange={(v) => setConfig({...config, employee_id: v})} />
                <CsvOption id="gender" label="Jenis Kelamin" checked={config.gender} onChange={(v) => setConfig({...config, gender: v})} />
                <CsvOption id="birth" label="Tgl Lahir" checked={config.birth_date} onChange={(v) => setConfig({...config, birth_date: v})} />
                <CsvOption id="religion" label="Agama" checked={config.religion} onChange={(v) => setConfig({...config, religion: v})} />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-primary bg-primary/5 p-1.5 px-2 rounded">Kontak & Tugas</h4>
              <div className="space-y-3.5 pl-1">
                <CsvOption id="whatsapp" label="WhatsApp" checked={config.whatsapp} onChange={(v) => setConfig({...config, whatsapp: v})} />
                <CsvOption id="email" label="Email" checked={config.email} onChange={(v) => setConfig({...config, email: v})} />
                <CsvOption id="unit" label="Unit Kerja" checked={config.unit} onChange={(v) => setConfig({...config, unit: v})} />
                <CsvOption id="pos" label="Jabatan" checked={config.position} onChange={(v) => setConfig({...config, position: v})} />
                <CsvOption id="status" label="Status" checked={config.status} onChange={(v) => setConfig({...config, status: v})} />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t bg-muted/30 flex gap-3">
          <Button variant="outline" className="flex-1 h-10 text-sm font-semibold" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={onDownload} className="flex-[2] h-10 text-sm gap-2 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 font-bold transition-all transform active:scale-95">
            <Download className="h-4 w-4" /> Download Sekarang
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CsvOption({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between group">
      <Label htmlFor={`csv-${id}`} className="text-xs cursor-pointer font-semibold group-hover:text-primary transition-colors">{label}</Label>
      <Switch 
        id={`csv-${id}`} 
        checked={checked} 
        onCheckedChange={onChange} 
        className="h-5 w-9 data-[state=checked]:bg-primary scale-90"
      />
    </div>
  );
}
