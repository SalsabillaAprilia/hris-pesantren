import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Building2, Plus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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

// Modular Components
import { UnitCard } from "@/components/units/UnitCard";
import { UnitFormDialog } from "@/components/units/UnitFormDialog";
import { UnitDetailDialog } from "@/components/units/UnitDetailDialog";
import { EmployeeDetailDialog } from "@/components/employees/EmployeeDetailDialog";
import { Employee } from "@/types/employee";

export default function Units() {
  const { isAdminOrHr } = useAuth();
  const [units, setUnits] = useState<(Tables<"units"> & { employeeCount: number, leader?: Employee | null })[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

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
    if (unit.employeeCount > 0) {
      toast.error("Unit tidak bisa dihapus karena masih memiliki anggota aktif.");
      return;
    }
    setUnitToDelete(unit);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    try {
      setIsActionLoading(true);
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
          <div>
            <h1 className="text-2xl font-bold">Unit</h1>
          </div>
          {isAdminOrHr && (
            <Button onClick={() => handleOpenForm("create")} size="sm" className="gap-2 shadow-md shadow-primary/10 bg-primary hover:bg-primary/90 transition-all transform active:scale-95 font-medium">
              <Plus className="h-4 w-4" /> Tambah
            </Button>
          )}
        </div>

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

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="shadow-2xl border-none p-0 overflow-hidden">
          <div className="p-6">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold">Hapus Unit?</AlertDialogTitle>
              <AlertDialogDescription className="pt-2 text-slate-600 leading-relaxed">
                Tindakan ini tidak dapat dibatalkan. Pastikan unit <strong className="text-slate-900">"{unitToDelete?.name}"</strong> memang sudah tidak diperlukan lagi.
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
              {isActionLoading ? "Menghapus..." : "Ya, Hapus Unit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
