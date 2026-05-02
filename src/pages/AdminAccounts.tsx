import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, ShieldCheck, Pencil, Trash2 } from "lucide-react";
import { supabaseFetchWithTimeout } from "@/utils/supabase-fetch";
import { format } from "date-fns";

interface AdminAccount {
  id: string;         // employees.id
  user_id: string;
  name: string;
  email: string;
  role: "super_admin" | "hr";
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  hr: "HR",
};

export default function AdminAccounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingAccount, setEditingAccount] = useState<AdminAccount | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<AdminAccount | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const INITIAL_FORM = { name: "", email: "", password: "", role: "hr" as "super_admin" | "hr" };
  const [form, setForm] = useState(INITIAL_FORM);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empRes, rolesRes] = await supabaseFetchWithTimeout(
        Promise.all([
          supabase.from("employees").select("id, user_id, name, email, created_at").order("name"),
          supabase.from("user_roles").select("user_id, role").in("role", ["super_admin", "hr"]),
        ])
      );

      if (empRes.error) throw empRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const adminUserIds = new Set((rolesRes.data ?? []).map((r) => r.user_id));
      const rolesMap = Object.fromEntries((rolesRes.data ?? []).map((r) => [r.user_id, r.role]));

      // Hanya tampilkan employee yang memiliki role super_admin atau hr
      const adminAccounts: AdminAccount[] = (empRes.data ?? [])
        .filter((emp) => adminUserIds.has(emp.user_id))
        .map((emp) => ({
          id: emp.id,
          user_id: emp.user_id,
          name: emp.name,
          email: emp.email,
          role: rolesMap[emp.user_id] as "super_admin" | "hr",
          created_at: emp.created_at,
        }));

      setAccounts(adminAccounts);
    } catch (err: any) {
      toast.error("Gagal memuat data akun: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreate = () => {
    setDialogMode("create");
    setEditingAccount(null);
    setForm(INITIAL_FORM);
    setDialogOpen(true);
  };

  const openEdit = (account: AdminAccount) => {
    setDialogMode("edit");
    setEditingAccount(account);
    setForm({ name: account.name, email: account.email, password: "", role: account.role });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (dialogMode === "create") {
        // Buat auth user baru tanpa mengganggu sesi admin yang sedang aktif
        const tempClient = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          { auth: { persistSession: false, autoRefreshToken: false } }
        );

        const { data: authData, error: authError } = await tempClient.auth.signUp({
          email: form.email,
          password: form.password,
          options: { data: { name: form.name } },
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error("Gagal membuat akun.");

        // Update profil di tabel employees (trigger otomatis membuatnya)
        await supabase
          .from("employees")
          .update({ name: form.name })
          .eq("user_id", authData.user.id);

        // Upsert role
        const { data: existingRole } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", authData.user.id)
          .maybeSingle();

        if (existingRole) {
          await supabase.from("user_roles").update({ role: form.role }).eq("id", existingRole.id);
        } else {
          await supabase.from("user_roles").insert({ user_id: authData.user.id, role: form.role });
        }

        toast.success("Akun berhasil dibuat!");
      } else if (editingAccount) {
        // Update nama di employees
        await supabase.from("employees").update({ name: form.name }).eq("id", editingAccount.id);

        // Update role di user_roles
        await supabase
          .from("user_roles")
          .update({ role: form.role })
          .eq("user_id", editingAccount.user_id);

        toast.success("Akun berhasil diperbarui!");
      }

      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan data.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingAccount || deleteConfirmText !== "HAPUS") return;
    setIsDeleting(true);
    try {
      // Hapus role dari user_roles
      await supabase.from("user_roles").delete().eq("user_id", deletingAccount.user_id);

      // Hapus data dari employees
      await supabase.from("employees").delete().eq("id", deletingAccount.id);

      toast.success("Akun berhasil dihapus.");
      setDeleteDialogOpen(false);
      setDeletingAccount(null);
      fetchData();
    } catch (err: any) {
      toast.error("Gagal menghapus akun: " + err.message);
    } finally {
      setIsDeleting(false);
      setDeleteConfirmText("");
    }
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Manajemen Akun Admin
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola akun Super Admin dan HR sistem
          </p>
        </div>
        <Button
          size="sm"
          onClick={openCreate}
          className="gap-2 shadow-md shadow-primary/10 bg-primary hover:bg-primary/90 transition-all transform active:scale-95 font-medium"
        >
          <Plus className="h-4 w-4" /> Tambah Akun
        </Button>
      </div>

      <div className="relative border rounded-md bg-white flex flex-col">
        <div className="overflow-x-auto overflow-y-visible flex-1 h-auto relative">
          <Table className="w-full caption-bottom text-sm relative border-separate border-spacing-0">
            <TableHeader className="z-20 transition-none [&_th]:sticky [&_th]:top-0 [&_th:not(.sticky)]:z-30 [&_th:not(.sticky)]:bg-muted">
              <TableRow className="h-10 border-b border-gray-200">
                <TableHead className="w-[50px] text-center font-semibold border-r border-gray-200">No.</TableHead>
                <TableHead className="font-semibold border-r border-gray-200">Nama</TableHead>
                <TableHead className="font-semibold border-r border-gray-200">Email</TableHead>
                <TableHead className="font-semibold border-r border-gray-200 w-[130px] text-center">Role</TableHead>
                <TableHead className="font-semibold border-r border-gray-200 w-[160px]">Terdaftar</TableHead>
                <TableHead className="font-semibold w-[100px] text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Memuat data...</TableCell>
                </TableRow>
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Belum ada akun admin/HR terdaftar.
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((acc, idx) => (
                  <TableRow key={acc.id} className="hover:bg-muted/50 transition-colors h-11 border-b border-gray-200 text-sm">
                    <TableCell className="text-center text-slate-500 py-1.5">{idx + 1}</TableCell>
                    <TableCell className="font-medium text-slate-900 py-1.5">{acc.name}</TableCell>
                    <TableCell className="text-slate-700 py-1.5">{acc.email}</TableCell>
                    <TableCell className="text-center py-1.5">
                      {acc.role === "super_admin" ? (
                        <Badge className="bg-primary/10 text-primary border border-primary/20 font-semibold text-[10px]">
                          Super Admin
                        </Badge>
                      ) : (
                        <Badge className="bg-accent text-accent-foreground border border-accent font-semibold text-[10px]">
                          HR
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-700 py-1.5">
                      {format(new Date(acc.created_at), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-center py-1.5">
                      <div className="flex justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-primary hover:bg-primary/10"
                          onClick={() => openEdit(acc)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => { setDeletingAccount(acc); setDeleteConfirmText(""); setDeleteDialogOpen(true); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Form Dialog Create/Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[420px] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 border-b bg-muted/30">
            <DialogTitle className="text-xl font-bold tracking-tight">
              {dialogMode === "create" ? "Tambah Akun Admin / HR" : "Edit Akun"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground/90 font-bold">Nama Lengkap</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-9 text-sm text-slate-900 shadow-sm"
                  required
                />
              </div>
              {dialogMode === "create" && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground/90 font-bold">Email</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="h-9 text-sm text-slate-900 shadow-sm"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground/90 font-bold">Password</Label>
                    <Input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="h-9 text-sm text-slate-900 shadow-sm"
                      minLength={8}
                      required
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground/90 font-bold">Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "super_admin" | "hr" })}>
                  <SelectTrigger className="h-9 text-sm text-slate-900 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hr">HR</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="p-6 border-t bg-muted/30 flex justify-end gap-3">
              <Button type="button" variant="outline" className="min-w-[100px] h-10 text-sm" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="min-w-[140px] h-10 shadow-md bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all transform active:scale-95 px-6"
              >
                {isSaving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi Hapus */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="shadow-2xl border-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">Hapus Akun?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-2">
              <p>
                Anda akan menghapus akun <strong>{deletingAccount?.name}</strong> ({deletingAccount?.email}).
                Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="space-y-2 p-4 bg-destructive/5 rounded-lg border border-destructive/10">
                <p className="text-xs text-muted-foreground">Ketik <strong>HAPUS</strong> untuk melanjutkan:</p>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="HAPUS"
                  className="h-9 text-sm border-destructive/20 focus-visible:ring-destructive"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-10 text-sm">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleteConfirmText !== "HAPUS" || isDeleting}
              className="h-10 text-sm bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold shadow-lg shadow-destructive/20"
            >
              {isDeleting ? "Menghapus..." : "Hapus Akun"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
