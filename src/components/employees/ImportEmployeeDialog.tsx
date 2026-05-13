import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Download, UploadCloud, CheckCircle2, XCircle, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";

interface ImportEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: any[];
  positions: any[];
  onSuccess: () => void;
}

export function ImportEmployeeDialog({ open, onOpenChange, units, positions, onSuccess }: ImportEmployeeDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [positionsCache, setPositionsCache] = useState<any[]>(positions);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const EXPECTED_HEADERS = ["Nama", "Email", "Password", "ID_Karyawan", "Jenis_Kelamin", "Jabatan", "Unit", "Role"];

  const handleDownloadTemplate = () => {
    const csvContent = "Nama,Email,Password,ID_Karyawan,Jenis_Kelamin,Jabatan,Unit,Role\nBudi Santoso,budi@pesantren.com,password123,EMP001,Laki-laki,Guru,Pendidikan,employee";
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "Template_Import_Karyawan.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const parseFile = (fileToParse: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').filter(line => line.trim() !== '');
      if (lines.length < 2) {
        toast.error("File CSV kosong atau tidak memiliki data");
        return;
      }

      // Regex to handle commas inside quotes
      const splitCsvLine = (line: string) => {
        const matches = line.match(/(\s*"[^"]+"\s*|\s*[^,]+|,)(?=,|$)/g);
        if (!matches) return [];
        let r = [];
        for (let i = 0; i < matches.length; i++) {
          let val = matches[i].trim();
          if (val === ',') {
             // empty column
             if (i === 0 || matches[i-1] === ',') r.push('');
             continue;
          }
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1).replace(/""/g, '"');
          }
          r.push(val);
        }
        return r;
      };

      const headers = splitCsvLine(lines[0]).map(h => h.trim());
      
      const missingHeaders = EXPECTED_HEADERS.filter(eh => !headers.includes(eh));
      if (missingHeaders.length > 0) {
        toast.error(`Format CSV salah. Kolom yang hilang: ${missingHeaders.join(', ')}`);
        return;
      }

      const results = [];
      for (let i = 1; i < lines.length; i++) {
        const values = splitCsvLine(lines[i]);
        if (values.length < 2) continue; // skip empty rows
        
        let obj: any = {};
        headers.forEach((h, idx) => {
          obj[h] = values[idx] || '';
        });
        results.push(obj);
      }
      
      setPreviewData(results);
      setProgress({ current: 0, total: results.length, success: 0, failed: 0 });
    };
    reader.readAsText(fileToParse);
  };

  const executeImport = async () => {
    if (previewData.length === 0) return;
    
    setIsProcessing(true);
    let successCount = 0;
    let failCount = 0;

    // Create a temporary un-persisted Supabase client for signing up users
    // This ensures the current admin's session is not overwritten
    const tempSupabase = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      }
    );

    for (let i = 0; i < previewData.length; i++) {
      setProgress(p => ({ ...p, current: i + 1 }));
      const row = previewData[i];
      
      try {
        if (!row.Email || !row.Password || !row.Nama) {
           throw new Error("Email, Password, dan Nama wajib diisi");
        }

        // 1. Create Auth User
        const { data: authData, error: authError } = await tempSupabase.auth.signUp({
          email: row.Email,
          password: row.Password,
          options: { data: { name: row.Nama } }
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error("Gagal mendapatkan User ID");

        // 2. Map Unit Name to Unit ID
        let unitId = null;
        if (row.Unit) {
           const matchedUnit = units.find(u => u.name.toLowerCase() === row.Unit.toLowerCase());
           if (matchedUnit) unitId = matchedUnit.id;
        }

        // 3. Resolve Jabatan name → position_id (case-insensitive, auto-create if missing)
        let positionId = null;
        if (row.Jabatan && row.Jabatan.trim()) {
          const jabatanLower = row.Jabatan.trim().toLowerCase();
          let matched = positionsCache.find((p: any) => p.name.toLowerCase() === jabatanLower);
          if (!matched) {
            // Auto-create jabatan baru ke master
            const { data: newPos, error: posErr } = await (supabase as any)
              .from("positions")
              .insert([{ name: row.Jabatan.trim() }])
              .select()
              .single();
            if (!posErr && newPos) {
              matched = newPos;
              setPositionsCache(prev => [...prev, newPos]);
            }
          }
          if (matched) positionId = matched.id;
        }

        // 4. Update Employee Profile (Trigger already creates the row)
        const profileUpdates = {
          name: row.Nama,
          employee_id_number: row.ID_Karyawan || null,
          gender: row.Jenis_Kelamin || 'Laki-laki',
          position_id: positionId,
          unit_id: unitId,
          status: 'active' as const
        };

        const { error: profileError } = await supabase
          .from("employees")
          .update(profileUpdates)
          .eq("user_id", authData.user.id);

        if (profileError) throw profileError;

        // 5. Set Role
        const roleStr = row.Role && ["employee", "unit_leader"].includes(row.Role.toLowerCase()) ? row.Role.toLowerCase() : "employee";
        
        const { error: roleError } = await (supabase as any)
          .from("user_roles")
          .insert({ user_id: authData.user.id, role: roleStr });

        if (roleError) {
           // Fallback update if insert fails (just in case trigger created one)
           await (supabase as any).from("user_roles").update({ role: roleStr }).eq("user_id", authData.user.id);
        }

        successCount++;
      } catch (err: any) {
        console.error(`Gagal mengimpor baris ${i+1} (${row.Email}):`, err);
        failCount++;
      }
      
      setProgress(p => ({ ...p, success: successCount, failed: failCount }));
      
      // Optional slight delay to respect Supabase API rate limits
      await new Promise(r => setTimeout(r, 400));
    }

    setIsProcessing(false);
    toast.success(`Import selesai! Berhasil: ${successCount}, Gagal: ${failCount}`);
    if (successCount > 0) {
      onSuccess();
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    setFile(null);
    setPreviewData([]);
    setProgress({ current: 0, total: 0, success: 0, failed: 0 });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b bg-muted/30">
          <DialogTitle className="text-xl font-bold tracking-tight">
            Import Karyawan Massal
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center p-4 bg-primary/5 border border-primary/10 rounded-lg">
            <div className="flex-1">
              <h4 className="font-semibold text-sm mb-1">Langkah 1: Siapkan Data</h4>
              <p className="text-xs text-muted-foreground">Isi data karyawan sesuai format kolom yang ada di dalam template CSV ini.</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-2 bg-white">
              <Download className="h-4 w-4" /> Download Template CSV
            </Button>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Langkah 2: Unggah File CSV</h4>
            <div 
              className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-1">Klik untuk memilih file CSV</p>
              <p className="text-xs text-muted-foreground">{file ? file.name : "Belum ada file dipilih"}</p>
              <Input 
                ref={fileInputRef}
                type="file" 
                accept=".csv" 
                className="hidden" 
                onChange={handleFileChange} 
              />
            </div>
          </div>

          {previewData.length > 0 && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Pratinjau Data ({previewData.length} baris)
                </h4>
                {isProcessing && (
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-md">
                    Memproses {progress.current} / {progress.total}
                  </span>
                )}
              </div>
              <div className="border rounded-md overflow-hidden">
                <div className="max-h-[250px] overflow-auto">
                  <Table>
                    <TableHeader className="bg-muted sticky top-0">
                      <TableRow>
                        <TableHead className="w-10">No</TableHead>
                        {EXPECTED_HEADERS.map(h => <TableHead key={h}>{h}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.slice(0, 50).map((row, idx) => (
                        <TableRow key={idx} className="text-xs">
                          <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell>{row.Nama}</TableCell>
                          <TableCell>{row.Email}</TableCell>
                          <TableCell className="text-muted-foreground">***</TableCell>
                          <TableCell>{row.ID_Karyawan}</TableCell>
                          <TableCell>{row.Jenis_Kelamin}</TableCell>
                          <TableCell>{row.Jabatan}</TableCell>
                          <TableCell>{row.Unit}</TableCell>
                          <TableCell>{row.Role}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              {previewData.length > 50 && (
                <p className="text-xs text-muted-foreground italic text-center">Menampilkan 50 baris pertama saja.</p>
              )}

              {isProcessing && (
                <div className="flex items-center gap-4 text-sm mt-4 p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> Berhasil: {progress.success}
                  </div>
                  <div className="flex items-center gap-2 text-rose-600">
                    <XCircle className="h-4 w-4" /> Gagal: {progress.failed}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-muted/30 flex justify-end gap-3">
          <Button variant="outline" className="min-w-[140px] h-10 text-sm" onClick={handleClose} disabled={isProcessing}>
            Batal
          </Button>
          <Button 
            onClick={executeImport} 
            disabled={previewData.length === 0 || isProcessing}
            className="min-w-[140px] h-10 text-sm gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 transition-all transform active:scale-95"
          >
            {isProcessing ? "Sedang Mengimpor..." : "Mulai Import"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
