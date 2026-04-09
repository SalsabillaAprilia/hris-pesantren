import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Download, FileDown, FileText } from "lucide-react";

interface ExportConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "csv" | "pdf";
  config: Record<string, boolean>;
  setConfig: (config: Record<string, boolean>) => void;
  exportScope: "filtered" | "all";
  setExportScope: (scope: "filtered" | "all") => void;
  hasActiveFilters: boolean;
  onDownload: () => void;
}

export const COLUMNS_MAP = [
  { id: "name", label: "Nama Lengkap" },
  { id: "employee_id_number", label: "ID Karyawan" },
  { id: "unit", label: "Unit Kerja" },
  { id: "position", label: "Jabatan" },
  { id: "status", label: "Status Karyawan" },
  { id: "join_date", label: "Tanggal Bergabung" },
  { id: "contract_end_date", label: "Akhir Kontrak" },
  { id: "gender", label: "Jenis Kelamin" },
  { id: "birth_place", label: "Tempat Lahir" },
  { id: "birth_date", label: "Tanggal Lahir" },
  { id: "religion", label: "Agama" },
  { id: "marital_status", label: "Status Pernikahan" },
  { id: "nationality", label: "Kewarganegaraan" },
  { id: "identity_card_type", label: "Tipe Identitas" },
  { id: "identity_card_number", label: "No. Identitas" },
  { id: "whatsapp_number", label: "WhatsApp" },
  { id: "email", label: "Email" },
  { id: "address", label: "Alamat KTP" },
  { id: "address_domicile", label: "Domisili" },
  { id: "education_level", label: "Jenjang Pendidikan" },
  { id: "education_institution", label: "Institusi Pendidikan" },
  { id: "education_major", label: "Jurusan" },
];

export function ExportConfigDialog({
  open,
  onOpenChange,
  type,
  config,
  setConfig,
  exportScope,
  setExportScope,
  hasActiveFilters,
  onDownload
}: ExportConfigDialogProps) {
  
  const selectedCount = Object.values(config).filter(Boolean).length;
  const maxPdfColumns = 4;
  const isPdf = type === "pdf";

  const handleToggle = (id: string, checked: boolean) => {
    if (isPdf && checked && selectedCount >= maxPdfColumns) {
      return; // Prevent checking more than max in PDF
    }
    setConfig({ ...config, [id]: checked });
  };

  const selectAll = () => {
    if (isPdf) return; // Disabled for PDF implicitly
    const newConfig = { ...config };
    COLUMNS_MAP.forEach(col => newConfig[col.id] = true);
    setConfig(newConfig);
  };

  const deselectAll = () => {
    const newConfig = { ...config };
    COLUMNS_MAP.forEach(col => newConfig[col.id] = false);
    setConfig(newConfig);
  };

  // Prevent CSV selection leakage to PDF
  useEffect(() => {
    if (isPdf && selectedCount > maxPdfColumns) {
      const newConfig: Record<string, boolean> = {};
      let count = 0;
      COLUMNS_MAP.forEach(col => {
        if (config[col.id] && count < maxPdfColumns) {
          newConfig[col.id] = true;
          count++;
        } else {
          newConfig[col.id] = false;
        }
      });
      // If none was selected or we want to force defaults:
      if (count === 0) {
        ['name', 'employee_id_number', 'unit', 'status'].forEach(id => newConfig[id] = true);
      }
      setConfig(newConfig);
    }
  }, [isPdf, open]); 

  // Reset to "all" if active filters are gone
  useEffect(() => {
    if (open && !hasActiveFilters && exportScope === "filtered") {
      setExportScope("all");
    }
  }, [open, hasActiveFilters, exportScope, setExportScope]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] shadow-2xl border-none p-0 overflow-hidden bg-white max-h-[95vh] flex flex-col">
        <DialogHeader className="p-6 border-b bg-muted/30 flex-shrink-0">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            {isPdf ? <FileText className="h-5 w-5 text-red-500" /> : <FileDown className="h-5 w-5 text-green-600" />}
            Download {isPdf ? "PDF" : "CSV"} Karyawan
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Pilih baris data dan kolom yang ingin Anda masukkan ke dalam file.
            {isPdf && " Untuk PDF, maksimal 4 kolom saja."}
          </p>
        </DialogHeader>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          
          <div className="mb-6 space-y-3">
            <h4 className="text-sm font-bold text-slate-800">Cakupan Data</h4>
            <RadioGroup value={exportScope} onValueChange={(v) => setExportScope(v as "filtered"|"all")} className="flex flex-col sm:flex-row gap-3">
              <div className={`flex items-center space-x-2 border rounded-md p-3 flex-1 transition-all relative ${!hasActiveFilters ? 'opacity-40 cursor-not-allowed bg-slate-50' : 'cursor-pointer hover:bg-slate-50'}`}>
                <RadioGroupItem value="filtered" id="r-filtered" disabled={!hasActiveFilters} />
                <Label htmlFor="r-filtered" className={`text-sm font-semibold ${!hasActiveFilters ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                  Sesuai Filter Aktif
                </Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-md p-3 flex-1 cursor-pointer hover:bg-slate-50 relative">
                <RadioGroupItem value="all" id="r-all" />
                <Label htmlFor="r-all" className="cursor-pointer text-sm font-semibold">Semua Karyawan</Label>
              </div>
            </RadioGroup>
            {!hasActiveFilters && (
              <p className="text-[10px] text-muted-foreground italic pl-1">*Tidak ada filter yang aktif</p>
            )}
          </div>

          <div className="flex justify-between items-center py-2 border-b mb-4 bg-white">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
               Pilihan Kolom
               {isPdf && (
                 <span className={`text-[10px] px-2 py-0.5 rounded-full ${selectedCount >= maxPdfColumns ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                   {selectedCount} / {maxPdfColumns}
                 </span>
               )}
            </h4>
            <div className="flex gap-1">
              {!isPdf && (
                <Button variant="ghost" size="sm" className="h-7 text-xs font-bold text-primary hover:bg-primary/10" onClick={selectAll}>Pilih Semua</Button>
              )}
              <Button variant="ghost" size="sm" className="h-7 text-xs font-bold text-destructive hover:bg-destructive/10" onClick={deselectAll}>Hapus Semua</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
            {COLUMNS_MAP.map((col) => {
               const checked = !!config[col.id];
               const disabled = isPdf && !checked && selectedCount >= maxPdfColumns;
               
               return (
                 <div key={col.id} className={`flex items-center justify-between group p-2 rounded hover:bg-slate-50 ${disabled ? 'opacity-40' : ''}`}>
                   <Label htmlFor={`col-${col.id}`} className={`text-xs cursor-pointer font-medium flex-1 pr-2 ${disabled ? 'cursor-not-allowed text-muted-foreground' : 'group-hover:text-primary transition-colors'}`}>
                     {col.label}
                   </Label>
                   <Switch 
                     id={`col-${col.id}`} 
                     checked={checked} 
                     disabled={disabled}
                     onCheckedChange={(v) => handleToggle(col.id, v)} 
                     className="data-[state=checked]:bg-primary scale-[0.8] flex-shrink-0"
                   />
                 </div>
               );
            })}
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex gap-3 flex-shrink-0">
          <Button variant="outline" className="flex-1 h-10 text-sm font-semibold" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={onDownload} className="flex-1 h-10 text-sm gap-2 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 font-bold transition-all transform active:scale-95">
             <Download className="h-4 w-4" /> Download Sekarang
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
