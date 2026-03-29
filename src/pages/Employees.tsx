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
import { Plus, Search } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Employee = Tables<"employees"> & { units?: { name: string } | null };

export default function Employees() {
  const { isAdminOrHr } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [units, setUnits] = useState<Tables<"units">[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", unit_id: "", position: "", password: "" });

  const fetchData = async () => {
    try {
      const [empRes, unitRes] = await Promise.all([
        supabase.from("employees").select("*, units(name)").order("name"),
        supabase.from("units").select("*"),
      ]);
      
      if (empRes.data) setEmployees(empRes.data as Employee[]);
      if (unitRes.data) setUnits(unitRes.data);
    } catch (err) {
      console.error("Employees: Unexpected error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
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
    }

    toast.success("Karyawan berhasil ditambahkan");
    setDialogOpen(false);
    setForm({ name: "", email: "", phone: "", unit_id: "", position: "", password: "" });
    fetchData();
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Tambah Karyawan</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Karyawan Baru</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nama</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
                </div>
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
                <Button type="submit" className="w-full">Simpan</Button>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Tidak ada data</TableCell></TableRow>
            ) : (
              filtered.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.name}</TableCell>
                  <TableCell>{emp.email}</TableCell>
                  <TableCell>{emp.units?.name ?? "—"}</TableCell>
                  <TableCell>{emp.position ?? "—"}</TableCell>
                  <TableCell>{statusBadge(emp.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </DashboardLayout>
  );
}
