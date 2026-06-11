import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { uploadFile } from "@/utils/supabase-storage";
import { Camera, Lock, Eye, EyeOff, ShieldCheck, User, X, Mail } from "lucide-react";

export default function ProfilePage() {
  const { employee, roles, user, refreshSession } = useAuth();
  const [avatarPreview, setAvatarPreview] = useState(employee?.avatar_url || "");
  const [uploading, setUploading] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  // Ganti password
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [savingPw, setSavingPw] = useState(false);

  // Ganti email
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const toggleShow = (key: keyof typeof showPw) =>
    setShowPw((p) => ({ ...p, [key]: !p[key] }));

  // Upload foto profil
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Ukuran foto maksimal 2MB"); return; }
    setUploading(true);
    try {
      const url = await uploadFile(file);
      
      setAvatarPreview(url);
      
      // Delete old avatar if exists
      if (employee.avatar_url) {
        try {
          const oldPathMatch = employee.avatar_url.match(/avatars\/(.+)$/);
          if (oldPathMatch && oldPathMatch[1]) {
            await supabase.storage.from("avatars").remove([oldPathMatch[1]]);
          }
        } catch (err) {
          console.error("Failed to delete old avatar:", err);
        }
      }

      await supabase.from("employees").update({ avatar_url: url }).eq("id", employee.id);
      await refreshSession(true);
      toast.success("Foto profil berhasil diperbarui!");
    } catch {
      toast.error("Gagal mengupload foto");
    } finally {
      setUploading(false);
    }
  };

  // Hapus foto profil
  const handleRemoveAvatar = async () => {
    if (!employee || !employee.avatar_url) return;
    setUploading(true);
    try {
      const oldPathMatch = employee.avatar_url.match(/avatars\/(.+)$/);
      if (oldPathMatch && oldPathMatch[1]) {
        await supabase.storage.from("avatars").remove([oldPathMatch[1]]);
      }
      
      const { error } = await supabase.from("employees").update({ avatar_url: null }).eq("id", employee.id);
      if (error) throw error;
      
      setAvatarPreview("");
      toast.success("Foto profil berhasil dihapus!");
      await refreshSession(true);
    } catch {
      toast.error("Gagal menghapus foto profil");
    } finally {
      setUploading(false);
    }
  };

  // Ganti email
  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || newEmail === employee?.email) return;
    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      
      // Update juga di tabel employees agar sinkron (berguna saat fitur Email Confirmations mati di masa dev)
      if (employee?.id) {
        await supabase.from("employees").update({ email: newEmail }).eq("id", employee.id);
      }
      
      setNewEmail("");
      await refreshSession(true);
      toast.success("Email berhasil diperbarui!");
    } catch (err: any) {
      toast.error(err.message || "Gagal mengganti email");
    } finally {
      setSavingEmail(false);
    }
  };

  // Ganti password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.next.length < 8) {
      toast.error("Password baru minimal 8 karakter");
      return;
    }
    if (passwords.next !== passwords.confirm) {
      toast.error("Konfirmasi password tidak cocok");
      return;
    }
    setSavingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwords.next });
      if (error) throw error;
      setPasswords({ current: "", next: "", confirm: "" });
      await refreshSession(true);
      toast.success("Password berhasil diperbarui!");
    } catch (err: any) {
      toast.error(err.message || "Gagal mengganti password");
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1 className="page-title">Profil Akun</h1>
      </div>

      <div className="max-w-2xl space-y-5">

        {/* Identitas Akun */}
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-l-4 border-l-[hsl(232,59%,21%)] bg-gradient-to-r from-[hsl(232,59%,96%)] to-transparent text-[hsl(232,59%,21%)]">
            <User className="h-4 w-4" />
            <h2 className="text-sm font-bold">Identitas Akun</h2>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-5">
              {/* Avatar */}
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
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 h-7 w-7 flex items-center justify-center rounded-full bg-primary text-white shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
                {avatarPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={uploading}
                    className="absolute -top-1 -right-1 h-6 w-6 flex items-center justify-center rounded-full bg-rose-500 text-white shadow-md hover:bg-rose-600 transition-colors disabled:opacity-50"
                    title="Hapus Foto"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>

              {/* Info */}
              <div className="flex-1 space-y-2">
                <div>
                  <p className="font-bold text-foreground text-base">{employee?.name || "Administrator"}</p>
                  <p className="text-sm text-muted-foreground">{employee?.email || user?.email}</p>
                  {employee?.position && (
                    <p className="text-xs text-muted-foreground mt-0.5">{employee.position}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Info read-only */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground/90 font-bold">Status Karyawan</Label>
                <div className="h-9 flex items-center px-3 rounded-md bg-muted/40 border text-sm text-slate-600">
                  {employee?.status === "active" ? "Aktif" : employee?.status === "inactive" ? "Nonaktif" : "Cuti"}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground/90 font-bold">Role Sistem</Label>
                <div className="h-9 flex items-center px-3 rounded-md bg-muted/40 border text-sm text-slate-600">
                  {roles.map((r) => {
                    const labels: Record<string, string> = {
                      super_admin: "Super Admin", hr: "HR", director: "Direktur", 
                      unit_leader: "Kepala Unit", employee: "Karyawan"
                    };
                    return labels[r] || r;
                  }).join(", ")}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ganti Email */}
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-l-4 border-l-[hsl(38,55%,30%)] bg-gradient-to-r from-[hsl(38,55%,94%)] to-transparent text-[hsl(38,55%,30%)]">
            <Mail className="h-4 w-4" />
            <h2 className="text-sm font-bold">Ganti Email</h2>
          </div>
          <form onSubmit={handleChangeEmail} className="p-5 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground/90 font-bold">Email Baru</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="h-9 text-sm shadow-sm"
                placeholder={employee?.email || user?.email || "Masukkan email baru"}
                required
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={savingEmail || !newEmail || newEmail === employee?.email}
                className="min-w-[140px] h-10 shadow-md bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all transform active:scale-95 px-6"
              >
                {savingEmail ? "Menyimpan..." : "Perbarui Email"}
              </Button>
            </div>
          </form>
        </div>

        {/* Ganti Password */}
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-l-4 border-l-[hsl(0,55%,35%)] bg-gradient-to-r from-[hsl(0,55%,96%)] to-transparent text-[hsl(0,55%,35%)]">
            <Lock className="h-4 w-4" />
            <h2 className="text-sm font-bold">Ganti Password</h2>
          </div>
          <form onSubmit={handleChangePassword} className="p-5 space-y-4">
            {[
              { key: "next", label: "Password Baru" },
              { key: "confirm", label: "Konfirmasi Password Baru" },
            ].map(({ key, label }) => (
              <div key={key} className="space-y-2">
                <Label className="text-sm text-muted-foreground/90 font-bold">{label}</Label>
                <div className="relative">
                  <Input
                    type={showPw[key as keyof typeof showPw] ? "text" : "password"}
                    value={passwords[key as keyof typeof passwords]}
                    onChange={(e) => setPasswords((p) => ({ ...p, [key]: e.target.value }))}
                    className="h-9 text-sm shadow-sm pr-10"
                    placeholder={key === "next" ? "Minimal 8 karakter" : "Ulangi password baru"}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => toggleShow(key as keyof typeof showPw)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPw[key as keyof typeof showPw]
                      ? <EyeOff className="h-4 w-4" />
                      : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={savingPw || !passwords.next || !passwords.confirm}
                className="min-w-[140px] h-10 shadow-md bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all transform active:scale-95 px-6"
              >
                {savingPw ? "Menyimpan..." : "Perbarui Password"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
