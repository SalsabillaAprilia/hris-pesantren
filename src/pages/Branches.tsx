import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { useAuth, Institution } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Building2, Plus, Pencil, Trash2, UploadCloud, Map } from "lucide-react";
import { uploadFile } from "@/utils/supabase-storage";

export default function Branches() {
  const { isSuperAdmin, refreshInstitutions } = useAuth();
  const [branches, setBranches] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0f172a");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Delete State
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingBranch, setDeletingBranch] = useState<Institution | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("institutions")
        .select("*")
        .order("name");
      
      if (error) throw error;
      setBranches(data || []);
    } catch (err: any) {
      console.error("Fetch branches error:", err);
      toast.error("Gagal memuat data cabang.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const openCreate = () => {
    setDialogMode("create");
    setEditingId(null);
    setName("");
    setPrimaryColor("#0f172a");
    setLogoFile(null);
    setLogoPreview(null);
    setDialogOpen(true);
  };

  const openEdit = (branch: Institution) => {
    setDialogMode("edit");
    setEditingId(branch.id);
    setName(branch.name);
    setPrimaryColor(branch.primary_color || "#0f172a");
    setLogoFile(null);
    setLogoPreview(branch.logo_url);
    setDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran maksimal file adalah 2MB");
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nama cabang wajib diisi");
      return;
    }

    setIsSaving(true);
    try {
      let finalLogoUrl = logoPreview;

      // Upload file jika ada file baru yang dipilih
      if (logoFile) {
        // Menggunakan bucket 'avatars' yang sudah pasti ada & public di Supabase
        const uploadedUrl = await uploadFile(logoFile, "avatars");
        finalLogoUrl = uploadedUrl;
      }

      const payload = {
        name,
        primary_color: primaryColor,
        logo_url: finalLogoUrl !== logoPreview ? finalLogoUrl : (logoPreview || null),
      };

      if (dialogMode === "create") {
        const { error } = await supabase.from("institutions").insert(payload);
        if (error) throw error;
        toast.success("Cabang berhasil ditambahkan");
      } else {
        const { error } = await supabase.from("institutions").update(payload).eq("id", editingId!);
        if (error) throw error;
        toast.success("Data cabang berhasil diperbarui");
      }

      setDialogOpen(false);
      fetchBranches();
      await refreshInstitutions(); // Perbarui global state agar header & sidebar berubah
      // Memberi notifikasi agar user me-refresh untuk melihat update tema (opsional)
      toast.info("Refresh halaman untuk melihat perubahan global");
    } catch (err: any) {
      console.error("Save branch error:", err);
      toast.error(err.message || "Gagal menyimpan cabang");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingBranch) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("institutions").delete().eq("id", deletingBranch.id);
      if (error) throw error;
      
      toast.success("Cabang berhasil dihapus");
      setDeleteOpen(false);
      fetchBranches();
      await refreshInstitutions();
    } catch (err: any) {
      console.error("Delete branch error:", err);
      if (err.code === '23503') { // Foreign key violation
        toast.error("Gagal menghapus: Cabang ini masih memiliki data karyawan atau unit yang terhubung.");
      } else {
        toast.error("Gagal menghapus cabang.");
      }
    } finally {
      setIsDeleting(false);
      setDeletingBranch(null);
    }
  };

  // Hanya Super Admin yang boleh akses, meskipun dilindungi oleh Guard di App.tsx, kita double check UI-nya
  if (!isSuperAdmin) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 className="h-16 w-16 text-muted-foreground opacity-20 mb-4" />
          <h2 className="text-xl font-bold">Akses Ditolak</h2>
          <p className="text-muted-foreground">Hanya Super Admin Global yang dapat mengakses halaman ini.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Map className="h-6 w-6 text-primary" />
            Manajemen Cabang
          </h1>
        </div>
        <Button onClick={openCreate} className="gap-2 shadow-md shadow-primary/10 bg-primary hover:bg-primary/90 font-medium">
          <Plus className="h-4 w-4" /> Tambah Cabang
        </Button>
      </div>

      <div className="border rounded-md bg-white">
        <Table className="w-full text-sm">
          <TableHeader>
            <TableRow className="bg-muted h-10">
              <TableHead className="w-[60px] text-center font-semibold">No.</TableHead>
              <TableHead className="font-semibold">Logo</TableHead>
              <TableHead className="font-semibold">Nama Cabang / Institusi</TableHead>
              <TableHead className="font-semibold w-[150px]">Tema Warna</TableHead>
              <TableHead className="text-center font-semibold w-[120px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  Memuat data cabang...
                </TableCell>
              </TableRow>
            ) : branches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  Belum ada cabang terdaftar.
                </TableCell>
              </TableRow>
            ) : (
              branches.map((branch, index) => (
                <TableRow key={branch.id} className="hover:bg-muted/50 h-14">
                  <TableCell className="text-center text-slate-500">{index + 1}</TableCell>
                  <TableCell>
                    {branch.logo_url ? (
                      <img src={branch.logo_url} alt="Logo" className="h-8 w-8 rounded object-cover border bg-white" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-slate-100 border flex items-center justify-center text-xs font-bold text-slate-400">
                        {branch.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{branch.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full border shadow-sm" 
                        style={{ backgroundColor: branch.primary_color || "#0f172a" }}
                      />
                      <span className="text-xs text-muted-foreground">{branch.primary_color || "Default"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => openEdit(branch)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => { setDeletingBranch(branch); setDeleteOpen(true); }}>
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

      {/* Dialog Form */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 border-b bg-muted/30">
            <DialogTitle className="text-xl font-bold">
              {dialogMode === "create" ? "Tambah Cabang Baru" : "Edit Cabang"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-5">
              
              <div className="space-y-2">
                <Label className="font-bold text-sm">Logo Institusi</Label>
                <div className="flex items-end gap-4">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Preview" className="h-16 w-16 rounded-md object-cover border bg-white shadow-sm" />
                  ) : (
                    <div className="h-16 w-16 rounded-md bg-slate-50 border-2 border-dashed flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-slate-300" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Label htmlFor="logo-upload" className="cursor-pointer">
                      <div className="flex items-center gap-2 h-9 px-3 rounded-md border shadow-sm bg-white hover:bg-slate-50 transition-colors w-fit text-sm font-medium">
                        <UploadCloud className="h-4 w-4 text-muted-foreground" />
                        Pilih Gambar
                      </div>
                    </Label>
                    <Input 
                      id="logo-upload" 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleFileChange}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1.5">Format JPG/PNG. Maks 2MB.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-bold text-sm">Nama Cabang / Institusi</Label>
                <Input 
                  placeholder="Cth: Pesantren Al-Falah" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  className="h-9 shadow-sm"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="font-bold text-sm">Warna Tema (Primary Color)</Label>
                <div className="flex items-center gap-3">
                  <Input 
                    type="color" 
                    value={primaryColor} 
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input 
                    type="text" 
                    value={primaryColor} 
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-9 shadow-sm font-mono text-sm uppercase flex-1"
                    placeholder="#0F172A"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Warna ini akan digunakan untuk Sidebar dan Navbar cabang ini nanti.</p>
              </div>

            </div>
            <div className="p-6 border-t bg-muted/30 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
                Batal
              </Button>
              <Button type="submit" disabled={isSaving} className="shadow-md font-bold px-6">
                {isSaving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Hapus Cabang"
        itemName={deletingBranch?.name}
        description="Peringatan: Cabang yang sudah memiliki karyawan tidak bisa dihapus."
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </DashboardLayout>
  );
}
