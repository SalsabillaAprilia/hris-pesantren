import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Search, Edit, Trash } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Employee = Tables<"employees"> & { units?: { name: string } | null; role?: string };

export default function Employees() {
  const { isAdminOrHr } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [units, setUnits] = useState<Tables<"units">[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", unit_id: "", position: "", password: "", role: "employee" });

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setForm({ name: "", email: "", phone: "", unit_id: "", position: "", password: "", role: "employee" });
      setDialogMode("create");
      setEditingId(null);
    }
  };

  const fetchData = async () => {
    try {
      const [empRes, unitRes, rolesRes] = await Promise.all([
        supabase.from("employees").select("*, units(name)").order("name"),
        supabase.from("units").select("*"),
        supabase.from("user_roles").select("*"),
      ]);
      
      if (empRes.data) {
        // Gabungkan dengan role (untuk mode edit)
        const emps = empRes.data.map(emp => {
          const userRole = rolesRes.data?.find(r => r.user_id === emp.user_id)?.role || "employee";
          return { ...emp, role: userRole };
        });
        setEmployees(emps as Employee[]);
      }
      if (unitRes.data) setUnits(unitRes.data);
    } catch (err) {
      console.error("Employees: Unexpected error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (dialogMode === "create") {
      if (!form.email || !form.name || !form.password) return;

      // Create auth user first via edge function or admin - for MVP we use signUp
      // In production, use an admin invite flow
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { name: form.name } },
      });

      if (authError) {
        toast.error("Gagal membuat akun: " + authError.message);
        return;
      }

      if (authData.user) {
        // Update employee record created by trigger
        const updates: Record<string, string> = {};
        if (form.phone) updates.phone = form.phone;
        if (form.unit_id) updates.unit_id = form.unit_id;
        if (form.position) updates.position = form.position;

        if (Object.keys(updates).length > 0) {
          await supabase.from("employees").update(updates).eq("user_id", authData.user.id);
        }

        // Set role
        if (form.role && form.role !== "employee") { // default db mungkin employee, kita insert explisit jika bukan atau untuk keamanan
           await supabase.from("user_roles").insert({ user_id: authData.user.id, role: form.role as any });
        } else {
           // Insert default employee supaya recordnya ada secara eksplisit
           await supabase.from("user_roles").insert({ user_id: authData.user.id, role: "employee" });
        }
      }

      toast.success("Karyawan berhasil ditambahkan");
    } else {
      if (!editingId) return;
      
      const updates: Record<string, string> = {};
      if (form.name) updates.name = form.name;
      if (form.phone) updates.phone = form.phone;
      if (form.unit_id) updates.unit_id = form.unit_id;
      if (form.position) updates.position = form.position;
      
      const { error } = await supabase.from("employees").update(updates).eq("id", editingId);
      if (error) {
        toast.error("Gagal memperbarui karyawan: " + error.message);
        return;
      }
      
      // Update role
      const empData = employees.find(e => e.id === editingId);
      if (empData?.user_id) {
         // Hapus role lama dulu lalu insert baru (cara paling gampang karena role bisa lebih dari satu sebenarnya, tapi di UI ini kita limit 1 role utama per dropdown)
         await supabase.from("user_roles").delete().eq("user_id", empData.user_id);
         await supabase.from("user_roles").insert({ user_id: empData.user_id, role: (form.role || "employee") as any });
      }

      toast.success("Karyawan berhasil diperbarui");
    }

    setDialogOpen(false);
    setForm({ name: "", email: "", phone: "", unit_id: "", position: "", password: "", role: "employee" });
    setDialogMode("create");
    setEditingId(null);
    fetchData();
  };

  const executeDelete = async () => {
    if (!deletingEmployee) return;
    if (deleteConfirmation !== "HAPUS") {
       toast.error("Ketik HAPUS untuk mengonfirmasi");
       return;
    }
    
    setLoading(true);
    const { error } = await supabase.from("employees").delete().eq("id", deletingEmployee.id);
    if (error) {
      toast.error("Gagal menghapus karyawan: " + error.message);
      setLoading(false);
    } else {
      toast.success("Karyawan berhasil dihapus");
      setDeleteDialogOpen(false);
      setDeletingEmployee(null);
      setDeleteConfirmation("");
      fetchData();
    }
  };

  const filtered = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase())
  );

  const statusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      active: "default",
      inactive: "destructive",
      on_leave: "secondary",
    };
    const labels: Record<string, string> = { active: "Aktif", inactive: "Nonaktif", on_leave: "Cuti" };
    return <Badge variant={variants[status] ?? "secondary"}>{labels[status] ?? status}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Karyawan</h1>
          <p className="page-description">Kelola data karyawan pesantren</p>
        </div>
        {isAdminOrHr && (
          <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button onClick={() => setDialogMode("create")}><Plus className="h-4 w-4 mr-2" />Tambah Karyawan</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>{dialogMode === "create" ? "Tambah Karyawan Baru" : "Edit Karyawan"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-hidden">
                <div className="overflow-y-auto px-2 py-2 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nama</Label>
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required disabled={dialogMode === "edit"} />
                      {dialogMode === "edit" && <p className="text-xs text-muted-foreground">Email tidak dapat diubah</p>}
                    </div>
                    {dialogMode === "create" && (
                      <div className="space-y-2">
                        <Label>Password</Label>
                        <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Telepon</Label>
                      <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Unit</Label>
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
                      <Label>Jabatan</Label>
                      <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Role Sistem</Label>
                      <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                        <SelectTrigger><SelectValue placeholder="Pilih Role" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Karyawan</SelectItem>
                          <SelectItem value="unit_leader">Kepala Unit</SelectItem>
                          <SelectItem value="hr">HR / Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t mt-auto">
                  <Button type="submit" className="w-full">Simpan</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari karyawan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Jabatan</TableHead>
              <TableHead>Status</TableHead>
              {isAdminOrHr && <TableHead className="text-right">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={isAdminOrHr ? 6 : 5} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={isAdminOrHr ? 6 : 5} className="text-center py-8 text-muted-foreground">Tidak ada data</TableCell></TableRow>
            ) : (
              filtered.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.name}</TableCell>
                  <TableCell>{emp.email}</TableCell>
                  <TableCell>{emp.units?.name ?? "—"}</TableCell>
                  <TableCell>{emp.position ?? "—"}</TableCell>
                  <TableCell>{statusBadge(emp.status)}</TableCell>
                  {isAdminOrHr && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="icon" onClick={() => {
                          setDialogMode("edit");
                          setEditingId(emp.id);
                          setForm({
                            name: emp.name || "",
                            email: emp.email || "",
                            phone: emp.phone || "",
                            unit_id: emp.unit_id || "",
                            position: emp.position || "",
                            password: "",
                            role: emp.role || "employee"
                          });
                          setDialogOpen(true);
                        }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="icon" onClick={() => {
                          setDeletingEmployee(emp);
                          setDeleteConfirmation("");
                          setDeleteDialogOpen(true);
                        }}>
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Hapus</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Apakah Anda yakin ingin menghapus <strong>{deletingEmployee?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="space-y-2">
              <Label>Ketik <strong>HAPUS</strong> untuk mengonfirmasi</Label>
              <Input
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="HAPUS"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Batal</Button>
              <Button variant="destructive" onClick={executeDelete} disabled={deleteConfirmation !== "HAPUS"}>
                Hapus
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
