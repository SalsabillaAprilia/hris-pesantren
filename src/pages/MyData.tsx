import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
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
  Paperclip, Camera, Shield, Briefcase,
} from "lucide-react";
import { format } from "date-fns";

const RELIGIONS = ["Islam", "Kristen Protestan", "Katolik", "Hindu", "Buddha", "Konghucu"];
const GENDERS = ["Laki-laki", "Perempuan"];
const MARITAL_STATUS = ["Belum Menikah", "Menikah", "Cerai Hidup", "Cerai Mati"];
const EDUCATION_LEVELS = ["SD", "SMP", "SMA/SMK", "D1", "D2", "D3", "D4", "S1", "S2", "S3"];
const ID_TYPES = ["KTP", "Paspor", "SIM"];
const NATIONALITIES = ["WNI", "WNA"];

export default function MyDataPage() {
  const { employee, user } = useAuth();
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const avatarRef = useRef<HTMLInputElement>(null);

  // Read-only info from HR
  const [unitName, setUnitName] = useState("");
  const [shiftName, setShiftName] = useState("");

  useEffect(() => {
    if (!employee) return;
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
      const url = await uploadFile(file, `avatars/${employee.id}_${Date.now()}`);
      
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
      toast.success("Foto berhasil diupload");
    } catch { toast.error("Gagal mengupload foto"); }
    finally { setUploading(false); }
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
    } catch (err: any) {
      toast.error("Gagal menyimpan: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Memuat data...</div>
    </DashboardLayout>
  );

  const Section = ({ icon: Icon, title, color, children }: any) => (
    <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
      <div className={`flex items-center gap-2.5 px-5 py-3.5 border-b border-l-4 ${color}`}>
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
      </div>
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );

  const Field = ({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) => (
    <div className={`space-y-1.5 ${full ? "md:col-span-2" : ""}`}>
      <Label className="text-xs text-muted-foreground font-semibold">{label}</Label>
      {children}
    </div>
  );

  const ReadField = ({ label, value }: { label: string; value: string }) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground font-semibold">{label}</Label>
      <div className="h-9 flex items-center px-3 rounded-md bg-muted/40 border text-sm text-slate-600 font-medium">
        {value || <span className="text-muted-foreground/60 font-normal">—</span>}
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div className="page-header mb-0">
          <h1 className="page-title">Data Diri Saya</h1>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || uploading}
          className="gap-2 bg-primary hover:bg-primary/90 shadow-md shadow-primary/10 font-medium"
        >
          <Save className="h-4 w-4" />
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </Button>
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
                className="absolute -bottom-1 -right-1 h-7 w-7 flex items-center justify-center rounded-full bg-primary text-white shadow-md hover:bg-primary/90 transition-colors"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div>
              <p className="font-bold text-foreground text-base">{employee?.name}</p>
              <p className="text-sm text-muted-foreground">{employee?.email}</p>
              <p className="text-xs text-muted-foreground mt-1">Klik ikon kamera untuk mengganti foto • Maks. 2MB</p>
            </div>
          </div>
        </div>

        {/* Data Kepegawaian (Read-only) */}
        <Section icon={Briefcase} title="Data Kepegawaian" color="border-l-[hsl(232,59%,21%)] bg-muted/20">
          <ReadField label="Nama Lengkap" value={employee?.name || ""} />
          <ReadField label="Email" value={employee?.email || ""} />
          <ReadField label="NIP / ID Karyawan" value={employee?.employee_id_number || ""} />
          <ReadField label="Jabatan" value={employee?.position || ""} />
          <ReadField label="Unit Kerja" value={unitName} />
          <ReadField label="Tanggal Masuk" value={employee?.join_date ? format(new Date(employee.join_date), "dd MMMM yyyy") : ""} />
          <ReadField label="Shift Kerja" value={shiftName} />
          <ReadField label="Status" value={employee?.status === "active" ? "Aktif" : employee?.status === "inactive" ? "Nonaktif" : "Cuti"} />
        </Section>

        {/* Identitas Diri */}
        <Section icon={User} title="Identitas Diri" color="border-l-emerald-500 bg-muted/20">
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
        <Section icon={Shield} title="Dokumen Identitas" color="border-l-amber-500 bg-muted/20">
          <Field label="Jenis Identitas">
            <Select value={form.identity_card_type} onValueChange={(v) => set("identity_card_type", v)}>
              <SelectTrigger className="h-9 text-sm shadow-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{ID_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Nomor Identitas">
            <Input value={form.identity_card_number} onChange={(e) => set("identity_card_number", e.target.value)} className="h-9 text-sm shadow-sm" placeholder="Nomor KTP/Paspor/SIM" />
          </Field>
        </Section>

        {/* Kontak */}
        <Section icon={Phone} title="Kontak" color="border-l-blue-500 bg-muted/20">
          <Field label="Nomor WhatsApp" full>
            <Input value={form.whatsapp_number} onChange={(e) => set("whatsapp_number", e.target.value)} className="h-9 text-sm shadow-sm" placeholder="Contoh: 08xxxxxxxxxx" />
          </Field>
        </Section>

        {/* Alamat */}
        <Section icon={MapPin} title="Alamat" color="border-l-rose-500 bg-muted/20">
          <Field label="Alamat sesuai KTP" full>
            <Textarea value={form.address} onChange={(e) => set("address", e.target.value)} className="text-sm shadow-sm resize-none" rows={2} placeholder="Jalan, RT/RW, Kelurahan, Kecamatan, Kota, Provinsi" />
          </Field>
          <Field label="Alamat Domisili" full>
            <Textarea value={form.address_domicile} onChange={(e) => set("address_domicile", e.target.value)} className="text-sm shadow-sm resize-none" rows={2} placeholder="Kosongkan jika sama dengan alamat KTP" />
          </Field>
        </Section>

        {/* Pendidikan */}
        <Section icon={GraduationCap} title="Pendidikan Terakhir" color="border-l-purple-500 bg-muted/20">
          <Field label="Jenjang Pendidikan">
            <Select value={form.education_level} onValueChange={(v) => set("education_level", v)}>
              <SelectTrigger className="h-9 text-sm shadow-sm"><SelectValue placeholder="Pilih..." /></SelectTrigger>
              <SelectContent>{EDUCATION_LEVELS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Nama Institusi">
            <Input value={form.education_institution} onChange={(e) => set("education_institution", e.target.value)} className="h-9 text-sm shadow-sm" placeholder="Nama universitas/sekolah" />
          </Field>
          <Field label="Jurusan / Program Studi" full>
            <Input value={form.education_major} onChange={(e) => set("education_major", e.target.value)} className="h-9 text-sm shadow-sm" placeholder="Nama jurusan" />
          </Field>
        </Section>


        {/* Tombol simpan bawah */}
        <div className="flex justify-end pb-2">
          <Button
            onClick={handleSave}
            disabled={saving || uploading}
            className="gap-2 bg-primary hover:bg-primary/90 shadow-md shadow-primary/10 font-medium"
          >
            <Save className="h-4 w-4" />
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
