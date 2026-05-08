import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Network, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PositionFormDialog } from "./PositionFormDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";

export function PositionTab({ isAdminOrHr }: { isAdminOrHr: boolean }) {
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingPosition, setEditingPosition] = useState<any>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [positionToDelete, setPositionToDelete] = useState<any>(null);

  const fetchPositions = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any).from("positions").select("*").order("name");
      if (error) {
        console.error("Error fetching positions:", error);
        // Supabase might fail if table doesn't exist yet
        if (error.code !== "42P01") throw error; // 42P01 is relation does not exist
      }
      setPositions(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Gagal memuat master jabatan. Pastikan script SQL sudah dijalankan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, []);

  const handleOpenForm = (mode: "create" | "edit", position?: any) => {
    setFormMode(mode);
    setEditingPosition(position || null);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data: any) => {
    try {
      setIsActionLoading(true);
      if (formMode === "create") {
        const { error } = await (supabase as any).from("positions").insert([data]);
        if (error) throw error;
        toast.success("Jabatan berhasil ditambahkan");
      } else {
        const { error } = await (supabase as any).from("positions").update(data).eq("id", editingPosition.id);
        if (error) throw error;
        toast.success("Jabatan berhasil diperbarui");
      }
      setIsFormOpen(false);
      fetchPositions();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan jabatan");
    } finally {
      setIsActionLoading(false);
    }
  };

  const confirmDelete = (position: any) => {
    setPositionToDelete(position);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    try {
      setIsActionLoading(true);
      // Optional: Check if employees use this position before deleting
      const { data: employeesUsing } = await supabase
        .from("employees")
        .select("id")
        .eq("position", positionToDelete.name)
        .limit(1);
        
      if (employeesUsing && employeesUsing.length > 0) {
        toast.error(`Tidak bisa menghapus: Masih ada karyawan dengan jabatan "${positionToDelete.name}".`);
        return;
      }

      const { error } = await (supabase as any).from("positions").delete().eq("id", positionToDelete.id);
      if (error) throw error;
      
      toast.success("Jabatan berhasil dihapus");
      setDeleteConfirmOpen(false);
      fetchPositions();
    } catch (err: any) {
      toast.error("Gagal menghapus jabatan");
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border shadow-sm flex flex-col min-h-[400px]">
      <div className="p-6 border-b flex items-center justify-between bg-slate-50/50 rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-lg text-slate-800">Master Data Jabatan</h2>
            <p className="text-sm text-slate-500">Kelola daftar posisi/jabatan yang tersedia untuk karyawan</p>
          </div>
        </div>
        {isAdminOrHr && (
          <Button onClick={() => handleOpenForm("create")} size="sm" className="gap-2 shadow-sm font-medium">
            <Plus className="h-4 w-4" /> Tambah Jabatan
          </Button>
        )}
      </div>

      <div className="p-0 overflow-x-auto flex-1">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground animate-pulse">Memuat data jabatan...</div>
        ) : positions.length > 0 ? (
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="w-16 text-center">No</TableHead>
                <TableHead>Nama Jabatan</TableHead>
                <TableHead className="w-48 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((pos, idx) => (
                <TableRow key={pos.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="text-center font-medium text-slate-500">{idx + 1}</TableCell>
                  <TableCell className="font-semibold text-slate-800">{pos.name}</TableCell>
                  <TableCell className="text-right">
                    {isAdminOrHr && (
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => handleOpenForm("edit", pos)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => confirmDelete(pos)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Network className="h-12 w-12 mb-4 text-slate-200" />
            <p className="font-medium">Belum ada master jabatan</p>
            <p className="text-sm">Klik "Tambah Jabatan" untuk memulai</p>
          </div>
        )}
      </div>

      <PositionFormDialog 
        open={isFormOpen} 
        onOpenChange={setIsFormOpen} 
        mode={formMode} 
        initialData={editingPosition}
        onSubmit={handleFormSubmit}
        loading={isActionLoading}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="shadow-2xl border-none p-0 overflow-hidden">
          <div className="p-6">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold">Hapus Jabatan?</AlertDialogTitle>
              <AlertDialogDescription className="pt-2 text-slate-600 leading-relaxed">
                Tindakan ini tidak dapat dibatalkan. Pastikan jabatan <strong className="text-slate-900">"{positionToDelete?.name}"</strong> memang sudah tidak diperlukan lagi.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="p-6 pt-0 gap-3 sm:gap-2">
            <AlertDialogCancel className="h-10 text-sm flex-1 sm:flex-none min-w-[100px] border-slate-200">Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              className="h-10 text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold flex-1 sm:flex-none min-w-[120px] shadow-lg shadow-destructive/10"
              disabled={isActionLoading}
            >
              {isActionLoading ? "Menghapus..." : "Ya, Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
