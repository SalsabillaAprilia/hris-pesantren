import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PersonalSectionProps {
  form: any;
  setForm: (form: any) => void;
}

export function PersonalSection({ form, setForm }: PersonalSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
        <div className="h-4 w-1 bg-primary rounded-full"></div>
        Informasi Pribadi
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3 border-l-2 border-muted/50 py-1">
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground/90 font-bold">ID Karyawan</Label>
          <Input 
            value={form.employee_id_number} 
            onChange={(e) => setForm({ ...form, employee_id_number: e.target.value })} 
            className="h-9 text-sm text-slate-900 bg-muted/10 shadow-sm" 
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground/90 font-bold">Nama Lengkap *</Label>
          <Input 
            value={form.name} 
            onChange={(e) => setForm({ ...form, name: e.target.value })} 
            required 
            className="h-9 text-sm text-slate-900 shadow-sm"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground/90 font-bold">Tempat Lahir</Label>
          <Input 
            value={form.birth_place} 
            onChange={(e) => setForm({ ...form, birth_place: e.target.value })} 
            className="h-9 text-sm text-slate-900 shadow-sm"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground/90 font-bold">Tanggal Lahir</Label>
          <Input 
            type="date" 
            value={form.birth_date} 
            onChange={(e) => setForm({ ...form, birth_date: e.target.value })} 
            className="h-9 text-sm text-slate-900 shadow-sm"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground/90 font-bold">Jenis Kelamin *</Label>
          <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
            <SelectTrigger className="h-9 text-sm text-slate-900 shadow-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Laki-laki" className="text-sm">Laki-laki</SelectItem>
              <SelectItem value="Perempuan" className="text-sm">Perempuan</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground/90 font-bold">Status Perkawinan</Label>
          <Select value={form.marital_status} onValueChange={(v) => setForm({ ...form, marital_status: v })}>
            <SelectTrigger className="h-9 text-sm text-slate-900 shadow-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Belum Menikah" className="text-sm">Belum Menikah</SelectItem>
              <SelectItem value="Menikah" className="text-sm">Menikah</SelectItem>
              <SelectItem value="Cerai Hidup" className="text-sm">Cerai Hidup</SelectItem>
              <SelectItem value="Cerai Mati" className="text-sm">Cerai Mati</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground/90 font-bold">Agama</Label>
          <Select value={form.religion} onValueChange={(v) => setForm({ ...form, religion: v })}>
            <SelectTrigger className="h-9 text-sm text-slate-900 shadow-sm"><SelectValue placeholder="Pilih agama" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Islam" className="text-sm">Islam</SelectItem>
              <SelectItem value="Kristen" className="text-sm">Kristen</SelectItem>
              <SelectItem value="Katolik" className="text-sm">Katolik</SelectItem>
              <SelectItem value="Hindu" className="text-sm">Hindu</SelectItem>
              <SelectItem value="Buddha" className="text-sm">Buddha</SelectItem>
              <SelectItem value="Lainnya" className="text-sm">Lainnya</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground/90 font-bold">Kewarganegaraan</Label>
          <Select value={form.nationality} onValueChange={(v) => setForm({ ...form, nationality: v })}>
            <SelectTrigger className="h-9 text-sm text-slate-900 shadow-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="WNI" className="text-sm">WNI</SelectItem>
              <SelectItem value="WNA" className="text-sm">WNA</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
