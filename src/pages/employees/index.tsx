import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Search, Download, FileDown, FileText } from "lucide-react";
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
import { ExportConfigDialog, COLUMNS_MAP } from "@/components/employees/ExportConfigDialog";
import { uploadFile } from "@/utils/supabase-storage";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function EmployeesPage() {
  const { isAdminOrHr, isSuperAdmin } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [units, setUnits] = useState<Tables<"units">[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState("personal");
  const [filters, setFilters] = useState({ unit_id: "all", position: "all", status: "all", tenure: "all", gender: "all", education: "all", religion: "all" });
  const INITIAL_FORM = { 
    name: "", email: "", unit_id: "", position: "", password: "", role: "employee", status: "active", 
    employee_id_number: "", gender: "Laki-laki", nationality: "WNI", birth_date: "", birth_place: "", 
    religion: "", last_education: "", address: "", join_date: new Date().toISOString().split('T')[0], 
    contract_end_date: "", marital_status: "Belum Menikah", identity_card_type: "KTP", 
    identity_card_number: "", whatsapp_number: "", address_domicile: "", education_level: "", 
    education_institution: "", education_major: "", attachment_url: "", avatar_url: "",
    shift_id: "" as string | null,
    avatar_file: null as File | null
  };

  const [form, setForm] = useState(INITIAL_FORM);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportType, setExportType] = useState<"csv" | "pdf">("csv");
  const [exportScope, setExportScope] = useState<"filtered" | "all">("filtered");
  
  // Default config requested by user: Nama, ID, Unit, Status
  const [exportConfig, setExportConfig] = useState<Record<string, boolean>>({
    name: true, employee_id_number: true, unit: true, status: true
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch concurrently but handle each result safely
      const empRes = await supabase.from("employees").select("*").order("name");
      if (empRes.error) {
        console.error("Error fetching employees:", empRes.error);
        if (empRes.error.code !== "PGRST116") throw empRes.error;
      }

      const unitRes = await supabase.from("units").select("*");
      if (unitRes.error) console.error("Error fetching units:", unitRes.error);

      const shiftRes = await supabase.from("work_shifts").select("*").order("name");
      if (shiftRes.error) console.error("Error fetching shifts:", shiftRes.error);
      
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
      
      if (unitRes.data) setUnits(unitRes.data);
      if (shiftRes.data) setShifts(shiftRes.data);
    } catch (err: any) { 
      console.error("Employees: Fetch Data Error Details:", {
        message: err.message,
        status: err.status,
        code: err.code
      });
      toast.error("Gagal memuat data karyawan: " + (err.message || "Timeout"));
    } finally { 
      setLoading(false); 
    }
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
      
      // Upload avatar if a new file is selected
      let finalAvatarUrl = form.avatar_url;
      if (form.avatar_file) {
        try {
          finalAvatarUrl = await uploadFile(form.avatar_file);
        } catch (uploadErr) {
          console.error("Avatar upload failed:", uploadErr);
          toast.error("Gagal mengunggah foto profil, mencoba melanjutkan tanpa foto.");
        }
      }

      // Prepare the data updates by specifically selecting allowed columns
      // This prevents "Column not found" errors from Supabase
      const profileUpdates: any = {
        name: form.name,
        email: form.email,
        unit_id: form.unit_id || null,
        position: form.position || null,
        status: form.status,
        join_date: form.join_date || null,
        employee_id_number: form.employee_id_number || null,
        gender: form.gender || null,
        nationality: form.nationality || null,
        birth_date: form.birth_date || null,
        birth_place: form.birth_place || null,
        religion: form.religion || null,
        address: form.address || null,
        contract_end_date: form.contract_end_date || null,
        marital_status: form.marital_status || null,
        identity_card_type: form.identity_card_type || null,
        identity_card_number: form.identity_card_number || null,
        whatsapp_number: form.whatsapp_number || null,
        address_domicile: form.address_domicile || null,
        education_level: form.education_level || null,
        education_institution: form.education_institution || null,
        education_major: form.education_major || null,
        attachment_url: form.attachment_url || null,
        avatar_url: finalAvatarUrl || null,
        shift_id: form.shift_id || null,
      };

      if (dialogMode === "create") {
         console.log("Mencoba mendaftarkan user baru:", form.email);
         
         // Buat Supabase client sementara yang tidak menyimpan sesi, 
         // supaya sesi Admin saat ini tidak tertimpa login user baru
         const tempSupabase = createClient(
           import.meta.env.VITE_SUPABASE_URL,
           import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
           {
             auth: {
               persistSession: false,
               autoRefreshToken: false,
             }
           }
         );

         const { data: authData, error: authError } = await tempSupabase.auth.signUp({ 
           email: form.email, 
           password: form.password, 
           options: { data: { name: form.name } } 
         });
         
         if (authError) throw authError;
         if (authData.user) {
            console.log("User terdaftar, mengupdate profile...");
            const { error: profileError } = await supabase
              .from("employees")
              .update(profileUpdates)
              .eq("user_id", authData.user.id);
              
            if (profileError) throw profileError;
            
            const { data: checkExistingRole } = await (supabase as any)
              .from("user_roles")
              .select("id")
              .eq("user_id", authData.user.id)
              .maybeSingle();

            if (checkExistingRole) {
              const { error: roleUpdateError } = await (supabase as any)
                .from("user_roles")
                .update({ role: form.role || "employee" })
                .eq("id", checkExistingRole.id);
              if (roleUpdateError) throw roleUpdateError;
            } else {
              const { error: roleInsertError } = await (supabase as any)
                .from("user_roles")
                .insert({ 
                  user_id: authData.user.id, 
                  role: form.role || "employee"
                });
              if (roleInsertError) throw roleInsertError;
            }
         }
      } else {
        console.log("Mengupdate data karyawan:", editingId);
        // Step 1: Update Employee Profile (Critical)
        const { error: empError } = await supabase
          .from("employees")
          .update(profileUpdates)
          .eq("id", editingId);
          
        if (empError) {
          console.error("Supabase Update Error:", empError);
          throw new Error(`Gagal update profil: ${empError.message}`);
        }
        
        // Step 2: Update Role if user is Super Admin (Non-critical)
        if (isSuperAdmin) {
           const emp = employees.find(e => e.id === editingId);
           if (emp?.user_id) {
              try {
                // Gunakan update, jangan delete agar tidak kehilangan akses RLS sesaat
                const { data: existingRole, error: checkError } = await (supabase as any)
                  .from("user_roles")
                  .select("id")
                  .eq("user_id", emp.user_id)
                  .maybeSingle();

                let roleUpdateError = null;

                if (existingRole) {
                  const { error } = await (supabase as any)
                    .from("user_roles")
                    .update({ role: form.role || "employee" })
                    .eq("id", existingRole.id);
                  roleUpdateError = error;
                } else if (!checkError) {
                  const { error } = await (supabase as any)
                    .from("user_roles")
                    .insert({ 
                      user_id: emp.user_id, 
                      role: form.role || "employee"
                    });
                  roleUpdateError = error;
                }
                  
                if (roleUpdateError) {
                  console.warn("Gagal memperbarui role:", roleUpdateError.message);
                  toast.error("Profil terupdate, tapi gagal mengubah hak akses.");
                }
              } catch (subErr) {
                console.error("Sub-process error (role update):", subErr);
              }
           }
        }
      }
      
      // Cleanup UI and refresh data
      setDialogOpen(false);
      await fetchData();
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

  const handleDownloadExport = () => {
    const dataToExport = exportScope === "all" ? employees : filtered;
    
    if (dataToExport.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }

    const selectedCols = COLUMNS_MAP.filter(c => exportConfig[c.id]);
    
    if (selectedCols.length === 0) {
      toast.error("Pilih minimal 1 kolom untuk diekspor");
      return;
    }

    const getVal = (emp: Employee, colId: string): string => {
      switch (colId) {
        case 'unit': return emp.units?.name || "-";
        case 'status': return emp.status === 'active' ? 'Aktif' : emp.status === 'inactive' ? 'Nonaktif' : 'Cuti';
        case 'join_date': return emp.join_date ? new Date(emp.join_date).toLocaleDateString('id-ID') : "-";
        case 'contract_end_date': return emp.contract_end_date ? new Date(emp.contract_end_date).toLocaleDateString('id-ID') : "-";
        case 'birth_date': return emp.birth_date ? new Date(emp.birth_date).toLocaleDateString('id-ID') : "-";
        default: return (emp as any)[colId] ? String((emp as any)[colId]) : "-";
      }
    };

    if (exportType === "csv") {
      const headers = selectedCols.map(c => `"${c.label}"`).join(",");
      const rows = dataToExport.map(emp => {
        return selectedCols.map(c => {
          const val = getVal(emp, c.id).replace(/"/g, '""'); // escape quotes
          return `"${val}"`;
        }).join(",");
      });

      const csvContent = [headers, ...rows].join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }); // UTF8 BOM
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Data_Karyawan_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } else if (exportType === "pdf") {
      // Portrait orientation as requested
      const doc = new jsPDF("p", "pt", "a4");
      
      const head = [selectedCols.map(c => c.label)];
      const body = dataToExport.map(emp => selectedCols.map(c => getVal(emp, c.id)));

      doc.setFontSize(14);
      doc.text("Laporan Data Karyawan", 40, 35);
      
      const subtitle = exportScope === "all" ? "Seluruh Karyawan Terdaftar" : "Sesuai Filter Data Terkini";
      doc.setFontSize(10);
      doc.text(subtitle, 40, 50);

      autoTable(doc, {
        head,
        body,
        startY: 65,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      doc.save(`Data_Karyawan_${new Date().toISOString().split('T')[0]}.pdf`);
    }
    
    setExportDialogOpen(false);
    toast.success(`Berhasil mengunduh dokumen ${exportType.toUpperCase()}`);
  };

  const filtered = employees.filter(emp => {
    const s = search.toLowerCase();
    const matchesSearch = 
      (emp.name || "").toLowerCase().includes(s) || 
      (emp.employee_id_number || "").toLowerCase().includes(s);
    
    const matchesUnit = filters.unit_id === "all" || emp.unit_id === filters.unit_id;
    const matchesPosition = filters.position === "all" || 
      (emp.position || "").toLowerCase().includes(filters.position.toLowerCase());
    const matchesStatus = filters.status === "all" || emp.status === filters.status;
    const matchesGender = filters.gender === "all" || emp.gender === filters.gender;
    const matchesReligion = filters.religion === "all" || emp.religion === filters.religion;
    const matchesEducation = filters.education === "all" || (emp.education_level === filters.education);
    
    const matchesTenure = filters.tenure === "all" || (() => {
      if (!emp.join_date) return false;
      const joinDate = new Date(emp.join_date);
      const now = new Date();
      const diffYears = (now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      
      if (filters.tenure === "< 1") return diffYears < 1;
      if (filters.tenure === "1-3") return diffYears >= 1 && diffYears <= 3;
      if (filters.tenure === "3-5") return diffYears > 3 && diffYears <= 5;
      if (filters.tenure === "> 5") return diffYears > 5;
      return true;
    })();

    return (
      matchesSearch && 
      matchesUnit && 
      matchesPosition && 
      matchesStatus && 
      matchesGender && 
      matchesReligion && 
      matchesEducation && 
      matchesTenure
    );
  });

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold">Karyawan</h1></div>
          {isAdminOrHr && (
            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 bg-white/50 shadow-sm border-primary/20 transition-all font-medium">
                    <Download className="h-4 w-4 text-primary" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => { setExportType("csv"); setExportDialogOpen(true); }} className="cursor-pointer py-2.5 font-medium transition-colors">
                    <FileDown className="h-4 w-4 mr-2 text-green-600" /> Download CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setExportType("pdf"); setExportDialogOpen(true); }} className="cursor-pointer py-2.5 font-medium transition-colors">
                    <FileText className="h-4 w-4 mr-2 text-red-500" /> Download PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={() => handleOpenForm("create")} size="sm" className="gap-2 shadow-md shadow-primary/10 bg-primary hover:bg-primary/90 transition-all transform active:scale-95 font-medium">
                <Plus className="h-4 w-4" /> Tambah
              </Button>
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
              className="pl-9 h-9 text-sm shadow-sm border-muted-foreground/20" 
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
        shifts={shifts}
        isSuperAdmin={isSuperAdmin} 
        onSubmit={handleSubmit}
        isSaving={isSaving} 
      />
      <EmployeeDetailDialog open={viewDialogOpen} onOpenChange={setViewDialogOpen} employee={viewingEmployee} isAdminOrHr={isAdminOrHr} onEdit={(emp) => { setViewDialogOpen(false); handleOpenForm("edit", emp); }} onDelete={handleDelete} />
      
      <ExportConfigDialog 
        open={exportDialogOpen} 
        onOpenChange={setExportDialogOpen} 
        type={exportType}
        config={exportConfig} 
        setConfig={setExportConfig}
        exportScope={exportScope}
        setExportScope={setExportScope}
        hasActiveFilters={search !== "" || Object.values(filters).some(v => v !== "all")}
        onDownload={handleDownloadExport} 
      />

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
