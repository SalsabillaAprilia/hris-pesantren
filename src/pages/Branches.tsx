import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth, Institution } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Building2, Plus, Pencil, UploadCloud, Map, Search, Camera, X, Archive, ArchiveRestore } from "lucide-react";
import { uploadFile } from "@/utils/supabase-storage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

let globalBranchesCache: Institution[] | null = null;

export default function Branches() {
  const { isSuperAdmin, isDirector, refreshInstitutions, setAllInstitutions, selectedInstansiId, setSelectedInstansiId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [branches, setBranches] = useState<Institution[]>(globalBranchesCache || []);
  const [loading, setLoading] = useState(globalBranchesCache === null);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");

  const filteredBranches = useMemo(() => {
    if (!search.trim()) return branches;
    const q = search.toLowerCase();
    return branches.filter((b) => b.name.toLowerCase().includes(q));
  }, [branches, search]);

  const isFirstFetch = useRef(globalBranchesCache === null);
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [organizationTerm, setOrganizationTerm] = useState("Unit");

  // Form State

  const fetchBranches = useCallback(async () => {
    if (isFirstFetch.current) setLoading(true);
    try {
      const { data, error } = await supabase
        .from("institutions")
        .select("*")
        .order("name");
      
      if (error) throw error;
      
      if (isMounted.current) {
        setBranches(data || []);
        globalBranchesCache = data || [];
      }
    } catch (err: any) {
      console.error("Fetch branches error:", err);
      if (isMounted.current && err.code !== "PGRST116") toast.error("Gagal memuat data cabang.");
    } finally {
      if (isMounted.current) {
        setLoading(false);
        isFirstFetch.current = false;
      }
    }
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    if (searchParams.get("action") === "create" && !dialogOpen) {
      openCreate();
      // Remove query param clean up
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const openCreate = () => {
    setDialogMode("create");
    setEditingId(null);
    setName("");
    setLogoFile(null);
    setLogoPreview(null);
    setOrganizationTerm("Unit");
    setDialogOpen(true);
  };

  const openEdit = (branch: Institution) => {
    setDialogMode("edit");
    setEditingId(branch.id);
    setName(branch.name);
    setLogoFile(null);
    setLogoPreview(branch.logo_url);
    setOrganizationTerm(branch.organization_term || "Unit");
    setDialogOpen(true);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
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

      // Hapus logo lama jika dalam mode edit dan logo berubah atau dihapus
      if (dialogMode === "edit") {
        const branchToEdit = branches.find(b => b.id === editingId);
        if (branchToEdit && branchToEdit.logo_url && branchToEdit.logo_url !== logoPreview) {
          try {
            const oldPathMatch = branchToEdit.logo_url.match(/logos\/(.+)$/);
            if (oldPathMatch && oldPathMatch[1]) {
              await supabase.storage.from("logos").remove([oldPathMatch[1]]);
            }
          } catch (e) {
            console.error("Failed to delete old logo:", e);
          }
        }
      }

      // Upload file jika ada file baru yang dipilih
      if (logoFile) {
        const uploadedUrl = await uploadFile(logoFile, "logos");
        finalLogoUrl = uploadedUrl;
      }

      const payload = {
        name: name.trim().toUpperCase(),
        logo_url: logoFile ? finalLogoUrl : (logoPreview || null),
        organization_term: organizationTerm,
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
      await new Promise(res => setTimeout(res, 300)); // Delay for DB consistency
      await fetchBranches();
      await refreshInstitutions(); // Perbarui global state agar header & sidebar berubah
    } catch (err: any) {
      console.error("Save branch error:", err);
      toast.error(err.message || "Gagal menyimpan cabang");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleArchiveBranch = async (branch: Institution) => {
    try {
      const newStatus = branch.is_active === false ? true : false;
      const { error } = await supabase.from("institutions").update({ is_active: newStatus }).eq("id", branch.id);
      if (error) throw error;
      toast.success(newStatus ? "Cabang diaktifkan kembali." : "Cabang diarsipkan.");
      
      // Update state secara optimistik untuk bypass browser HTTP cache (yang bikin dropdown telat update)
      const updatedBranches = branches.map(b => b.id === branch.id ? { ...b, is_active: newStatus } : b);
      setBranches(updatedBranches);
      globalBranchesCache = updatedBranches;
      setAllInstitutions(updatedBranches.filter(i => i.is_active !== false));
      
      // Jika cabang yang sedang diarsipkan itu adalah yang sedang di-select di dropdown, reset dropdown ke "Semua Cabang"
      if (newStatus === false && selectedInstansiId === branch.id) {
        setSelectedInstansiId(null);
      }
      
      // Tetap jalankan network fetch di background untuk konsistensi
      fetchBranches();
      refreshInstitutions();
    } catch (err: any) { 
      console.error("Archive branch error:", err);
      toast.error("Gagal mengubah status cabang: " + err.message); 
    }
  };

  // Hanya Super Admin dan Direktur yang boleh akses, meskipun dilindungi oleh Guard di App.tsx, kita double check UI-nya
  if (!isSuperAdmin && !isDirector) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 className="h-16 w-16 text-muted-foreground opacity-20 mb-4" />
          <h2 className="text-xl font-bold">Akses Ditolak</h2>
          <p className="text-muted-foreground">Hanya Super Admin Global dan Direktur yang dapat mengakses halaman ini.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-4">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Pengaturan Cabang
            </h1>
          </div>
          <Button
            size="sm"
            onClick={openCreate}
            className="gap-2 shadow-md shadow-primary/10 bg-primary hover:bg-primary/90 transition-all transform active:scale-95 font-medium w-[150px]"
          >
            <Plus className="h-4 w-4" /> Tambah Cabang
          </Button>
        </div>

        {/* ── Toolbar filter ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Kiri: Search bar */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama cabang..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm shadow-sm border-primary/40 bg-white/50 transition-all"
            />
          </div>
        </div>

        <div className="relative border rounded-md bg-white flex flex-col">
          <div className="overflow-x-auto overflow-y-visible flex-1 h-auto relative">
            <table className="w-full caption-bottom text-sm relative border-separate border-spacing-0">
              <TableHeader className="z-20 transition-none [&_th]:sticky [&_th]:top-0 [&_th:not(.sticky)]:z-30 [&_th:not(.sticky)]:bg-muted">
                <TableRow className="border-none hover:bg-transparent h-11">
                  <TableHead className="w-14 text-center font-semibold">No</TableHead>
                  <TableHead className="font-semibold w-20">Logo</TableHead>
                  <TableHead className="font-semibold">Nama Cabang</TableHead>
                  <TableHead className="font-semibold text-center w-40">Istilah Organisasi</TableHead>
                  <TableHead className="font-semibold w-40 text-center">Tanggal Dibuat</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Memuat data cabang...
                  </TableCell>
                </TableRow>
              ) : filteredBranches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    {search ? "Tidak ada cabang yang sesuai dengan pencarian." : "Belum ada cabang terdaftar."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredBranches.map((branch, index) => (
                <TableRow key={branch.id} className="hover:bg-muted/50 transition-colors h-11 group border-b border-gray-200 text-sm">
                  <TableCell className="text-center text-slate-500 py-1.5">{index + 1}</TableCell>
                  <TableCell className="py-1.5">
                    {branch.logo_url ? (
                      <img src={branch.logo_url} alt="Logo" className="h-7 w-7 rounded object-contain border" />
                    ) : (
                      <div className="h-7 w-7 rounded bg-slate-100 border flex items-center justify-center text-[10px] font-bold text-slate-400">
                        {branch.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold text-slate-900 py-1.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className={branch.is_active === false ? "text-slate-500" : ""}>{branch.name}</span>
                      {branch.is_active === false && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200 text-slate-500">Diarsipkan</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-900 py-1.5 px-4 text-center">
                    {branch.organization_term || "Unit"}
                  </TableCell>
                  <TableCell className="text-slate-900 py-1.5 px-4 truncate text-center">
                    {branch.created_at ? format(new Date(branch.created_at), "dd MMMM yyyy", { locale: localeId }) : "-"}
                  </TableCell>
                  <TableCell className="py-1.5 text-right px-4">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-slate-400 hover:text-primary hover:bg-primary/10"
                        onClick={() => openEdit(branch)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title={branch.is_active === false ? "Aktifkan" : "Arsipkan"}
                        className={`h-7 w-7 p-0 transition-all text-slate-400 ${branch.is_active === false ? "hover:text-emerald-600 hover:bg-emerald-50" : "hover:text-amber-600 hover:bg-amber-50"}`}
                        onClick={() => toggleArchiveBranch(branch)}
                      >
                        {branch.is_active === false ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </table>
      </div>
      </div>
      </div>

      {/* Dialog Form */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 border-b bg-muted/30">
            <DialogTitle className="text-xl font-bold tracking-tight">
              {dialogMode === "create" ? "Tambah Cabang Baru" : "Edit Cabang"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              <div className="flex flex-col items-center justify-center pt-2">
                <div className="relative group">
                  <Avatar className="h-28 w-28 border-4 border-white shadow-2xl rounded-xl">
                    <AvatarImage src={logoPreview || ""} className="object-contain" />
                    <AvatarFallback className="bg-slate-50 text-slate-300 rounded-xl">
                      <Building2 className="h-12 w-12" />
                    </AvatarFallback>
                  </Avatar>
                  <button 
                    type="button"
                    onClick={() => document.getElementById("logo-upload")?.click()}
                    className="absolute bottom-1 right-1 h-9 w-9 bg-primary text-white rounded-full flex items-center justify-center shadow-lg hover:bg-primary/90 transition-all border-4 border-white"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                  {logoPreview && (
                    <button 
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute -top-1 -right-1 h-7 w-7 bg-destructive text-white rounded-full flex items-center justify-center shadow-md hover:bg-destructive/90 transition-all border-2 border-white z-10"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <Input 
                    id="logo-upload"
                    type="file" 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/png, image/jpeg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground/90 font-bold">Nama Cabang *</Label>
                  <Input 
                    placeholder="Masukkan Nama Cabang..." 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className="h-9 text-sm text-slate-900 shadow-sm uppercase placeholder:normal-case"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground/90 font-bold">Istilah Grup Organisasi *</Label>
                  <Select value={organizationTerm} onValueChange={setOrganizationTerm}>
                    <SelectTrigger className="h-9 text-sm text-slate-900 shadow-sm">
                      <SelectValue placeholder="Pilih istilah untuk cabang ini" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Unit">Unit</SelectItem>
                      <SelectItem value="Divisi">Divisi</SelectItem>
                      <SelectItem value="Departemen">Departemen</SelectItem>
                      <SelectItem value="Fakultas">Fakultas</SelectItem>
                      <SelectItem value="Bagian">Bagian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

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
    </DashboardLayout>
  );
}
