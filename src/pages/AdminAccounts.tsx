import { useEffect, useState, useRef, useCallback, useMemo } from "react";
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
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, ShieldCheck, Pencil, Trash2, Search } from "lucide-react";
import { supabaseFetchWithTimeout } from "@/utils/supabase-fetch";
import { format } from "date-fns";

interface AdminAccount {
  id: string;         // employees.id
  user_id: string;
  name: string;
  email: string;
  role: "super_admin" | "hr" | "director";
  created_at: string;
  cabang?: string | null;
  instansi_id?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  hr: "HR",
  director: "Direktur",
};

let globalAdminAccountsCache: AdminAccount[] | null = null;

export default function AdminAccounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AdminAccount[]>(globalAdminAccountsCache || []);
  const [loading, setLoading] = useState(globalAdminAccountsCache === null);

  const isFirstFetch = useRef(globalAdminAccountsCache === null);

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");

  const filteredAccounts = useMemo(() => {
    let result = [...accounts];
    if (filterRole !== "all") {
      result = result.filter((a) => a.role === filterRole);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((a) =>
        a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
      );
    }
    return result;
  }, [accounts, filterRole, search]);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingAccount, setEditingAccount] = useState<AdminAccount | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<AdminAccount | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [institutions, setInstitutions] = useState<any[]>([]);

  const INITIAL_FORM = { name: "", email: "", password: "", role: "hr" as "super_admin" | "hr" | "director", instansi_id: "none" };
  const [form, setForm] = useState(INITIAL_FORM);

  const fetchData = useCallback(async () => {
    if (isFirstFetch.current) setLoading(true);
    try {
      const [empRes, rolesRes, instRes] = await supabaseFetchWithTimeout(
        Promise.all([
          supabase.from("employees").select("id, user_id, name, email, created_at, instansi_id, institutions(name)").order("name"),
          supabase.from("user_roles").select("user_id, role").in("role", ["super_admin", "hr", "director"]),
          supabase.from("institutions").select("id, name, is_active").order("name"),
        ])
      );

      if (empRes.error) throw empRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (instRes.error) throw instRes.error;

      if (isMounted.current) {
        setInstitutions((instRes.data ?? []).filter((i: any) => i.is_active !== false));
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
            role: rolesMap[emp.user_id] as "super_admin" | "hr" | "director",
            created_at: emp.created_at,
            cabang: (emp.institutions as any)?.name || null,
            instansi_id: emp.instansi_id || null,
          }));

        setAccounts(adminAccounts);
        globalAdminAccountsCache = adminAccounts;
      }
    } catch (err: any) {
      if (isMounted.current && err.code !== "PGRST116") toast.error("Gagal memuat data akun: " + err.message);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        isFirstFetch.current = false;
      }
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setDialogMode("create");
    setEditingAccount(null);
    setForm(INITIAL_FORM);
    setDialogOpen(true);
  };

  const openEdit = (account: AdminAccount) => {
    setDialogMode("edit");
    setEditingAccount(account);
    setForm({ name: account.name, email: account.email, password: "", role: account.role, instansi_id: account.instansi_id || "none" });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi Manual
    if (!form.name || !form.name.trim()) {
      toast.error("Nama lengkap wajib diisi.");
      return;
    }
    if (dialogMode === "create") {
      if (!form.email || !form.email.trim()) {
        toast.error("Email wajib diisi.");
        return;
      }
      if (!form.password || form.password.length < 8) {
        toast.error("Password wajib diisi minimal 8 karakter.");
        return;
      }
    }
    if (!form.role) {
      toast.error("Role sistem wajib dipilih.");
      return;
    }
    if (form.role === "hr" && (!form.instansi_id || form.instansi_id === "none")) {
      toast.error("Silakan pilih cabang penempatan untuk HR.");
      return;
    }

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

        const isGlobal = ["super_admin", "director"].includes(form.role);
        const finalInstansiId = isGlobal || form.instansi_id === "none" ? null : form.instansi_id;

        // Update profil di tabel employees (trigger otomatis membuatnya)
        await supabase
          .from("employees")
          .update({ 
            name: form.name,
            ...(isGlobal ? { instansi_id: null, unit_id: null } : { instansi_id: finalInstansiId })
          })
          .eq("user_id", authData.user.id);

        // Upsert role
        const { data: existingRole } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", authData.user.id)
          .maybeSingle();

        if (existingRole) {
          await supabase.from("user_roles").update({ 
            role: form.role,
            ...(isGlobal ? { instansi_id: null } : { instansi_id: finalInstansiId })
          }).eq("id", existingRole.id);
        } else {
          await supabase.from("user_roles").insert({ 
            user_id: authData.user.id, 
            role: form.role,
            ...(isGlobal ? { instansi_id: null } : { instansi_id: finalInstansiId })
          });
        }

        toast.success("Akun berhasil dibuat!");
      } else if (editingAccount) {
        const isGlobal = ["super_admin", "director"].includes(form.role);
        const finalInstansiId = isGlobal || form.instansi_id === "none" ? null : form.instansi_id;

        // Update nama di employees
        await supabase.from("employees").update({ 
          name: form.name,
          ...(isGlobal ? { instansi_id: null, unit_id: null } : { instansi_id: finalInstansiId })
        }).eq("id", editingAccount.id);

        // Update role di user_roles
        await supabase
          .from("user_roles")
          .update({ 
            role: form.role,
            ...(isGlobal ? { instansi_id: null } : { instansi_id: finalInstansiId })
          })
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
    if (!deletingAccount) return;
    setIsDeleting(true);
    try {
      // Hapus akun secara penuh melalui RPC (akan ter-cascade ke employees dan user_roles)
      const { error } = await (supabase.rpc as any)("delete_auth_user", { target_user_id: deletingAccount.user_id });
      if (error) throw error;

      toast.success("Akun berhasil dihapus secara permanen.");
      setDeleteDialogOpen(false);
      setDeletingAccount(null);
      fetchData();
    } catch (err: any) {
      toast.error("Gagal menghapus akun: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-4">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Manajemen Akun Administrator
            </h1>
          </div>
          <Button
            size="sm"
            onClick={openCreate}
            className="gap-2 shadow-md shadow-primary/10 bg-primary hover:bg-primary/90 transition-all transform active:scale-95 font-medium w-[150px]"
          >
            <Plus className="h-4 w-4" /> Tambah Akun
          </Button>
        </div>

        {/* ── Toolbar filter ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Kiri: Search bar */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari nama atau email..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm shadow-sm border-primary/40 bg-white/50 transition-all" />
          </div>

          {/* Kanan: Filter Role */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="h-9 text-sm w-[150px] bg-white/50 shadow-sm border-primary/20 font-medium transition-all hover:bg-accent hover:border-accent">
                <SelectValue placeholder="Semua Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Role</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="hr">HR</SelectItem>
                <SelectItem value="director">Direktur</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Tabel ── */}
        <div className="relative border rounded-md bg-white flex flex-col">
          <div className="overflow-x-auto overflow-y-visible flex-1 h-auto relative">
            <Table className="w-full caption-bottom text-sm relative border-separate border-spacing-0">
              <TableHeader className="z-20 transition-none [&_th]:sticky [&_th]:top-0 [&_th:not(.sticky)]:z-30 [&_th:not(.sticky)]:bg-muted">
                <TableRow className="border-none hover:bg-transparent h-11">
                  <TableHead className="w-14 text-center font-semibold">No.</TableHead>
                  <TableHead className="font-semibold text-left px-4">Nama</TableHead>
                  <TableHead className="font-semibold text-left px-4">Email</TableHead>
                  <TableHead className="font-semibold text-center w-[120px]">Role Sistem</TableHead>
                  <TableHead className="font-semibold text-left w-[140px] px-4">Cabang</TableHead>
                  <TableHead className="font-semibold text-left w-[100px] whitespace-nowrap px-4">Terdaftar</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground animate-pulse">Memuat data...</TableCell>
                  </TableRow>
                ) : filteredAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      {search || filterRole !== "all" ? "Tidak ada akun yang sesuai dengan filter." : "Belum ada akun admin/HR terdaftar."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAccounts.map((acc, idx) => (
                    <TableRow key={acc.id} className="hover:bg-muted/50 transition-colors h-11 group border-none text-sm">
                      <TableCell className="text-center text-slate-500 py-1.5">{idx + 1}</TableCell>
                      <TableCell className="font-semibold text-slate-900 py-1.5 px-4">{acc.name}</TableCell>
                      <TableCell className="text-slate-700 py-1.5 px-4 truncate">{acc.email}</TableCell>
                      <TableCell className="text-center py-1.5">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${
                          acc.role === "super_admin" 
                            ? "text-[hsl(232,59%,21%)] bg-[hsl(232,59%,96%)] border-[hsl(232,59%,90%)]" 
                            : acc.role === "director" 
                            ? "text-[hsl(38,55%,30%)] bg-[hsl(38,55%,94%)] border-[hsl(38,55%,88%)]"
                            : "text-[hsl(142,45%,25%)] bg-[hsl(142,45%,96%)] border-[hsl(142,45%,90%)]"
                        }`}>
                          {acc.role === "super_admin" ? "Super Admin" :
                           acc.role === "director" ? "Direktur" :
                           acc.role === "hr" ? "HR" : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-left text-slate-700 py-1.5 px-4 truncate capitalize">
                        {["super_admin", "director"].includes(acc.role) ? (
                          <span className="normal-case">(Global)</span>
                        ) : (
                          acc.cabang ? acc.cabang.toLowerCase() : "—"
                        )}
                      </TableCell>
                      <TableCell className="text-slate-700 text-left py-1.5 px-4">
                        {format(new Date(acc.created_at), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="py-1.5 text-right px-4">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-primary hover:bg-primary/10"
                            onClick={() => openEdit(acc)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-destructive hover:bg-destructive/10"
                            onClick={() => { setDeletingAccount(acc); setDeleteDialogOpen(true); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
      </div>

      {/* Form Dialog Create/Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 border-b bg-muted/30">
            <DialogTitle className="text-xl font-bold tracking-tight">
              {dialogMode === "create" ? "Tambah Akun Administrator" : "Edit Akun Administrator"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground/90 font-bold">Nama Lengkap *</Label>
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
                    <Label className="text-sm text-muted-foreground/90 font-bold">Email *</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="h-9 text-sm text-slate-900 shadow-sm"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground/90 font-bold">Password *</Label>
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
                <Label className="text-sm text-muted-foreground/90 font-bold">Role Sistem *</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "super_admin" | "hr" | "director" })}>
                  <SelectTrigger className="h-9 text-sm text-slate-900 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hr">HR</SelectItem>
                    <SelectItem value="director">Direktur</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {form.role === "hr" && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground/90 font-bold">Cabang Penempatan *</Label>
                  <Select value={form.instansi_id === "none" ? undefined : form.instansi_id} onValueChange={(v) => setForm({ ...form, instansi_id: v })}>
                    <SelectTrigger className="h-9 text-sm text-slate-900 shadow-sm">
                      <SelectValue placeholder="-- Pilih Cabang --" />
                    </SelectTrigger>
                    <SelectContent>
                      {institutions.map((inst) => (
                        <SelectItem key={inst.id} value={inst.id}>
                          {inst.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="p-6 border-t bg-muted/30 flex justify-end gap-3">
              <Button type="button" variant="outline" className="min-w-[140px] h-10 text-sm" onClick={() => setDialogOpen(false)} disabled={isSaving}>
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="min-w-[140px] h-10 shadow-md bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all transform active:scale-95 px-6"
              >
                {isSaving ? "Menyimpan..." : (dialogMode === "create" ? "Simpan Data" : "Simpan Perubahan")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Hapus Akun?"
        itemName={`${deletingAccount?.name} (${deletingAccount?.email})`}
        requireConfirmationText={true}
        confirmText="Hapus Akun"
      />
    </DashboardLayout>
  );
}
