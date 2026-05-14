import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Building2, Plus, ArrowLeft, Network, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Tables } from "@/integrations/supabase/types";
import { supabaseFetchWithTimeout } from "@/utils/supabase-fetch";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Modular Components
import { UnitCard } from "@/components/units/UnitCard";
import { UnitFormDialog } from "@/components/units/UnitFormDialog";
import { UnitDetailDialog } from "@/components/units/UnitDetailDialog";
import { EmployeeDetailDialog } from "@/components/employees/EmployeeDetailDialog";
import { Employee } from "@/types/employee";
import { PositionTab } from "@/components/positions/PositionTab";

export default function Organization() {
  const { isAdminOrHr } = useAuth();
  const [units, setUnits] = useState<(Tables<"units"> & { employeeCount: number, leader?: Employee | null })[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("units");

  // Dialog States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingUnit, setEditingUnit] = useState<any>(null);
  
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [viewingUnit, setViewingUnit] = useState<any>(null);
  
  const [isEmployeeDetailOpen, setIsEmployeeDetailOpen] = useState(false);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState<any>(null);
  const [replacementUnitId, setReplacementUnitId] = useState<string>("");
  const [isPositionFormOpen, setIsPositionFormOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const empRes = await supabase.from("employees").select("*").order("name");
      if (empRes.error) {
        console.error("Error fetching employees:", empRes.error);
        if (empRes.error.code !== "PGRST116") throw empRes.error;
      }

      const unitRes = await supabase.from("units").select("*").order("name");
      if (unitRes.error) console.error("Error fetching units:", unitRes.error);
      
      const allUnits = unitRes.data || [];
      const rolesRes = await supabase.from("user_roles").select("*");
      
      if (empRes.data) {
        const rolesMap = rolesRes.data || [];
        setEmployees(empRes.data.map(emp => ({ 
          ...emp, 
          // Petakan unit secara manual untuk menghindari join circular
          units: allUnits.find(u => u.id === emp.unit_id) || null,
          role: rolesMap.find(r => r.user_id === emp.user_id)?.role || "employee" 
        })) as Employee[]);
      }

      const counts: Record<string, number> = {};
      (empRes.data || []).forEach((e) => { 
        if (e.unit_id) counts[e.unit_id] = (counts[e.unit_id] || 0) + 1; 
      });

      const processedUnits = (allUnits ?? []).map((u) => ({ 
        ...u, 
        employeeCount: counts[u.id] || 0,
        leader: (empRes.data || []).find(e => e.id === (u as any).leader_id) || null
      }));

      setUnits(processedUnits);
    } catch (err: any) {
      console.error("Units: Fetch error details:", {
        message: err.message,
        code: err.code,
        details: err.details,
        hint: err.hint
      });
      toast.error("Gagal memuat data unit: " + (err.message || "Timeout"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenForm = (mode: "create" | "edit", unit?: any) => {
    setFormMode(mode);
    setEditingUnit(unit || null);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data: any) => {
    try {
      setIsActionLoading(true);
      if (formMode === "create") {
        const { error } = await supabase.from("units").insert([data]);
        if (error) throw error;
        toast.success("Unit berhasil ditambahkan");
      } else {
        const { error } = await supabase.from("units").update(data).eq("id", editingUnit.id);
        if (error) throw error;
        toast.success("Data unit berhasil diperbarui");
        if (viewingUnit?.id === editingUnit.id) {
            setViewingUnit({...viewingUnit, ...data});
        }
      }
      setIsFormOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan data unit");
    } finally {
      setIsActionLoading(false);
    }
  };

  const confirmDelete = (unit: any) => {
    setUnitToDelete(unit);
    setReplacementUnitId("");
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!unitToDelete) return;

    try {
      setIsActionLoading(true);

      // Jika ada anggota, pindahkan dulu
      if (unitToDelete.employeeCount > 0) {
        if (!replacementUnitId) {
          toast.error("Pilih unit pengganti untuk memindahkan anggota");
          setIsActionLoading(false);
          return;
        }

        const { error: updateError } = await supabase
          .from("employees")
          .update({ unit_id: replacementUnitId })
          .eq("unit_id", unitToDelete.id);

        if (updateError) throw updateError;
        toast.success(`${unitToDelete.employeeCount} anggota berhasil dipindahkan ke unit baru.`);
      }

      const { error } = await supabase.from("units").delete().eq("id", unitToDelete.id);
      if (error) throw error;
      
      toast.success("Unit berhasil dihapus");
      setDeleteConfirmOpen(false);
      setIsDetailOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error("Gagal menghapus unit");
    } finally {
      setIsActionLoading(false);
    }
  };

  const openUnitDetail = (unit: any) => {
    setViewingUnit(unit);
    setIsDetailOpen(true);
  };

  const openEmployeeDetail = (emp: Employee) => {
    setViewingEmployee(emp);
    setIsEmployeeDetailOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Struktur Organisasi</h1>
          {isAdminOrHr && (
            <Button
              onClick={() => activeTab === "units" ? handleOpenForm("create") : setIsPositionFormOpen(true)}
              size="sm"
              className="gap-2 shadow-md shadow-primary/10 bg-primary hover:bg-primary/90 transition-all transform active:scale-95 font-medium"
              id="btn-tambah-org"
            >
              <Plus className="h-4 w-4" />
              {activeTab === "units" ? "Tambah Unit" : "Tambah Jabatan"}
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-2 mb-3 bg-muted/50 h-9 rounded-lg">
            <TabsTrigger value="units" className="text-xs">Unit Kerja</TabsTrigger>
            <TabsTrigger value="positions" className="text-xs">Master Jabatan</TabsTrigger>
          </TabsList>

          <TabsContent value="units" className="m-0 outline-none">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-40 rounded-xl bg-slate-100 animate-pulse" />
                ))
              ) : units.length > 0 ? (
                units.map((u) => (
                  <UnitCard
                    key={u.id}
                    unit={u}
                    employeeCount={u.employeeCount}
                    leaderName={u.leader?.name}
                    onClick={() => openUnitDetail(u)}
                  />
                ))
              ) : (
                <div className="col-span-full py-20 text-center border-2 border-dashed rounded-2xl border-slate-200">
                  <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">Belum ada unit yang terdaftar</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="positions" className="m-0 outline-none">
            <PositionTab isAdminOrHr={isAdminOrHr} onAdd={() => setIsPositionFormOpen(true)} isFormOpen={isPositionFormOpen} onFormOpenChange={setIsPositionFormOpen} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <UnitFormDialog 
        open={isFormOpen} 
        onOpenChange={setIsFormOpen} 
        mode={formMode} 
        initialData={editingUnit}
        unitMembers={employees.filter(e => e.unit_id === editingUnit?.id)}
        onSubmit={handleFormSubmit}
        loading={isActionLoading}
        onCancel={formMode === "edit" ? () => { setIsFormOpen(false); setIsDetailOpen(true); } : undefined}
      />

      <UnitDetailDialog 
        open={isDetailOpen} 
        onOpenChange={setIsDetailOpen}
        unit={viewingUnit}
        members={employees.filter(e => e.unit_id === viewingUnit?.id)}
        leader={viewingUnit?.leader}
        onViewEmployee={openEmployeeDetail}
        isAdminOrHr={isAdminOrHr}
        onEdit={() => { setIsDetailOpen(false); handleOpenForm("edit", viewingUnit); }}
        onDelete={() => confirmDelete(viewingUnit)}
      />

      <EmployeeDetailDialog 
        open={isEmployeeDetailOpen} 
        onOpenChange={setIsEmployeeDetailOpen}
        employee={viewingEmployee}
        isAdminOrHr={isAdminOrHr}
      />

      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        itemName={unitToDelete?.name}
        onConfirm={handleDelete}
        isLoading={isActionLoading}
        description={
          <div className="space-y-4">
            <p>
              Apakah Anda yakin ingin menghapus unit <strong>{unitToDelete?.name}</strong>?
              Tindakan ini tidak dapat dibatalkan.
            </p>
            {unitToDelete?.employeeCount > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
                  <AlertCircle className="h-4 w-4" />
                  Perhatian: {unitToDelete.employeeCount} Anggota Terdeteksi
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Ada {unitToDelete.employeeCount} anggota yang saat ini terdaftar di unit ini. 
                  Anda wajib memindahkan mereka ke unit lain sebelum menghapus unit ini.
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-amber-900">Pilih Unit Pengganti:</Label>
                  <Select value={replacementUnitId} onValueChange={setReplacementUnitId}>
                    <SelectTrigger className="h-9 bg-white border-amber-200 text-xs text-slate-900">
                      <SelectValue placeholder="Pilih unit baru..." />
                    </SelectTrigger>
                    <SelectContent>
                      {units
                        .filter(u => u.id !== unitToDelete?.id)
                        .map(u => (
                          <SelectItem key={u.id} value={u.id} className="text-xs">
                            {u.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        }
      />
    </DashboardLayout>
  );
}
