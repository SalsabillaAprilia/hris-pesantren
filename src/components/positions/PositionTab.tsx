import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Network, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useInstansiFilter } from "@/hooks/useInstansiFilter";
import { PositionFormDialog } from "./PositionFormDialog";
import { formatError } from "@/utils/error-handler";
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
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

let globalPositionsCache: any[] | null = null;

export function PositionTab({ isAdminOrHr, isSuperAdmin, onAdd, isFormOpen, onFormOpenChange, showArchived }: {
  isAdminOrHr: boolean;
  isSuperAdmin?: boolean;
  onAdd: () => void;
  isFormOpen: boolean;
  onFormOpenChange: (open: boolean) => void;
  showArchived: boolean;
}) {
  const [positions, setPositions] = useState<any[]>(globalPositionsCache || []);
  const [loading, setLoading] = useState(globalPositionsCache === null);
  const { effectiveInstansiId } = useInstansiFilter();

  const isFirstFetch = useRef(globalPositionsCache === null);
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);
  
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

  const fetchPositions = useCallback(async () => {
    if (isFirstFetch.current) setLoading(true);
    try {
      let posQuery = (supabase as any).from("positions").select("*").order("name");
      if (effectiveInstansiId) posQuery = posQuery.eq("instansi_id", effectiveInstansiId);
      
      let empQuery = (supabase as any).from("employees").select("position_id, status").not("position_id", "is", null);
      if (effectiveInstansiId) empQuery = empQuery.eq("instansi_id", effectiveInstansiId);

      const [posRes, empRes] = await Promise.all([ posQuery, empQuery ]);
      
      if (posRes.error) {
        console.error("Error fetching positions:", posRes.error);
        if (posRes.error.code !== "42P01") throw posRes.error;
      }

      if (isMounted.current) {
        const activeCounts: Record<string, number> = {};
        const transferableCounts: Record<string, number> = {};

        (empRes.data || []).forEach((emp: any) => {
          if (emp.status === 'active') {
            activeCounts[emp.position_id] = (activeCounts[emp.position_id] || 0) + 1;
          }
          if (emp.status !== 'inactive') {
            transferableCounts[emp.position_id] = (transferableCounts[emp.position_id] || 0) + 1;
          }
        });

        const formattedData = (posRes.data || []).map((pos: any) => ({
          ...pos,
          employee_count: activeCounts[pos.id] || 0,
          transferable_count: transferableCounts[pos.id] || 0
        }));

        setPositions(formattedData);
        globalPositionsCache = formattedData;
      }
    } catch (err: any) {
      console.error(err);
      if (isMounted.current && err.code !== "PGRST116") toast.error(formatError(err, "Gagal memuat master jabatan. Pastikan script SQL sudah dijalankan."));
    } finally {
      if (isMounted.current) {
        setLoading(false);
        isFirstFetch.current = false;
      }
    }
  }, [effectiveInstansiId]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

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
        const payload = { ...data };
        if (effectiveInstansiId) payload.instansi_id = effectiveInstansiId;
        const { error } = await (supabase as any).from("positions").insert([payload]);
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
      toast.error(formatError(err, "Gagal menyimpan jabatan"));
    } finally {
      setIsActionLoading(false);
    }
  };

  const confirmDelete = async (position: any) => {
    setPositionToDelete(position);
    setDeleteConfirmOpen(true);
    setReplacementPositionId("");
    setEmployeesCount(position.transferable_count || 0);
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

        // Pindahkan karyawan secara massal (hanya yang aktif/cuti)
        const { error: updateError } = await (supabase as any)
          .from("employees")
          .update({ position_id: replacementPositionId })
          .eq("position_id", positionToDelete.id)
          .neq("status", "inactive");
          
        if (updateError) throw updateError;
        toast.success(`${employeesCount} karyawan berhasil dipindahkan ke jabatan baru.`);
      }

      // Hapus jabatan
      const { error } = await (supabase as any).from("positions").update({ is_active: false }).eq("id", positionToDelete.id);
      if (error) throw error;
      
      toast.success("Jabatan berhasil diarsipkan");
      setDeleteConfirmOpen(false);
      fetchPositions();
    } catch (err: any) {
      toast.error(formatError(err, "Gagal mengarsipkan jabatan"));
    } finally {
      setIsActionLoading(false);
    }
  };

  const filteredPositions = positions.filter(pos => 
    pos.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
    (showArchived ? true : pos.is_active !== false)
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Search Bar */}
      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama jabatan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm shadow-sm border-primary/40"
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
                <TableHead className="font-semibold">Rincian Tugas</TableHead>
                <TableHead className="w-40 text-center font-semibold">Personel</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPositions.map((pos, idx) => (
                <TableRow
                  key={pos.id}
                  className="hover:bg-muted/50 transition-colors h-11 group border-b border-gray-200 text-sm"
                >
                  <TableCell className="text-center text-slate-500 py-1.5">{idx + 1}</TableCell>
                  <TableCell className="font-semibold text-slate-900 py-1.5 align-top">
                    {pos.name}
                    {pos.is_active === false && (
                      <span className="ml-2 text-[10px] font-semibold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded border border-orange-200 uppercase tracking-wider">Diarsipkan</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 align-top">
                    {pos.description ? (
                      <ul className="list-disc pl-4 space-y-1 text-slate-600 text-xs text-left max-w-xs break-words whitespace-normal">
                        {pos.description.split('\n').filter((p: string) => p.trim()).map((p: string, i: number) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-400 italic text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center py-1.5 align-top">
                    {pos.employee_count > 0 ? (
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                        {pos.employee_count} Karyawan
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-1.5 text-right">
                    {isAdminOrHr && pos.is_active !== false && (
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

      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={handleDelete}
        isLoading={isActionLoading}
        title="Konfirmasi Pengarsipan"
        description={
          <div className="space-y-4 pt-2 text-slate-600">
            <p>
              Apakah Anda yakin ingin mengarsipkan jabatan <strong className="text-slate-900">{positionToDelete?.name}</strong>? Jabatan yang diarsipkan tidak akan muncul saat pendaftaran karyawan baru.
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
                        .filter(p => p.id !== positionToDelete?.id && p.is_active !== false)
                        .map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-orange-700">Karyawan terkait akan dipindahkan ke jabatan baru. Mantan karyawan (nonaktif) akan tetap di jabatan ini demi riwayat data.</p>
                </div>
              </div>
            ) : null}
          </div>
        }
        confirmText={employeesCount > 0 ? "Arsipkan & Pindahkan" : "Arsipkan"}
        disableConfirm={employeesCount > 0 && !replacementPositionId}
      />
    </div>
  );
}
