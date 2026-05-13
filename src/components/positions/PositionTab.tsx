import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Network, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function PositionTab({ isAdminOrHr, onAdd, isFormOpen, onFormOpenChange }: {
  isAdminOrHr: boolean;
  onAdd: () => void;
  isFormOpen: boolean;
  onFormOpenChange: (open: boolean) => void;
}) {
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog States — isFormOpen dikendalikan oleh parent (Organization.tsx)
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingPosition, setEditingPosition] = useState<any>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [positionToDelete, setPositionToDelete] = useState<any>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  
  // Reassign on delete states
  const [employeesCount, setEmployeesCount] = useState<number>(0);
  const [replacementPositionId, setReplacementPositionId] = useState<string>("");
  const [isCheckingUsage, setIsCheckingUsage] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  const fetchPositions = async () => {
    try {
      setLoading(true);
      const [posRes, empRes] = await Promise.all([
        (supabase as any).from("positions").select("*").order("name"),
        (supabase as any).from("employees").select("position_id").not("position_id", "is", null)
      ]);
      
      if (posRes.error) {
        console.error("Error fetching positions:", posRes.error);
        if (posRes.error.code !== "42P01") throw posRes.error;
      }

      const counts: Record<string, number> = {};
      (empRes.data || []).forEach((emp: any) => {
        counts[emp.position_id] = (counts[emp.position_id] || 0) + 1;
      });

      const formattedData = (posRes.data || []).map((pos: any) => ({
        ...pos,
        employee_count: counts[pos.id] || 0
      }));

      setPositions(formattedData);
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

  // Reset form state when closed
  useEffect(() => {
    if (!isFormOpen) {
      setFormMode("create");
      setEditingPosition(null);
    }
  }, [isFormOpen]);

  const handleOpenForm = (mode: "create" | "edit", position?: any) => {
    setFormMode(mode);
    setEditingPosition(position || null);
    onFormOpenChange(true);
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
      onFormOpenChange(false);
      fetchPositions();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan jabatan");
    } finally {
      setIsActionLoading(false);
    }
  };

  const confirmDelete = async (position: any) => {
    setPositionToDelete(position);
    setDeleteConfirmOpen(true);
    setReplacementPositionId("");
    setEmployeesCount(position.employee_count || 0);
  };

  const handleDelete = async () => {
    try {
      setIsActionLoading(true);
      
      // Jika ada karyawan, pastikan mereka sudah dipindahkan
      if (employeesCount > 0) {
        if (!replacementPositionId) {
          toast.error("Pilih jabatan pengganti untuk memindahkan karyawan");
          setIsActionLoading(false);
          return;
        }

        // Pindahkan karyawan secara massal
        const { error: updateError } = await (supabase as any)
          .from("employees")
          .update({ position_id: replacementPositionId })
          .eq("position_id", positionToDelete.id);
          
        if (updateError) throw updateError;
        toast.success(`${employeesCount} karyawan berhasil dipindahkan ke jabatan baru.`);
      }

      // Hapus jabatan
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

  const filteredPositions = positions.filter(pos => 
    pos.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Search Bar */}
      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama jabatan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 border-muted-foreground/20 focus-visible:ring-primary/20 bg-white"
          />
        </div>
      </div>

      <div className="relative border rounded-md bg-white flex flex-col">
        <div className="overflow-x-auto overflow-y-visible flex-1 h-auto relative">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Memuat data jabatan...</div>
          ) : filteredPositions.length > 0 ? (
            <table className="w-full caption-bottom text-sm relative border-separate border-spacing-0">
            <TableHeader className="z-20 transition-none [&_th]:sticky [&_th]:top-0 [&_th:not(.sticky)]:z-30 [&_th:not(.sticky)]:bg-muted">
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className="w-14 text-center font-semibold">No</TableHead>
                <TableHead className="font-semibold">Nama Jabatan</TableHead>
                <TableHead className="w-40 text-center font-semibold">Total Karyawan</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPositions.map((pos, idx) => (
                <TableRow
                  key={pos.id}
                  className="hover:bg-muted/50 transition-colors h-11 group border-b border-gray-200 text-sm"
                >
                  <TableCell className="text-center text-slate-500 py-1.5 font-medium">{idx + 1}</TableCell>
                  <TableCell className="font-semibold text-slate-900 py-1.5">{pos.name}</TableCell>
                  <TableCell className="text-center py-1.5">
                    {pos.employee_count > 0 ? (
                      <Badge variant="secondary" className="font-normal text-[11px] px-2 py-0 h-5 bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-default">
                        {pos.employee_count} Karyawan
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-1.5 text-right">
                    {isAdminOrHr && (
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-primary hover:bg-primary/10"
                          onClick={() => handleOpenForm("edit", pos)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => confirmDelete(pos)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            {searchQuery ? (
              <>
                <Search className="h-12 w-12 mb-4 text-slate-200" />
                <p className="font-medium">Pencarian tidak ditemukan</p>
                <p className="text-sm">"{searchQuery}" tidak cocok dengan jabatan manapun</p>
              </>
            ) : (
              <>
                <Network className="h-12 w-12 mb-4 text-slate-200" />
                <p className="font-medium">Belum ada master jabatan</p>
                <p className="text-sm">Klik "Tambah Jabatan" untuk memulai</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>

    <PositionFormDialog
        open={isFormOpen}
        onOpenChange={onFormOpenChange}
        mode={formMode}
        initialData={editingPosition}
        onSubmit={handleFormSubmit}
        loading={isActionLoading}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="shadow-2xl border-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">Konfirmasi Penghapusan</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-2 text-slate-600">
                <p>
                  Apakah Anda yakin ingin menghapus jabatan <strong className="text-slate-900">{positionToDelete?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
                </p>
                
                {employeesCount > 0 ? (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-3">
                    <p className="text-orange-800 text-sm font-medium">
                      ⚠️ Terdapat {employeesCount} karyawan yang menggunakan jabatan ini.
                    </p>
                    <div className="space-y-2">
                      <Label className="text-orange-900 font-semibold text-sm">Pilih Jabatan Pengganti *</Label>
                      <Select value={replacementPositionId} onValueChange={setReplacementPositionId}>
                        <SelectTrigger className="bg-white border-orange-200 focus:ring-orange-500 text-slate-900">
                          <SelectValue placeholder="Pilih Jabatan..." />
                        </SelectTrigger>
                        <SelectContent>
                          {positions
                            .filter(p => p.id !== positionToDelete?.id)
                            .map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-orange-700">Karyawan terkait akan dipindahkan ke jabatan baru sebelum jabatan ini dihapus.</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 pt-4">
            <AlertDialogCancel className="h-10 min-w-[120px] text-sm font-semibold">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={isActionLoading || (employeesCount > 0 && !replacementPositionId)}
              className="h-10 min-w-[120px] text-sm bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold shadow-lg shadow-destructive/20 transition-all"
            >
              {isActionLoading ? "Memproses..." : employeesCount > 0 ? "Hapus & Pindahkan" : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
