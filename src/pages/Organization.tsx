import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Building2, Plus, ArrowLeft, Network, AlertCircle, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import type { Tables } from "@/integrations/supabase/types";
import { supabaseFetchWithTimeout } from "@/utils/supabase-fetch";
import { useAuth } from "@/hooks/useAuth";
import { useInstansiFilter } from "@/hooks/useInstansiFilter";
import { useTerminology } from "@/hooks/useTerminology";
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
import { formatError } from "@/utils/error-handler";

// Modular Components
import { UnitCard } from "@/components/units/UnitCard";
import { UnitFormDialog } from "@/components/units/UnitFormDialog";
import { UnitDetailDialog } from "@/components/units/UnitDetailDialog";
import { EmployeeDetailDialog } from "@/components/employees/EmployeeDetailDialog";
import { Employee } from "@/types/employee";
import { PositionTab } from "@/components/positions/PositionTab";

let globalOrgUnitsCache: any[] | null = null;
let globalOrgEmployeesCache: Employee[] | null = null;

export default function Organization() {
  const { isAdminOrHr, isSuperAdmin } = useAuth();
  const { effectiveInstansiId } = useInstansiFilter();
  const { term, termLower } = useTerminology();
  const [units, setUnits] = useState<(Tables<"units"> & { employeeCount: number, leader?: Employee | null })[]>(globalOrgUnitsCache || []);
  const [employees, setEmployees] = useState<Employee[]>(globalOrgEmployeesCache || []);
  const [loading, setLoading] = useState(globalOrgUnitsCache === null);

  const isFirstFetch = useRef(globalOrgUnitsCache === null);
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("units");
  const [showArchived, setShowArchived] = useState(false);

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

  const fetchData = useCallback(async () => {
    if (isFirstFetch.current) setLoading(true);
    try {
      
      let empQuery = supabase.from("employees").select("*").order("name");
      if (effectiveInstansiId) empQuery = (empQuery as any).eq("instansi_id", effectiveInstansiId);
      const empRes = await empQuery;
      
      if (empRes.error) {
        console.error("Error fetching employees:", empRes.error);
        if (empRes.error.code !== "PGRST116") throw empRes.error;
      }

      let unitQuery = supabase.from("units").select("*").order("name");
      if (effectiveInstansiId) unitQuery = (unitQuery as any).eq("instansi_id", effectiveInstansiId);
      const unitRes = await unitQuery;
      
      if (unitRes.error) console.error("Error fetching units:", unitRes.error);
      
      const allUnits = unitRes.data || [];
      
      let rolesQuery = supabase.from("user_roles").select("*");
      if (effectiveInstansiId) rolesQuery = (rolesQuery as any).eq("instansi_id", effectiveInstansiId);
      const rolesRes = await rolesQuery;
      
      if (empRes.data) {
        const rolesMap = rolesRes.data || [];
        setEmployees(empRes.data.map(emp => ({ 
          ...emp, 
          // Petakan unit secara manual untuk menghindari join circular
          units: allUnits.find(u => u.id === emp.unit_id) || null,
          role: rolesMap.find(r => r.user_id === emp.user_id)?.role || "employee" 
        })) as Employee[]);
      }

      const activeCounts: Record<string, number> = {};
      const transferableCounts: Record<string, number> = {};
      
      (empRes.data || []).forEach((e) => { 
        if (e.unit_id && e.status === 'active') activeCounts[e.unit_id] = (activeCounts[e.unit_id] || 0) + 1; 
        if (e.unit_id && e.status !== 'inactive') transferableCounts[e.unit_id] = (transferableCounts[e.unit_id] || 0) + 1;
      });

      const processedUnits = (allUnits ?? []).map((u) => ({ 
        ...u, 
        employeeCount: activeCounts[u.id] || 0,
        transferableCount: transferableCounts[u.id] || 0,
        leader: (empRes.data || []).find(e => e.id === (u as any).leader_id) || null
      }));

      if (isMounted.current) {
        setUnits(processedUnits);
        
        globalOrgUnitsCache = processedUnits;
        if (empRes.data) {
          const rolesMap = rolesRes.data || [];
          globalOrgEmployeesCache = empRes.data.map(emp => ({ 
            ...emp, 
            units: allUnits.find(u => u.id === emp.unit_id) || null,
            role: rolesMap.find(r => r.user_id === emp.user_id)?.role || "employee" 
          })) as Employee[];
        }
      }
    } catch (err: any) {
      console.error("Units: Fetch error details:", err);
      if (isMounted.current && err.code !== "PGRST116") toast.error(formatError(err, "Gagal memuat data unit"));
    } finally {
      if (isMounted.current) {
        setLoading(false);
        isFirstFetch.current = false;
      }
    }
  }, [effectiveInstansiId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenForm = (mode: "create" | "edit", unit?: any) => {
    setFormMode(mode);
    setEditingUnit(unit || null);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data: any) => {
    try {
      setIsActionLoading(true);
      if (formMode === "create") {
        // Sertakan instansi_id agar data tersimpan ke cabang yang benar, bukan null
        const payload = { ...data, instansi_id: effectiveInstansiId };
        const { error } = await supabase.from("units").insert([payload]);
        if (error) throw error;
        toast.success(`${term} berhasil ditambahkan`);
      } else {
        const { error } = await supabase.from("units").update(data).eq("id", editingUnit.id);
        if (error) throw error;

        // --- SINKRONISASI ROLE unit_leader ---
        const oldLeaderId = editingUnit.leader_id ?? null;
        const newLeaderId = data.leader_id ?? null;

        if (oldLeaderId !== newLeaderId) {
          // Downgrade kepala lama → employee
          if (oldLeaderId) {
            const oldLeaderEmp = employees.find(e => e.id === oldLeaderId);
            if (oldLeaderEmp?.user_id) {
              await (supabase as any).rpc('set_employee_unit_leader_role', { 
                target_user_id: oldLeaderEmp.user_id, 
                new_role: 'employee' 
              });
            }
          }
          // Upgrade kepala baru → unit_leader
          if (newLeaderId) {
            const newLeaderEmp = employees.find(e => e.id === newLeaderId);
            if (newLeaderEmp?.user_id) {
              await (supabase as any).rpc('set_employee_unit_leader_role', { 
                target_user_id: newLeaderEmp.user_id, 
                new_role: 'unit_leader' 
              });
            }
          }
        }
        // --- AKHIR SINKRONISASI ---

        toast.success(`Data ${termLower} berhasil diperbarui`);
        if (viewingUnit?.id === editingUnit.id) {
            setViewingUnit({...viewingUnit, ...data});
        }
      }
      setIsFormOpen(false);
      // Invalidasi cache halaman Karyawan agar role terbaru ikut terbarui
      (window as any).__hrisInvalidateEmployeesCache?.();
      fetchData();
    } catch (err: any) {
      toast.error(formatError(err, `Gagal menyimpan data ${termLower}`));
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

      // Jika ada anggota yang harus dipindah (aktif/cuti), pindahkan dulu
      if (unitToDelete.transferableCount > 0) {
        if (!replacementUnitId) {
          toast.error(`Pilih ${termLower} pengganti untuk memindahkan anggota`);
          setIsActionLoading(false);
          return;
        }

        const { error: updateError } = await supabase
          .from("employees")
          .update({ unit_id: replacementUnitId })
          .eq("unit_id", unitToDelete.id)
          .neq("status", "inactive");

        if (updateError) throw updateError;
        toast.success(`${unitToDelete.transferableCount} anggota berhasil dipindahkan ke ${termLower} baru.`);
      }

      // --- SINKRONISASI ROLE: Downgrade kepala unit yang dihapus ---
      if (unitToDelete.leader_id) {
        const leaderEmp = employees.find(e => e.id === unitToDelete.leader_id);
        if (leaderEmp?.user_id) {
          await (supabase as any).rpc('set_employee_unit_leader_role', { 
            target_user_id: leaderEmp.user_id, 
            new_role: 'employee' 
          });
        }
      }
      // --- AKHIR SINKRONISASI ---

      const { error } = await (supabase as any).from("units").update({ is_active: false }).eq("id", unitToDelete.id);
      if (error) throw error;
      
      toast.success(`${term} berhasil diarsipkan`);
      setDeleteConfirmOpen(false);
      setIsDetailOpen(false);
      // Invalidasi cache halaman Karyawan agar role terbaru ikut terbarui
      (window as any).__hrisInvalidateEmployeesCache?.();
      fetchData();
    } catch (err: any) {
      toast.error(formatError(err, `Gagal mengarsipkan ${termLower}`));
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

  const displayedUnits = showArchived ? units : units.filter((u: any) => u.is_active !== false);

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Struktur Organisasi</h1>
          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <Button
                variant={showArchived ? "default" : "outline"}
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
                className={`gap-2 mr-2 shadow-sm transition-all font-medium ${!showArchived ? 'bg-white/50 border-primary/20' : ''}`}
              >
                <Archive className={`h-4 w-4 ${!showArchived ? 'text-primary' : ''}`} />
                {showArchived ? 'Sembunyikan Arsip' : 'Tampilkan Arsip'}
              </Button>
            )}
            {isAdminOrHr && (
              <Button
                onClick={() => activeTab === "units" ? handleOpenForm("create") : setIsPositionFormOpen(true)}
                size="sm"
                className="gap-2 shadow-md shadow-primary/10 bg-primary hover:bg-primary/90 transition-all transform active:scale-95 font-medium"
                id="btn-tambah-org"
              >
                <Plus className="h-4 w-4" />
                {activeTab === "units" ? `Tambah ${term}` : "Tambah Jabatan"}
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-2 mb-3 bg-muted/50 h-9 rounded-lg">
            <TabsTrigger value="units" className="text-xs">{term}</TabsTrigger>
            <TabsTrigger value="positions" className="text-xs">Jabatan</TabsTrigger>
          </TabsList>

          <TabsContent value="units" className="m-0 outline-none">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-40 rounded-xl bg-slate-100 animate-pulse" />
                ))
              ) : displayedUnits.length > 0 ? (
                displayedUnits.map((u) => (
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
                  <p className="text-slate-500 font-medium">Belum ada {termLower} yang terdaftar</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="positions" className="m-0 outline-none">
            <PositionTab isAdminOrHr={isAdminOrHr} isSuperAdmin={isSuperAdmin} onAdd={() => setIsPositionFormOpen(true)} isFormOpen={isPositionFormOpen} onFormOpenChange={setIsPositionFormOpen} showArchived={showArchived} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <UnitFormDialog 
        open={isFormOpen} 
        onOpenChange={setIsFormOpen} 
        mode={formMode} 
        initialData={editingUnit}
        unitMembers={employees.filter(e => e.unit_id === editingUnit?.id && e.status === 'active')}
        onSubmit={handleFormSubmit}
        loading={isActionLoading}
        onCancel={formMode === "edit" ? () => { setIsFormOpen(false); setIsDetailOpen(true); } : undefined}
      />

      <UnitDetailDialog 
        open={isDetailOpen} 
        onOpenChange={setIsDetailOpen}
        unit={viewingUnit}
        members={employees.filter(e => e.unit_id === viewingUnit?.id && e.status === 'active')}
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
          <div className="space-y-4 pt-2 text-slate-600">
            <p>
              Apakah Anda yakin ingin mengarsipkan {termLower} <strong className="text-slate-900">{unitToDelete?.name}</strong>? {termLower} yang diarsipkan tidak akan muncul saat pendaftaran karyawan baru.
            </p>
            
            {unitToDelete?.transferableCount > 0 ? (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-3">
                <p className="text-orange-800 text-sm font-medium">
                  ⚠️ Terdapat {unitToDelete.transferableCount} anggota yang terdaftar di {termLower} ini.
                </p>
                <div className="space-y-2">
                  <Label className="text-orange-900 font-semibold text-sm">Pilih {term} Pengganti *</Label>
                  <Select value={replacementUnitId} onValueChange={setReplacementUnitId}>
                    <SelectTrigger className="bg-white border-orange-200 focus:ring-orange-500 text-slate-900">
                      <SelectValue placeholder={`Pilih ${term}...`} />
                    </SelectTrigger>
                    <SelectContent>
                      {units
                        .filter(u => u.id !== unitToDelete?.id && (u as any).is_active !== false)
                        .map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-orange-700">Anggota terkait akan dipindahkan ke {termLower} baru. Mantan karyawan (nonaktif) akan tetap di {termLower} ini demi riwayat data.</p>
                </div>
              </div>
            ) : null}
          </div>
        }
        confirmText={unitToDelete?.transferableCount > 0 ? "Arsipkan & Pindahkan" : "Arsipkan"}
        disableConfirm={unitToDelete?.transferableCount > 0 && !replacementUnitId}
      />
    </DashboardLayout>
  );
}
