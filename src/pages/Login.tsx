import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState(() => localStorage.getItem("remembered_email") || "");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem("remembered_email"));
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [resetEmail, setResetEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "forgot") {
      handleResetPassword();
      return;
    }

    setLoading(true);
    
    // Handle "Remember Me" for email
    if (rememberMe) {
      localStorage.setItem("remembered_email", email);
      localStorage.setItem("use_persistent_session", "true");
    } else {
      localStorage.removeItem("remembered_email");
      localStorage.setItem("use_persistent_session", "false");
    }

    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error("Login gagal: " + error.message);
    } else {
      navigate("/");
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail) {
      toast.error("Harap masukkan email Anda");
      return;
    }
    setLoading(true);
    try {
      // Import supabase client dynamically or use the existing one if available.
      // We will use the auth context's underlying mechanism, but we need the supabase client here.
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error) throw error;
      toast.success("Link reset password telah dikirim ke email Anda!");
      setMode("login");
    } catch (err: any) {
      toast.error("Gagal mengirim link: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-slate-50 p-4 overflow-hidden">
      {/* Elegant Dot Pattern (Sangat Lembut) */}
      <div className="absolute inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.25]"></div>
      
      {/* Soft Brand Geometric Accents */}
      <div className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-primary/10 to-sky-300/20 blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-primary/10 to-indigo-400/20 blur-[100px] pointer-events-none" />
      
      {/* Clean Card */}
      <Card className="w-full max-w-[400px] shadow-2xl shadow-primary/5 border-white/80 bg-white/95 backdrop-blur-md z-10">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-16 w-16 flex items-center justify-center">
            <img src="/logo_1.png" alt="AmanaHR Logo" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-primary">AmanaHR</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {mode === "login" ? "Selamat datang kembali!" : "Reset Password"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "login" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm text-muted-foreground/90 font-bold">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    className="h-9 text-sm text-slate-900 shadow-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="masukan email anda"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm text-muted-foreground/90 font-bold">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    className="h-9 text-sm text-slate-900 shadow-sm"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="remember" 
                      checked={rememberMe} 
                      onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    />
                    <Label 
                      htmlFor="remember" 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Ingat saya
                    </Label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    Lupa Password?
                  </button>
                </div>
                <Button type="submit" className="w-full h-10 shadow-md bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all transform active:scale-95" disabled={loading}>
                  {loading ? "Memproses..." : "Masuk"}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2 mb-2">
                  <Label htmlFor="resetEmail" className="text-sm text-muted-foreground/90 font-bold">Email Anda</Label>
                  <Input
                    id="resetEmail"
                    type="email"
                    className="h-9 text-sm text-slate-900 shadow-sm"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="masukan email anda"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                    Link untuk membuat password baru akan dikirim ke email ini.
                  </p>
                </div>
                <Button type="submit" className="w-full h-10 shadow-md bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all transform active:scale-95" disabled={loading}>
                  {loading ? "Mengirim..." : "Kirim Link Reset"}
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full mt-2 text-sm" 
                  onClick={() => setMode("login")}
                  disabled={loading}
                >
                  Kembali ke Login
                </Button>
              </>
            )}
          </form>
          <p className="text-[13px] text-muted-foreground/80 text-center mt-8">
            Belum punya akun? <span className="font-medium text-slate-600">Hubungi Admin</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
