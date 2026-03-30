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
  const [form, setForm] = useState({ 
    name: "", email: "", phone: "", unit_id: "", position: "", password: "", role: "employee", status: "active",
    employee_id_number: "", gender: "Laki-laki", nationality: "WNI", birth_date: "", birth_place: "",
    religion: "", last_education: "", address: "", join_date: new Date().toISOString().split('T')[0], contract_end_date: "",
    marital_status: "Belum Menikah", identity_card_type: "KTP", identity_card_number: "", whatsapp_number: "",
    address_domicile: "", education_level: "", education_institution: "", education_major: "", attachment_url: ""
  });
  const [csvConfig, setCsvConfig] = useState({
    name: true, email: true, phone: true, whatsapp: true, employee_id: true, unit: true,
    position: true, status: true, join_date: true, gender: true, religion: true, 
    birth_date: true, address: true, education: true,
  });

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
      setForm({ name: "", email: "", phone: "", unit_id: "", position: "", password: "", role: "employee", status: "active", employee_id_number: "", gender: "Laki-laki", nationality: "WNI", birth_date: "", birth_place: "", religion: "", last_education: "", address: "", join_date: new Date().toISOString().split('T')[0], contract_end_date: "", marital_status: "Belum Menikah", identity_card_type: "KTP", identity_card_number: "", whatsapp_number: "", address_domicile: "", education_level: "", education_institution: "", education_major: "", attachment_url: "" });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (dialogMode === "create") {
         const { data: authData, error: authError } = await supabase.auth.signUp({ email: form.email, password: form.password, options: { data: { name: form.name } } });
         if (authError) throw authError;
         if (authData.user) {
            const { password, email, role, ...updates } = form as any;
            await supabase.from("employees").update(updates).eq("user_id", authData.user.id);
            await supabase.from("user_roles").insert({ user_id: authData.user.id, role: (form.role || "employee") as any });
         }
      } else {
        const { password, email, role, ...updates } = form as any;
        await supabase.from("employees").update(updates).eq("id", editingId);
        if (isSuperAdmin) {
           const emp = employees.find(e => e.id === editingId);
           if (emp?.user_id) {
              await supabase.from("user_roles").delete().eq("user_id", emp.user_id);
              await supabase.from("user_roles").insert({ user_id: emp.user_id, role: (form.role || "employee") as any });
           }
        }
      }
      setDialogOpen(false);
      fetchData();
      toast.success("Berhasil disimpan");
    } catch (err: any) { toast.error(err.message); }
  };

  const filtered = employees.filter(emp => {
    const matchesSearch = emp.name?.toLowerCase().includes(search.toLowerCase()) || emp.employee_id_number?.toLowerCase().includes(search.toLowerCase());
    const matchesUnit = filters.unit_id === "all" || emp.unit_id === filters.unit_id;
    const matchesStatus = filters.status === "all" || emp.status === filters.status;
    return matchesSearch && matchesUnit && matchesStatus;
  });

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold">Karyawan</h1><p className="text-muted-foreground mt-1">Kelola direktori pesantren.</p></div>
          {isAdminOrHr && (
            <div className="flex gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" className="gap-2"><Download className="h-4 w-4" /> Export</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setCsvDialogOpen(true)} className="cursor-pointer"><FileDown className="h-4 w-4 mr-2" /> CSV</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={() => handleOpenForm("create")}><Plus className="h-4 w-4 mr-2" /> Tambah</Button>
            </div>
          )}
        </div>
        <div className="flex gap-3 items-center">
            <Input placeholder="Cari..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm h-11" />
            <EmployeeFilterDrawer filters={filters} setFilters={setFilters} units={units} hasActiveFilters={Object.values(filters).some(v => v !== "all")} onReset={() => setFilters({ unit_id: "all", position: "all", status: "all", tenure: "all", gender: "all", education: "all", religion: "all" })} />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 mb-6 bg-muted/50 h-12 rounded-xl">
            <TabsTrigger value="personal">Pribadi</TabsTrigger>
            <TabsTrigger value="contact">Kontak</TabsTrigger>
            <TabsTrigger value="employment">Kepegawaian</TabsTrigger>
          </TabsList>
          <EmployeeTable employees={filtered} activeTab={activeTab} loading={loading} onViewDetail={(emp) => { setViewingEmployee(emp); setViewDialogOpen(true); }} />
        </Tabs>
      </div>
      <EmployeeFormDialog open={dialogOpen} onOpenChange={setDialogOpen} mode={dialogMode} form={form} setForm={setForm} units={units} isSuperAdmin={isSuperAdmin} onSubmit={handleSubmit} />
      <EmployeeDetailDialog open={viewDialogOpen} onOpenChange={setViewDialogOpen} employee={viewingEmployee} isAdminOrHr={isAdminOrHr} onEdit={(emp) => { setViewDialogOpen(false); handleOpenForm("edit", emp); }} onDelete={() => {}} />
      <ExportCsvConfigDialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen} config={csvConfig} setConfig={setCsvConfig} onDownload={() => {}} />
    </DashboardLayout>
  );
}
