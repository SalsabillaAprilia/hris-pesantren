import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Search, Download, FileDown } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { supabaseFetchWithTimeout } from "@/utils/supabase-fetch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
import { Employee } from "@/types/employee";
import { EmployeeTable } from "@/components/employees/EmployeeTable";
import { EmployeeFormDialog } from "@/components/employees/EmployeeFormDialog";
import { EmployeeDetailDialog } from "@/components/employees/EmployeeDetailDialog";
import { EmployeeFilterDrawer } from "@/components/employees/EmployeeFilterDrawer";
import { ExportCsvConfigDialog } from "@/components/employees/ExportCsvConfigDialog";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function EmployeesPage() {
  const { isAdminOrHr, isSuperAdmin } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [units, setUnits] = useState<Tables<"units">[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");
  const [filters, setFilters] = useState({ unit_id: "all", position: "all", status: "all", tenure: "all", gender: "all", education: "all", religion: "all" });
  const INITIAL_FORM = { 
    name: "", email: "", unit_id: "", position: "", password: "", role: "employee", status: "active", 
    employee_id_number: "", gender: "Laki-laki", nationality: "WNI", birth_date: "", birth_place: "", 
    religion: "", last_education: "", address: "", join_date: new Date().toISOString().split('T')[0], 
    contract_end_date: "", marital_status: "Belum Menikah", identity_card_type: "KTP", 
    identity_card_number: "", whatsapp_number: "", address_domicile: "", education_level: "", 
    education_institution: "", education_major: "", attachment_url: "" 
  };

  const [form, setForm] = useState(INITIAL_FORM);
  const [csvConfig, setCsvConfig] = useState({
    name: true, email: true, whatsapp: true, employee_id: true, unit: true,
    position: true, status: true, join_date: true, gender: true, religion: true, 
    birth_date: true, address: true, education: true,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [empRes, unitRes, rolesRes] = await supabaseFetchWithTimeout(
        Promise.all([
          supabase.from("employees").select("*, units(name)").order("name"),
          supabase.from("units").select("*"),
          supabase.from("user_roles").select("*"),
        ])
      );
      if (empRes.data) {
        setEmployees(empRes.data.map(emp => ({ ...emp, role: rolesRes.data?.find(r => r.user_id === emp.user_id)?.role || "employee" })) as Employee[]);
      }
      if (unitRes.data) setUnits(unitRes.data);
    } catch (err) { toast.error("Gagal memuat data"); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleOpenForm = (mode: "create" | "edit", emp?: Employee) => {
    setDialogMode(mode);
    if (mode === "edit" && emp) {
      setEditingId(emp.id);
      setForm({ ...emp, password: "" } as any);
    } else {
      setEditingId(null);
      setForm(INITIAL_FORM);
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      
      // Separate non-employee table fields
      const { password, email, role, units, id, user_id, created_at, updated_at, ...updates } = form as any;
      
      if (dialogMode === "create") {
         console.log("Mencoba mendaftarkan user baru:", email);
         const { data: authData, error: authError } = await supabase.auth.signUp({ 
           email: email, 
           password: password, 
           options: { data: { name: updates.name } } 
         });
         
         if (authError) throw authError;
         if (authData.user) {
            console.log("User terdaftar, mengupdate profile...");
            const { error: profileError } = await supabase
              .from("employees")
              .update(updates)
              .eq("user_id", authData.user.id);
              
            if (profileError) throw profileError;
            
            const { error: roleError } = await (supabase as any)
              .from("user_roles")
              .insert({ 
                user_id: authData.user.id, 
                role: (role || "employee") as any 
              });
              
            if (roleError) throw roleError;
         }
      } else {
        console.log("Mengupdate data karyawan:", editingId);
        const { error } = await supabase
          .from("employees")
          .update(updates)
          .eq("id", editingId);
          
        if (error) throw error;
        
        if (isSuperAdmin) {
           const emp = employees.find(e => e.id === editingId);
           if (emp?.user_id) {
              const { error: roleError } = await (supabase as any)
                .from("user_roles")
                .upsert({ 
                  user_id: emp.user_id, 
                  role: (role || "employee") as any 
                }, { onConflict: "user_id" });
                
              if (roleError) throw roleError;
           }
        }
      }
      
      setDialogOpen(false);
      fetchData();
      toast.success("Berhasil disimpan");
    } catch (err: any) { 
      console.error("Submit Error:", err);
      toast.error(err.message || "Gagal menyimpan data"); 
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDelete = (emp: Employee) => {
    setDeletingEmployee(emp);
    setDeleteConfirmText("");
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingEmployee || deleteConfirmText !== "HAPUS") return;
    try {
      setIsDeleting(true);
      console.log("Mencoba menghapus karyawan:", deletingEmployee.id);
      
      const { error } = await (supabase as any).rpc("delete_employee_complete", { 
        employee_uuid: deletingEmployee.id 
      });
      
      if (error) {
        console.error("Error saat menghapus:", error);
        throw error;
      }
      
      setDeleteDialogOpen(false);
      setViewDialogOpen(false);
      fetchData();
      toast.success("Data berhasil dihapus");
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus data");
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = employees.filter(emp => {
    const s = search.toLowerCase();
    const matchesSearch = 
      (emp.name || "").toLowerCase().includes(s) || 
      (emp.employee_id_number || "").toLowerCase().includes(s);
    const matchesUnit = filters.unit_id === "all" || emp.unit_id === filters.unit_id;
    const matchesStatus = filters.status === "all" || emp.status === filters.status;
    return matchesSearch && matchesUnit && matchesStatus;
  });

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-4">
        <div className="flex items-start justify-between">
          <div><h1 className="text-2xl font-bold">Karyawan</h1></div>
          {isAdminOrHr && (
            <div className="flex gap-3 pt-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" className="gap-2 h-9 text-xs"><Download className="h-4 w-4" /> Export</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setCsvDialogOpen(true)} className="cursor-pointer"><FileDown className="h-4 w-4 mr-2" /> CSV</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={() => handleOpenForm("create")} className="h-9 text-xs"><Plus className="h-4 w-4 mr-2" /> Tambah</Button>
            </div>
          )}
        </div>
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Cari nama atau ID..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="pl-9 h-9 text-xs shadow-sm border-muted-foreground/20" 
            />
          </div>
          <EmployeeFilterDrawer filters={filters} setFilters={setFilters} units={units} hasActiveFilters={Object.values(filters).some(v => v !== "all")} onReset={() => setFilters({ unit_id: "all", position: "all", status: "all", tenure: "all", gender: "all", education: "all", religion: "all" })} />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 mb-3 bg-muted/50 h-9 rounded-lg">
            <TabsTrigger value="personal" className="text-xs">Pribadi</TabsTrigger>
            <TabsTrigger value="contact" className="text-xs">Kontak</TabsTrigger>
            <TabsTrigger value="employment" className="text-xs">Kepegawaian</TabsTrigger>
          </TabsList>
          <EmployeeTable employees={filtered} activeTab={activeTab} loading={loading} onViewDetail={(emp) => { setViewingEmployee(emp); setViewDialogOpen(true); }} />
        </Tabs>
      </div>
      <EmployeeFormDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        mode={dialogMode} 
        form={form} 
        setForm={setForm} 
        units={units} 
        isSuperAdmin={isSuperAdmin} 
        onSubmit={handleSubmit}
        isSaving={isSaving} 
      />
      <EmployeeDetailDialog open={viewDialogOpen} onOpenChange={setViewDialogOpen} employee={viewingEmployee} isAdminOrHr={isAdminOrHr} onEdit={(emp) => { setViewDialogOpen(false); handleOpenForm("edit", emp); }} onDelete={handleDelete} />
      <ExportCsvConfigDialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen} config={csvConfig} setConfig={setCsvConfig} onDownload={() => {}} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="shadow-2xl border-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">Konfirmasi Penghapusan</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-2">
              <p>
                Apakah Anda yakin ingin menghapus data <strong>{deletingEmployee?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="space-y-2 p-4 bg-destructive/5 rounded-lg border border-destructive/10">
                <p className="text-xs text-muted-foreground">Ketik <strong>HAPUS</strong> di bawah ini untuk melanjutkan:</p>
                <Input 
                  value={deleteConfirmText} 
                  onChange={(e) => setDeleteConfirmText(e.target.value)} 
                  placeholder="HAPUS"
                  className="h-9 text-sm border-destructive/20 focus-visible:ring-destructive"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-10 text-sm">Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleteConfirmText !== "HAPUS" || isDeleting}
              className="h-10 text-sm bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold shadow-lg shadow-destructive/20"
            >
              {isDeleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
