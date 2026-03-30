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
      <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
        <div className="h-4 w-1 bg-primary rounded-full"></div>
        Informasi Pribadi
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3 border-l-2 border-muted/50 py-1">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase">ID Karyawan</Label>
          <Input 
            value={form.employee_id_number} 
            onChange={(e) => setForm({ ...form, employee_id_number: e.target.value })} 
            placeholder="KARY-001" 
            className="bg-muted/10 font-mono" 
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase font-bold">Nama Lengkap *</Label>
          <Input 
            value={form.name} 
            onChange={(e) => setForm({ ...form, name: e.target.value })} 
            required 
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase">Tempat Lahir</Label>
          <Input 
            value={form.birth_place} 
            onChange={(e) => setForm({ ...form, birth_place: e.target.value })} 
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase">Tanggal Lahir</Label>
          <Input 
            type="date" 
            value={form.birth_date} 
            onChange={(e) => setForm({ ...form, birth_date: e.target.value })} 
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase font-bold">Jenis Kelamin *</Label>
          <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Laki-laki">Laki-laki</SelectItem>
              <SelectItem value="Perempuan">Perempuan</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase">Status Perkawinan</Label>
          <Select value={form.marital_status} onValueChange={(v) => setForm({ ...form, marital_status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Belum Menikah">Belum Menikah</SelectItem>
              <SelectItem value="Menikah">Menikah</SelectItem>
              <SelectItem value="Cerai Hidup">Cerai Hidup</SelectItem>
              <SelectItem value="Cerai Mati">Cerai Mati</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase">Agama</Label>
          <Select value={form.religion} onValueChange={(v) => setForm({ ...form, religion: v })}>
            <SelectTrigger><SelectValue placeholder="Pilih agama" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Islam">Islam</SelectItem>
              <SelectItem value="Kristen">Kristen</SelectItem>
              <SelectItem value="Katolik">Katolik</SelectItem>
              <SelectItem value="Hindu">Hindu</SelectItem>
              <SelectItem value="Buddha">Buddha</SelectItem>
              <SelectItem value="Khonghucu">Khonghucu</SelectItem>
              <SelectItem value="Lainnya">Lainnya</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase">Kewarganegaraan</Label>
          <Select value={form.nationality} onValueChange={(v) => setForm({ ...form, nationality: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="WNI">WNI</SelectItem>
              <SelectItem value="WNA">WNA</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
