import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase will automatically parse the #access_token from the URL
    // and establish a session if the recovery link is valid.
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Link reset password tidak valid atau sudah kadaluarsa");
        navigate("/login");
      }
      setSessionChecked(true);
    };
    checkSession();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password minimal 8 karakter");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Konfirmasi password tidak cocok");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      
      toast.success("Password berhasil diperbarui! Silakan masuk kembali.");
      await supabase.auth.signOut(); // Force re-login for security
      navigate("/login");
    } catch (err: any) {
      toast.error("Gagal memperbarui password: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!sessionChecked) return null;

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-gradient-to-br from-blue-100/80 via-white to-indigo-100/80 p-4 overflow-hidden">
      <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-blue-400/20 blur-[120px] z-0 pointer-events-none" />
      <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-indigo-400/20 blur-[120px] z-0 pointer-events-none" />
      
      <Card className="w-full max-w-md shadow-2xl border border-white/20 bg-card/95 backdrop-blur-sm z-10">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg">
            <Lock className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Buat Password Baru</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Silakan masukkan password baru untuk akun Anda.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password Baru</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className="pr-10"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password baru"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 mt-2">
              <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-700 leading-tight">
                Pastikan Anda menggunakan password yang kuat dan tidak membagikannya kepada siapa pun.
              </p>
            </div>

            <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-white mt-4" disabled={loading || !password || !confirmPassword}>
              {loading ? "Memperbarui..." : "Simpan Password Baru"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
