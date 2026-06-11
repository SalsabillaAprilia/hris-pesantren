import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useTerminology } from "@/hooks/useTerminology";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { uploadFile } from "@/utils/supabase-storage";
import {
  User, Phone, MapPin, GraduationCap, FileText, Save,
  Paperclip, Camera, Shield, Briefcase, X,
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

const RELIGIONS = ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Lainnya"];
const GENDERS = ["Laki-laki", "Perempuan"];
const MARITAL_STATUS = ["Belum Menikah", "Menikah", "Cerai Hidup", "Cerai Mati"];
const EDUCATION_LEVELS = ["SMA/SMK", "D1-D3", "S1/D4", "S2", "S3", "Lainnya"];
const ID_TYPES = ["KTP", "Paspor", "SIM"];
const NATIONALITIES = ["WNI", "WNA"];
const Section = ({ icon: Icon, title, color, children }: any) => (
  <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
    <div className={`flex items-center gap-2.5 px-5 py-3.5 border-b border-l-4 ${color}`}>
      <Icon className="h-4 w-4" />
      <h2 className="text-sm font-bold">{title}</h2>
    </div>
    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
  </div>
);

const Field = ({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) => (
  <div className={`space-y-2 ${full ? "md:col-span-2" : ""}`}>
    <Label className="text-sm text-muted-foreground/90 font-bold">{label}</Label>
    {children}
  </div>
);

const ReadField = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-2">
    <Label className="text-sm text-muted-foreground/90 font-bold">{label}</Label>
    <div className="h-9 flex items-center px-3 rounded-md bg-muted/40 border text-sm text-slate-600 font-medium">
      {value || <span className="text-muted-foreground/60 font-normal">—</span>}
    </div>
  </div>
);

export default function MyDataPage() {
  const { employee, user, isSuperAdmin, isDirector, isHr, refreshSession } = useAuth();
  const { term } = useTerminology();
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const avatarRef = useRef<HTMLInputElement>(null);
  const hasInitialized = useRef(false);

  // Read-only info from HR
  const [unitName, setUnitName] = useState("");
  const [shiftName, setShiftName] = useState("");

  useEffect(() => {
    if (!employee) {
      setLoading(false);
      return;
    }
    
    if (!hasInitialized.current) {
      const f: Record<string, string> = {
      gender: employee.gender || "",
      birth_place: employee.birth_place || "",
      birth_date: employee.birth_date || "",
      nationality: employee.nationality || "WNI",
      religion: employee.religion || "",
      marital_status: employee.marital_status || "",
      identity_card_type: employee.identity_card_type || "KTP",
      identity_card_number: employee.identity_card_number || "",
      whatsapp_number: employee.whatsapp_number || "",
      address: employee.address || "",
      address_domicile: employee.address_domicile || "",
      education_level: employee.education_level || "",
      education_institution: employee.education_institution || "",
      education_major: employee.education_major || "",
      attachment_url: employee.attachment_url || "",
      avatar_url: employee.avatar_url || "",
    };
      setForm(f);
      setAvatarPreview(employee.avatar_url || "");
      hasInitialized.current = true;
    } else {
      // Jika terjadi sinkronisasi data dari luar (misal auto-save foto profil memicu refreshSession)
      // Jangan reset form agar teks ketikan user tidak hilang. Cukup sinkronkan avatar-nya saja.
      if (employee.avatar_url !== form.avatar_url) {
        setAvatarPreview(employee.avatar_url || "");
        setForm(prev => ({ ...prev, avatar_url: employee.avatar_url || "" }));
      }
    }

    // Fetch unit & shift names
    const fetchMeta = async () => {
      if (employee.unit_id) {
        const { data } = await supabase.from("units").select("name").eq("id", employee.unit_id).single();
        if (data) setUnitName(data.name);
      }
      if (employee.shift_id) {
        const { data } = await supabase.from("work_shifts").select("name").eq("id", employee.shift_id).single();
        if (data) setShiftName(data.name);
      }
      setLoading(false);
    };
    fetchMeta();
  }, [employee]);

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  // Upload avatar
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Ukuran foto maksimal 2MB"); return; }
    setUploading(true);
    try {
      const url = await uploadFile(file);
      
      // Delete old avatar if exists
      if (form.avatar_url) {
        try {
          const oldPathMatch = form.avatar_url.match(/avatars\/(.+)$/);
          if (oldPathMatch && oldPathMatch[1]) {
            await supabase.storage.from("avatars").remove([oldPathMatch[1]]);
          }
        } catch (err) {
          console.error("Failed to delete old avatar:", err);
        }
      }

      setAvatarPreview(url);
      set("avatar_url", url);
      
      // Auto-save ke database agar tidak menjadi file orphan di bucket jika user lupa klik Simpan
      await supabase.from("employees").update({ avatar_url: url }).eq("id", employee.id);
      
      toast.success("Foto berhasil diupload");
      await refreshSession(true);
    } catch { toast.error("Gagal mengupload foto"); }
    finally { setUploading(false); }
  };

  const handleRemoveAvatar = async () => {
    if (!employee || !form.avatar_url) return;
    setUploading(true);
    try {
      const oldPathMatch = form.avatar_url.match(/avatars\/(.+)$/);
      if (oldPathMatch && oldPathMatch[1]) {
        await supabase.storage.from("avatars").remove([oldPathMatch[1]]);
      }
      
      const { error } = await supabase.from("employees").update({ avatar_url: null }).eq("id", employee.id);
      if (error) throw error;
      
      setAvatarPreview("");
      set("avatar_url", "");
      toast.success("Foto berhasil dihapus");
      await refreshSession(true);
    } catch {
      toast.error("Gagal menghapus foto");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!employee) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("employees").update({
        gender: form.gender || null,
        birth_place: form.birth_place || null,
        birth_date: form.birth_date || null,
        nationality: form.nationality || null,
        religion: form.religion || null,
        marital_status: form.marital_status || null,
        identity_card_type: form.identity_card_type || null,
        identity_card_number: form.identity_card_number || null,
        whatsapp_number: form.whatsapp_number || null,
        address: form.address || null,
        address_domicile: form.address_domicile || null,
        education_level: form.education_level || null,
        education_institution: form.education_institution || null,
        education_major: form.education_major || null,
        avatar_url: form.avatar_url || null,
      }).eq("id", employee.id);

      if (error) throw error;
      toast.success("Data diri berhasil disimpan!");
      await refreshSession(true);
    } catch (err: any) {
      toast.error("Gagal menyimpan: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (isSuperAdmin || isDirector || isHr) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Shield className="h-16 w-16 text-muted-foreground opacity-20 mb-4" />
          <h2 className="text-xl font-bold">Akses Ditolak</h2>
          <p className="text-muted-foreground">Halaman ini khusus untuk profil karyawan. Administrator tidak memiliki akses ke halaman ini.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Memuat data...</div>
    </DashboardLayout>
  );

  if (!loading && !employee) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <User className="h-16 w-16 text-muted-foreground opacity-20 mb-4" />
          <h2 className="text-xl font-bold">Profil Tidak Ditemukan</h2>
          <p className="text-muted-foreground">Akun Anda tidak terhubung dengan profil karyawan manapun.</p>
        </div>
      </DashboardLayout>
    );
  }


  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div className="page-header mb-0">
          <h1 className="page-title">Data Diri Saya</h1>
        </div>
      </div>

      <div className="space-y-5">

        {/* Foto Profil */}
        <div className="bg-card border rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <Avatar className="h-20 w-20 border-2 border-border shadow-sm">
                <AvatarImage src={avatarPreview} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-2xl">
                  {employee?.name?.charAt(0) ?? "U"}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => avatarRef.current?.click()}
                className="absolute -bottom-1 -right-1 h-7 w-7 flex items-center justify-center rounded-full bg-primary text-white shadow-md hover:bg-primary/90 transition-colors border-2 border-white"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              {avatarPreview && (
                <button 
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="absolute -top-1 -right-1 h-6 w-6 bg-destructive text-white rounded-full flex items-center justify-center shadow-md hover:bg-destructive/90 transition-all border-2 border-white z-10"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div>
              <p className="font-bold text-foreground text-base">{employee?.name}</p>
              <p className="text-sm text-muted-foreground">{employee?.email}</p>
            </div>
          </div>
        </div>

        {/* Data Kepegawaian (Read-only) */}
        <Section icon={Briefcase} title="Data Kepegawaian" color="border-l-[hsl(232,59%,21%)] bg-gradient-to-r from-[hsl(232,59%,96%)] to-transparent text-[hsl(232,59%,21%)]">
          <ReadField label="Nama Lengkap" value={employee?.name || ""} />
          <ReadField label="Email" value={employee?.email || ""} />
          <ReadField label="ID Karyawan" value={employee?.employee_id_number || ""} />
          <ReadField label="Jabatan" value={employee?.position || ""} />
          <ReadField label={term} value={unitName} />
          <ReadField label="Tanggal Masuk" value={employee?.join_date ? format(new Date(employee.join_date), "dd MMM yyyy", { locale: id }) : ""} />
          <ReadField label="Jadwal Kerja" value={shiftName} />
          <ReadField label="Status" value={employee?.status === "active" ? "Aktif" : employee?.status === "inactive" ? "Nonaktif" : "Cuti"} />
          <ReadField label="Akhir Kontrak" value={employee?.contract_end_date ? format(new Date(employee.contract_end_date), "dd MMM yyyy", { locale: id }) : ""} />
          <ReadField label="Link Dokumen Karyawan" value={employee?.attachment_url || ""} />
        </Section>

        {/* Identitas Diri */}
        <Section icon={User} title="Identitas Diri" color="border-l-[hsl(142,45%,25%)] bg-gradient-to-r from-[hsl(142,45%,96%)] to-transparent text-[hsl(142,45%,25%)]">
          <Field label="Jenis Kelamin">
            <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
              <SelectTrigger className="h-9 text-sm shadow-sm"><SelectValue placeholder="Pilih..." /></SelectTrigger>
              <SelectContent>{GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Kewarganegaraan">
            <Select value={form.nationality} onValueChange={(v) => set("nationality", v)}>
              <SelectTrigger className="h-9 text-sm shadow-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{NATIONALITIES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Tempat Lahir">
            <Input value={form.birth_place} onChange={(e) => set("birth_place", e.target.value)} className="h-9 text-sm shadow-sm" placeholder="Kota/Kabupaten" />
          </Field>
          <Field label="Tanggal Lahir">
            <Input type="date" value={form.birth_date} onChange={(e) => set("birth_date", e.target.value)} className="h-9 text-sm shadow-sm" />
          </Field>
          <Field label="Agama">
            <Select value={form.religion} onValueChange={(v) => set("religion", v)}>
              <SelectTrigger className="h-9 text-sm shadow-sm"><SelectValue placeholder="Pilih..." /></SelectTrigger>
              <SelectContent>{RELIGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Status Perkawinan">
            <Select value={form.marital_status} onValueChange={(v) => set("marital_status", v)}>
              <SelectTrigger className="h-9 text-sm shadow-sm"><SelectValue placeholder="Pilih..." /></SelectTrigger>
              <SelectContent>{MARITAL_STATUS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </Section>

        {/* Identitas Dokumen */}
        <Section icon={Shield} title="Dokumen Identitas" color="border-l-[hsl(0,55%,35%)] bg-gradient-to-r from-[hsl(0,55%,96%)] to-transparent text-[hsl(0,55%,35%)]">
          <Field label="Kartu Identitas">
            <Select value={form.identity_card_type} onValueChange={(v) => set("identity_card_type", v)}>
              <SelectTrigger className="h-9 text-sm shadow-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{ID_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="ID Kartu Identitas">
            <Input value={form.identity_card_number} onChange={(e) => set("identity_card_number", e.target.value)} className="h-9 text-sm shadow-sm" placeholder="Nomor KTP/Paspor/SIM" />
          </Field>
        </Section>

        {/* Kontak */}
        <Section icon={Phone} title="Kontak" color="border-l-[hsl(38,55%,30%)] bg-gradient-to-r from-[hsl(38,55%,94%)] to-transparent text-[hsl(38,55%,30%)]">
          <Field label="Nomor WhatsApp" full>
            <Input value={form.whatsapp_number} onChange={(e) => set("whatsapp_number", e.target.value)} className="h-9 text-sm shadow-sm" placeholder="Diawali dengan 0" />
          </Field>
        </Section>

        {/* Alamat */}
        <Section icon={MapPin} title="Alamat" color="border-l-[hsl(198,64%,35%)] bg-gradient-to-r from-[hsl(198,64%,94%)] to-transparent text-[hsl(198,64%,30%)]">
          <Field label="Alamat Sesuai Kartu Identitas" full>
            <Textarea value={form.address} onChange={(e) => set("address", e.target.value)} className="text-sm shadow-sm resize-none" rows={2} placeholder="Jalan, RT/RW, Kelurahan, Kecamatan, Kota, Provinsi" />
          </Field>
          <Field label="Alamat Domisili" full>
            <Textarea value={form.address_domicile} onChange={(e) => set("address_domicile", e.target.value)} className="text-sm shadow-sm resize-none" rows={2} placeholder="Kosongkan jika sama dengan alamat KTP" />
          </Field>
        </Section>

        {/* Pendidikan */}
        <Section icon={GraduationCap} title="Pendidikan Terakhir" color="border-l-[hsl(260,50%,40%)] bg-gradient-to-r from-[hsl(260,50%,96%)] to-transparent text-[hsl(260,50%,40%)]">
          <Field label="Jenjang Pendidikan">
            <Select value={form.education_level} onValueChange={(v) => set("education_level", v)}>
              <SelectTrigger className="h-9 text-sm shadow-sm"><SelectValue placeholder="Pilih..." /></SelectTrigger>
              <SelectContent>{EDUCATION_LEVELS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Nama Institusi">
            <Input value={form.education_institution} onChange={(e) => set("education_institution", e.target.value)} className="h-9 text-sm shadow-sm" placeholder="Nama universitas/sekolah" />
          </Field>
          <Field label="Program Studi" full>
            <Input value={form.education_major} onChange={(e) => set("education_major", e.target.value)} className="h-9 text-sm shadow-sm" placeholder="Nama jurusan / program studi" />
          </Field>
        </Section>


        {/* Tombol simpan bawah */}
        <div className="flex justify-end pb-2">
          <Button
            onClick={handleSave}
            disabled={saving || uploading}
            className="min-w-[140px] h-10 shadow-md bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all transform active:scale-95 px-6"
          >
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
