import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EmploymentSectionProps {
  form: any;
  setForm: (form: any) => void;
  units: any[];
  isSuperAdmin: boolean;
  mode: "create" | "edit";
}

export function EmploymentSection({ form, setForm, units, isSuperAdmin, mode }: EmploymentSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
        <div className="h-4 w-1 bg-primary rounded-full"></div>
        Pendidikan & Kepegawaian
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3 border-l-2 border-muted/50 py-1">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase">Lembaga Pendidikan</Label>
          <Input 
            value={form.education_institution} 
            onChange={(e) => setForm({ ...form, education_institution: e.target.value })} 
            placeholder="Universitas / Sekolah" 
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase">Fakultas / Jurusan</Label>
          <Input 
            value={form.education_major} 
            onChange={(e) => setForm({ ...form, education_major: e.target.value })} 
          />
        </div>
        <div className="space-y-2 text-primary font-semibold">
          <Label className="text-xs uppercase font-bold">Unit Kerja *</Label>
          <Select value={form.unit_id} onValueChange={(v) => setForm({ ...form, unit_id: v })}>
            <SelectTrigger><SelectValue placeholder="Pilih unit" /></SelectTrigger>
            <SelectContent>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase font-bold text-primary">Jabatan *</Label>
          <Input 
            value={form.position} 
            onChange={(e) => setForm({ ...form, position: e.target.value })} 
            placeholder="Guru / Staf / Ka. Unit" 
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase">Tanggal Bergabung</Label>
          <Input type="date" value={form.join_date} onChange={(e) => setForm({ ...form, join_date: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase font-bold">Status *</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="inactive">Nonaktif</SelectItem>
              <SelectItem value="on_leave">Cuti</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {isSuperAdmin && (
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-red-600">Role Sistem (Admin Only)</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Karyawan</SelectItem>
                <SelectItem value="unit_leader">Kepala Unit</SelectItem>
                <SelectItem value="hr">HR / Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {mode === "create" && (
          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-slate-800">Password Akun *</Label>
            <Input 
              type="password" 
              value={form.password} 
              onChange={(e) => setForm({ ...form, password: e.target.value })} 
              required 
              minLength={6} 
              placeholder="Minimal 6 karakter" 
            />
          </div>
        )}
      </div>
    </div>
  );
}
