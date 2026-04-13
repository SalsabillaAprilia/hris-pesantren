import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EmploymentSectionProps {
  form: any;
  setForm: (form: any) => void;
  units: any[];
  shifts: any[];
  isSuperAdmin: boolean;
  mode: "create" | "edit";
}

export function EmploymentSection({ form, setForm, units, shifts, isSuperAdmin, mode }: EmploymentSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
        <div className="h-4 w-1 bg-primary rounded-full"></div>
        Pendidikan & Kepegawaian
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3 border-l-2 border-muted/50 py-1">
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground/90 font-bold">Jenjang Akademik</Label>
          <Select value={form.education_level} onValueChange={(v) => setForm({ ...form, education_level: v })}>
            <SelectTrigger className="h-9 text-sm text-slate-900 shadow-sm"><SelectValue placeholder="Pilih jenjang" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="SMA/SMK" className="text-sm">SMA/SMK</SelectItem>
              <SelectItem value="D1-D3" className="text-sm">D1-D3</SelectItem>
              <SelectItem value="S1/D4" className="text-sm">S1/D4</SelectItem>
              <SelectItem value="S2" className="text-sm">S2</SelectItem>
              <SelectItem value="S3" className="text-sm">S3</SelectItem>
              <SelectItem value="Lainnya" className="text-sm">Lainnya</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground/90 font-bold">Lembaga Pendidikan</Label>
          <Input 
            value={form.education_institution} 
            onChange={(e) => setForm({ ...form, education_institution: e.target.value })} 
            className="h-9 text-sm text-slate-900 shadow-sm"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground/90 font-bold">Program Studi</Label>
          <Input 
            value={form.education_major} 
            onChange={(e) => setForm({ ...form, education_major: e.target.value })} 
            className="h-9 text-sm text-slate-900 shadow-sm"
          />
        </div>
        <div className="space-y-2 font-normal">
          <Label className="text-sm font-bold text-muted-foreground/90">Unit Kerja</Label>
          <Select value={form.unit_id} onValueChange={(v) => setForm({ ...form, unit_id: v })}>
            <SelectTrigger className="h-9 text-sm text-slate-900 shadow-sm"><SelectValue placeholder="Pilih unit" /></SelectTrigger>
            <SelectContent>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id} className="text-sm">{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 font-normal">
          <Label className="text-sm font-bold text-muted-foreground/90">Jabatan</Label>
          <Select value={form.position} onValueChange={(v) => setForm({ ...form, position: v })}>
            <SelectTrigger className="h-9 text-sm text-slate-900 shadow-sm"><SelectValue placeholder="Pilih jabatan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Guru" className="text-sm">Guru</SelectItem>
              <SelectItem value="Pembina Asrama" className="text-sm">Pembina Asrama</SelectItem>
              <SelectItem value="Petugas Kebersihan" className="text-sm">Petugas Kebersihan</SelectItem>
              <SelectItem value="Staf HR" className="text-sm">Staf HR</SelectItem>
              <SelectItem value="Kepala Unit" className="text-sm">Kepala Unit</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 font-normal">
          <Label className="text-sm font-bold text-muted-foreground/90">Jadwal Shift</Label>
          <Select value={form.shift_id ?? ""} onValueChange={(v) => setForm({ ...form, shift_id: v || null })}>
            <SelectTrigger className="h-9 text-sm text-slate-900 shadow-sm"><SelectValue placeholder="Pilih shift" /></SelectTrigger>
            <SelectContent>
              {shifts.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-sm">{s.name} ({s.start_time?.slice(0,5)} - {s.end_time?.slice(0,5)})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground/90 font-bold">Tanggal Bergabung</Label>
          <Input type="date" value={form.join_date} onChange={(e) => setForm({ ...form, join_date: e.target.value })} className="h-9 text-sm text-slate-900 shadow-sm" />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground/90 font-bold">Akhir Kontrak</Label>
          <Input type="date" value={form.contract_end_date} onChange={(e) => setForm({ ...form, contract_end_date: e.target.value })} className="h-9 text-sm text-slate-900 shadow-sm" />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-bold text-muted-foreground/90">Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger className="h-9 text-sm text-slate-900 shadow-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active" className="text-sm">Aktif</SelectItem>
              <SelectItem value="inactive" className="text-sm">Nonaktif</SelectItem>
              <SelectItem value="on_leave" className="text-sm">Cuti</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground/90 font-bold">Lampiran (URL)</Label>
          <Input 
            value={form.attachment_url} 
            onChange={(e) => setForm({ ...form, attachment_url: e.target.value })} 
            className="h-9 text-sm text-slate-900 shadow-sm"
          />
        </div>
        
        {isSuperAdmin && (
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground/90 font-bold">Role Sistem</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
            <SelectTrigger className="h-9 text-sm text-slate-900 shadow-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="super_admin" className="text-sm">Super Admin</SelectItem>
                <SelectItem value="hr" className="text-sm">HR</SelectItem>
                <SelectItem value="unit_leader" className="text-sm">Kepala Unit</SelectItem>
                <SelectItem value="employee" className="text-sm">Karyawan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {mode === "create" && (
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground/90 font-bold">Password Akun *</Label>
            <Input 
              type="password" 
              value={form.password} 
              onChange={(e) => setForm({ ...form, password: e.target.value })} 
              required 
              minLength={6} 
              placeholder="Minimal 6 karakter" 
              className="h-9 text-sm text-slate-900 shadow-sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}
