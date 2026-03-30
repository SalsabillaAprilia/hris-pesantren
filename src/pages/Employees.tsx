import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Search, Edit, Trash, Eye, Download, User as UserIcon, Phone, Briefcase } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { supabaseFetchWithTimeout } from "@/utils/supabase-fetch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger,
  SheetFooter,
  SheetClose
} from "@/components/ui/sheet";
import { Filter, X, MoreVertical, FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Employee = Tables<"employees"> & { 
  units?: { name: string } | null; 
  role?: string;
  // Field tambahan dari SQL
  employee_id_number?: string;
  gender?: string;
  nationality?: string;
  birth_date?: string;
  birth_place?: string;
  religion?: string;
  last_education?: string;
  address?: string;
  contract_end_date?: string;
  // Field baru sesi ini
  marital_status?: string;
  identity_card_type?: string;
  identity_card_number?: string;
  whatsapp_number?: string;
  address_domicile?: string;
  education_level?: string;
  education_institution?: string;
  education_major?: string;
  attachment_url?: string;
};

export default function Employees() {
  const { isAdminOrHr, isSuperAdmin } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [units, setUnits] = useState<Tables<"units">[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState("personal");
  const [filters, setFilters] = useState({
    unit_id: "all",
    position: "all",
    status: "all",
    tenure: "all",
    gender: "all",
    education: "all",
    religion: "all"
  });
  const [form, setForm] = useState({ 
    name: "", email: "", phone: "", unit_id: "", position: "", password: "", role: "employee", status: "active",
    employee_id_number: "", gender: "Laki-laki", nationality: "WNI", birth_date: "", birth_place: "",
    religion: "", last_education: "", address: "", join_date: new Date().toISOString().split('T')[0], contract_end_date: "",
    marital_status: "Belum Menikah", identity_card_type: "KTP", identity_card_number: "", whatsapp_number: "",
    address_domicile: "", education_level: "", education_institution: "", education_major: "", attachment_url: ""
  });
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvConfig, setCsvConfig] = useState({
    name: true,
    email: true,
    phone: true,
    whatsapp: true,
    employee_id: true,
    unit: true,
    position: true,
    status: true,
    join_date: true,
    gender: true,
    religion: true,
    birth_date: true,
    address: true,
    education: true,
  });

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setForm({ 
        name: "", email: "", phone: "", unit_id: "", position: "", password: "", role: "employee", status: "active",
        employee_id_number: "", gender: "Laki-laki", nationality: "WNI", birth_date: "", birth_place: "",
        religion: "", last_education: "", address: "", join_date: new Date().toISOString().split('T')[0], contract_end_date: "",
        marital_status: "Belum Menikah", identity_card_type: "KTP", identity_card_number: "", whatsapp_number: "",
        address_domicile: "", education_level: "", education_institution: "", education_major: "", attachment_url: ""
      });
      setDialogMode("create");
      setEditingId(null);
    }
  };

  const calculateMasaKerja = (joinDate: string) => {
    if (!joinDate) return "—";
    const start = new Date(joinDate);
    const end = new Date();
    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    if (months < 0) {
      years--;
      months += 12;
    }
    return `${years} thn ${months} bln`;
  };

  const fetchData = async () => {
    try {
      const [empRes, unitRes, rolesRes] = await supabaseFetchWithTimeout(
        Promise.all([
          supabase.from("employees").select("*, units(name)").order("name"),
          supabase.from("units").select("*"),
          supabase.from("user_roles").select("*"),
        ])
      );
      
      if (empRes.error) throw empRes.error;
      if (unitRes.error) throw unitRes.error;
      if (rolesRes.error) throw rolesRes.error;
      
      if (empRes.data) {
        // Gabungkan dengan role (untuk mode edit)
        const emps = empRes.data.map(emp => {
          const userRole = rolesRes.data?.find(r => r.user_id === emp.user_id)?.role || "employee";
          return { ...emp, role: userRole };
        });
        setEmployees(emps as Employee[]);
      }
      if (unitRes.data) setUnits(unitRes.data);
    } catch (err) {
      console.error("Employees: Unexpected error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (dialogMode === "create") {
      if (!form.email || !form.name || !form.password) return;

      // Create auth user first via edge function or admin - for MVP we use signUp
      // In production, use an admin invite flow
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { name: form.name } },
      });

      if (authError) {
        toast.error("Gagal membuat akun: " + authError.message);
        return;
      }

      if (authData.user) {
        // Update employee record created by trigger
        const updates: any = {};
        if (form.phone) updates.phone = form.phone;
        if (form.unit_id) updates.unit_id = form.unit_id;
        if (form.position) updates.position = form.position;
        if (form.employee_id_number) updates.employee_id_number = form.employee_id_number;
        if (form.gender) updates.gender = form.gender;
        if (form.nationality) updates.nationality = form.nationality;
        if (form.birth_date) updates.birth_date = form.birth_date;
        if (form.birth_place) updates.birth_place = form.birth_place;
        if (form.religion) updates.religion = form.religion;
        if (form.last_education) updates.last_education = form.last_education;
        if (form.address) updates.address = form.address;
        if (form.join_date) updates.join_date = form.join_date;
        if (form.contract_end_date) updates.contract_end_date = form.contract_end_date;
        if (form.marital_status) updates.marital_status = form.marital_status;
        if (form.identity_card_type) updates.identity_card_type = form.identity_card_type;
        if (form.identity_card_number) updates.identity_card_number = form.identity_card_number;
        if (form.whatsapp_number) updates.whatsapp_number = form.whatsapp_number;
        if (form.address_domicile) updates.address_domicile = form.address_domicile;
        if (form.education_level) updates.education_level = form.education_level;
        if (form.education_institution) updates.education_institution = form.education_institution;
        if (form.education_major) updates.education_major = form.education_major;
        if (form.attachment_url) updates.attachment_url = form.attachment_url;

        if (Object.keys(updates).length > 0) {
          await supabase.from("employees").update(updates).eq("user_id", authData.user.id);
        }

        // Set role
        if (form.role && form.role !== "employee") { // default db mungkin employee, kita insert explisit jika bukan atau untuk keamanan
           await supabase.from("user_roles").insert({ user_id: authData.user.id, role: form.role as any });
        } else {
           // Insert default employee supaya recordnya ada secara eksplisit
           await supabase.from("user_roles").insert({ user_id: authData.user.id, role: "employee" });
        }
      }

      toast.success("Karyawan berhasil ditambahkan");
    } else {
      if (!editingId) return;
      
      const updates: any = {};
      if (form.name) updates.name = form.name;
      if (form.phone) updates.phone = form.phone;
      if (form.unit_id) updates.unit_id = form.unit_id;
      if (form.position) updates.position = form.position;
      if (form.status) updates.status = form.status;
      if (form.employee_id_number) updates.employee_id_number = form.employee_id_number;
      if (form.gender) updates.gender = form.gender;
      if (form.nationality) updates.nationality = form.nationality;
      if (form.birth_date) updates.birth_date = form.birth_date;
      if (form.birth_place) updates.birth_place = form.birth_place;
      if (form.religion) updates.religion = form.religion;
      if (form.last_education) updates.last_education = form.last_education;
      if (form.address) updates.address = form.address;
      if (form.join_date) updates.join_date = form.join_date;
      if (form.contract_end_date) updates.contract_end_date = form.contract_end_date;
      if (form.marital_status) updates.marital_status = form.marital_status;
      if (form.identity_card_type) updates.identity_card_type = form.identity_card_type;
      if (form.identity_card_number) updates.identity_card_number = form.identity_card_number;
      if (form.whatsapp_number) updates.whatsapp_number = form.whatsapp_number;
      if (form.address_domicile) updates.address_domicile = form.address_domicile;
      if (form.education_level) updates.education_level = form.education_level;
      if (form.education_institution) updates.education_institution = form.education_institution;
      if (form.education_major) updates.education_major = form.education_major;
      if (form.attachment_url) updates.attachment_url = form.attachment_url;
      
      const { error } = await supabase.from("employees").update(updates).eq("id", editingId);
      if (error) {
        toast.error("Gagal memperbarui karyawan: " + error.message);
        return;
      }
      
      
      // Update role (ONLY for Super Admin)
      if (isSuperAdmin) {
        const empData = employees.find(e => e.id === editingId);
        if (empData?.user_id) {
           // Hapus role lama dulu lalu insert baru (cara paling gampang karena role bisa lebih dari satu sebenarnya, tapi di UI ini kita limit 1 role utama per dropdown)
           await supabase.from("user_roles").delete().eq("user_id", empData.user_id);
           await supabase.from("user_roles").insert({ user_id: empData.user_id, role: (form.role || "employee") as any });
        }
      }

      toast.success("Karyawan berhasil diperbarui");
    }

    setDialogOpen(false);
    setForm({ 
      name: "", email: "", phone: "", unit_id: "", position: "", password: "", role: "employee", status: "active",
      employee_id_number: "", gender: "Laki-laki", nationality: "WNI", birth_date: "", birth_place: "",
      religion: "", last_education: "", address: "", join_date: new Date().toISOString().split('T')[0], contract_end_date: "",
      marital_status: "Belum Menikah", identity_card_type: "KTP", identity_card_number: "", whatsapp_number: "",
      address_domicile: "", education_level: "", education_institution: "", education_major: "", attachment_url: ""
    });
    setDialogMode("create");
    setEditingId(null);
    fetchData();
  };

  const executeDelete = async () => {
    if (!deletingEmployee) return;
    if (deleteConfirmation !== "HAPUS") {
       toast.error("Ketik HAPUS untuk mengonfirmasi");
       return;
    }
    
    setLoading(true);
    const { error } = await supabase.from("employees").delete().eq("id", deletingEmployee.id);
    if (error) {
      toast.error("Gagal menghapus karyawan: " + error.message);
      setLoading(false);
    } else {
      toast.success("Karyawan berhasil dihapus");
      setDeleteDialogOpen(false);
      setDeletingEmployee(null);
      setDeleteConfirmation("");
      fetchData();
    }
  };

  const getYearsExperience = (dateString: string | null) => {
    if (!dateString) return 0;
    const start = new Date(dateString);
    const end = new Date();
    let years = end.getFullYear() - start.getFullYear();
    const m = end.getMonth() - start.getMonth();
    if (m < 0 || (m === 0 && end.getDate() < start.getDate())) {
      years--;
    }
    return years;
  };

  const filtered = employees.filter(emp => {
    const matchesSearch = 
      emp.name?.toLowerCase().includes(search.toLowerCase()) ||
      emp.email?.toLowerCase().includes(search.toLowerCase()) ||
      emp.employee_id_number?.toLowerCase().includes(search.toLowerCase());

    const matchesUnit = filters.unit_id === "all" || emp.unit_id === filters.unit_id;
    const matchesPosition = filters.position === "all" || emp.position === filters.position;
    const matchesStatus = filters.status === "all" || emp.status === filters.status;
    const matchesGender = filters.gender === "all" || emp.gender === filters.gender;
    const matchesReligon = filters.religion === "all" || emp.religion === filters.religion;
    const matchesEducation = filters.education === "all" || emp.education_level === filters.education;
    
    // Masa Kerja Logic
    let matchesTenure = true;
    if (filters.tenure !== "all") {
      const years = getYearsExperience(emp.join_date);
      if (filters.tenure === "< 1") matchesTenure = years < 1;
      else if (filters.tenure === "1-3") matchesTenure = years >= 1 && years <= 3;
      else if (filters.tenure === "3-5") matchesTenure = years > 3 && years <= 5;
      else if (filters.tenure === "> 5") matchesTenure = years > 5;
    }

    return matchesSearch && matchesUnit && matchesPosition && matchesStatus && matchesGender && matchesReligon && matchesEducation && matchesTenure;
  });

  const hasActiveFilters = Object.values(filters).some(v => v !== "all");

  const resetFilters = () => {
    setFilters({
      unit_id: "all",
      position: "all",
      status: "all",
      tenure: "all",
      gender: "all",
      education: "all",
      religion: "all"
    });
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      active: "default",
      inactive: "destructive",
      on_leave: "secondary",
    };
    const labels: Record<string, string> = { active: "Aktif", inactive: "Nonaktif", on_leave: "Cuti" };
    return <Badge variant={variants[status] ?? "secondary"}>{labels[status] ?? status}</Badge>;
  };

  const exportToCsv = () => {
    if (employees.length === 0) {
      toast.error("Tidak ada data karyawan untuk diexport");
      return;
    }

    const columns = [
      { id: "name", label: "Nama", enabled: csvConfig.name },
      { id: "email", label: "Email", enabled: csvConfig.email },
      { id: "phone", label: "Telepon", enabled: csvConfig.phone },
      { id: "whatsapp", label: "WhatsApp", enabled: csvConfig.whatsapp },
      { id: "employee_id", label: "ID Karyawan", enabled: csvConfig.employee_id },
      { id: "unit", label: "Unit", enabled: csvConfig.unit },
      { id: "position", label: "Jabatan", enabled: csvConfig.position },
      { id: "status", label: "Status", enabled: csvConfig.status },
      { id: "join_date", label: "Tanggal Bergabung", enabled: csvConfig.join_date },
      { id: "gender", label: "Jenis Kelamin", enabled: csvConfig.gender },
      { id: "religion", label: "Agama", enabled: csvConfig.religion },
      { id: "birth_date", label: "Tanggal Lahir", enabled: csvConfig.birth_date },
      { id: "address", label: "Alamat", enabled: csvConfig.address },
      { id: "education", label: "Pendidikan", enabled: csvConfig.education },
    ];

    const activeHeaders = columns.filter(c => c.enabled).map(c => c.label);
    if (activeHeaders.length === 0) {
      toast.error("Pilih minimal satu kolom untuk diekspor");
      return;
    }

    const csvRows = employees.map(emp => {
      const row: string[] = [];
      const escape = (str: any) => `"${(str || "-").toString().replace(/"/g, '""')}"`;
      
      if (csvConfig.name) row.push(escape(emp.name));
      if (csvConfig.email) row.push(escape(emp.email));
      if (csvConfig.phone) row.push(escape(emp.phone));
      if (csvConfig.whatsapp) row.push(escape(emp.whatsapp_number || emp.phone));
      if (csvConfig.employee_id) row.push(escape(emp.employee_id_number));
      if (csvConfig.unit) row.push(escape(emp.units?.name));
      if (csvConfig.position) row.push(escape(emp.position));
      if (csvConfig.status) row.push(escape(emp.status === "active" ? "Aktif" : emp.status === "inactive" ? "Nonaktif" : "Cuti"));
      if (csvConfig.join_date) row.push(escape(emp.join_date ? new Date(emp.join_date).toLocaleDateString("id-ID") : ""));
      if (csvConfig.gender) row.push(escape(emp.gender));
      if (csvConfig.religion) row.push(escape(emp.religion));
      if (csvConfig.birth_date) row.push(escape(emp.birth_date ? new Date(emp.birth_date).toLocaleDateString("id-ID") : ""));
      if (csvConfig.address) row.push(escape(emp.address));
      if (csvConfig.education) row.push(escape(emp.last_education));
      
      return row.join(",");
    });

    const csvContent = [activeHeaders.join(",")].concat(csvRows).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Data_Karyawan_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("Berhasil mengunduh CSV");
    setCsvDialogOpen(false); // Tutup dialog setelah download
  };

  const exportToPdf = () => {
    if (employees.length === 0) {
      toast.error("Tidak ada data karyawan untuk diexport");
      return;
    }

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    // Judul Header
    doc.setFontSize(18);
    const title = "DAFTAR DATA KARYAWAN PESANTREN";
    doc.text(title, 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Tanggal Cetak: ${new Date().toLocaleString("id-ID")}`, 14, 27);
    doc.text(`Total Karyawan: ${employees.length}`, 14, 32);

    const tableColumn = ["No", "Nama", "ID Karyawan", "Email", "Unit", "Jabatan", "Status", "Tgl Gabung"];
    const tableRows = employees.map((emp, index) => [
      index + 1,
      emp.name,
      emp.employee_id_number || "-",
      emp.email,
      emp.units?.name || "-",
      emp.position || "-",
      emp.status === "active" ? "Aktif" : emp.status === "inactive" ? "Nonaktif" : "Cuti",
      emp.join_date ? new Date(emp.join_date).toLocaleDateString("id-ID") : "-"
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: "grid",
      headStyles: { 
        fillColor: [59, 130, 246], // Blue primary (sesuaikan dengan warna aplikasi)
        textColor: 255, 
        fontSize: 10,
        halign: "center"
      },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 }, // No
        2: { fontStyle: "italic", cellWidth: 25 }, // ID
        7: { cellWidth: 25 }, // Gabung
      },
      margin: { top: 40 },
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Halaman ${i} dari ${pageCount}`, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10);
    }

    doc.save(`Laporan_Karyawan_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("Berhasil mengunduh PDF");
  };

  return (
    <DashboardLayout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Karyawan</h1>
          <p className="page-description">Kelola data karyawan pesantren</p>
        </div>
        {isAdminOrHr && (
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" /> Export Data
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setCsvDialogOpen(true)} className="cursor-pointer">
                  <FileDown className="h-4 w-4 mr-2" /> Download CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPdf} className="cursor-pointer">
                  <FileDown className="h-4 w-4 mr-2" /> Download PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
              <DialogTrigger asChild>
                <Button onClick={() => setDialogMode("create")}><Plus className="h-4 w-4 mr-2" />Tambah Karyawan</Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>{dialogMode === "create" ? "Tambah Karyawan Baru" : "Edit Data Karyawan"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-hidden">
                <div className="overflow-y-auto px-2 py-2 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* PRIBADI */}
                      <div className="md:col-span-2 text-sm font-semibold border-b pb-1 text-primary">Informasi Pribadi</div>
                      <div className="space-y-2">
                        <Label>ID Karyawan</Label>
                        <Input value={form.employee_id_number} onChange={(e) => setForm({ ...form, employee_id_number: e.target.value })} placeholder="KARY-001" />
                      </div>
                      <div className="space-y-2">
                        <Label>Nama Lengkap</Label>
                        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Tempat Lahir</Label>
                        <Input value={form.birth_place} onChange={(e) => setForm({ ...form, birth_place: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Tanggal Lahir</Label>
                        <Input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Jenis Kelamin</Label>
                        <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                            <SelectItem value="Perempuan">Perempuan</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Status Perkawinan</Label>
                        <Select value={form.marital_status} onValueChange={(v) => setForm({ ...form, marital_status: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Belum Menikah">Belum Menikah</SelectItem>
                            <SelectItem value="Menikah">Menikah</SelectItem>
                            <SelectItem value="Cerai Hidup">Cerai Hidup</SelectItem>
                            <SelectItem value="Cerai Mati">Cerai Mati</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Agama</Label>
                        <Select value={form.religion} onValueChange={(v) => setForm({ ...form, religion: v })}>
                          <SelectTrigger><SelectValue placeholder="Pilih agama" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Islam">Islam</SelectItem>
                            <SelectItem value="Kristen">Kristen</SelectItem>
                            <SelectItem value="Katolik">Katolik</SelectItem>
                            <SelectItem value="Hindu">Hindu</SelectItem>
                            <SelectItem value="Buddha">Buddha</SelectItem>
                            <SelectItem value="Khonghucu">Khonghucu</SelectItem>
                            <SelectItem value="Lainnya">Lainnya</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Kewarganegaraan</Label>
                        <Select value={form.nationality} onValueChange={(v) => setForm({ ...form, nationality: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="WNI">WNI</SelectItem>
                            <SelectItem value="WNA">WNA</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* KONTAK */}
                      <div className="md:col-span-2 text-sm font-semibold border-b pb-1 pt-2 text-primary">Informasi Kontak</div>
                      <div className="space-y-2">
                        <Label>Tipe Kartu Identitas</Label>
                        <Select value={form.identity_card_type} onValueChange={(v) => setForm({ ...form, identity_card_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="KTP">KTP</SelectItem>
                            <SelectItem value="SIM">SIM</SelectItem>
                            <SelectItem value="Passport">Passport</SelectItem>
                            <SelectItem value="KITAS">KITAS</SelectItem>
                            <SelectItem value="Lainnya">Lainnya</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>ID Kartu Identitas</Label>
                        <Input value={form.identity_card_number} onChange={(e) => setForm({ ...form, identity_card_number: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required disabled={dialogMode === "edit"} />
                      </div>
                      <div className="space-y-2">
                        <Label>Nomor WhatsApp</Label>
                        <Input value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} placeholder="0812..." />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <Label>Alamat (Sesuai Kartu Identitas)</Label>
                        <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <Label>Alamat Domisili</Label>
                        <Textarea value={form.address_domicile} onChange={(e) => setForm({ ...form, address_domicile: e.target.value })} />
                      </div>

                      {/* PENDIDIKAN TERAKHIR */}
                      <div className="md:col-span-2 text-sm font-semibold border-b pb-1 pt-2 text-primary">Pendidikan Terakhir</div>
                      <div className="space-y-2">
                        <Label>Jenjang Akademik</Label>
                        <Select value={form.education_level} onValueChange={(v) => setForm({ ...form, education_level: v })}>
                          <SelectTrigger><SelectValue placeholder="Pilih jenjang" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SMA/SMK">SMA/SMK</SelectItem>
                            <SelectItem value="D1">D1</SelectItem>
                            <SelectItem value="D2">D2</SelectItem>
                            <SelectItem value="D3">D3</SelectItem>
                            <SelectItem value="S1">S1</SelectItem>
                            <SelectItem value="S2">S2</SelectItem>
                            <SelectItem value="S3">S3</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Nama Lembaga Pendidikan</Label>
                        <Input value={form.education_institution} onChange={(e) => setForm({ ...form, education_institution: e.target.value })} />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <Label>Program Studi</Label>
                        <Input value={form.education_major} onChange={(e) => setForm({ ...form, education_major: e.target.value })} />
                      </div>

                      {/* KEPEGAWAIAN */}
                      <div className="md:col-span-2 text-sm font-semibold border-b pb-1 pt-2 text-primary">Kepegawaian</div>
                      <div className="space-y-2">
                        <Label>Unit Kerja</Label>
                        <Select value={form.unit_id} onValueChange={(v) => setForm({ ...form, unit_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Pilih unit" /></SelectTrigger>
                          <SelectContent>
                            {units.map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Jabatan</Label>
                        <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Tanggal Bergabung</Label>
                        <Input type="date" value={form.join_date} onChange={(e) => setForm({ ...form, join_date: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Akhir Kontrak / Kerja</Label>
                        <Input type="date" value={form.contract_end_date} onChange={(e) => setForm({ ...form, contract_end_date: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Status Karyawan</Label>
                        <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Aktif</SelectItem>
                            <SelectItem value="inactive">Nonaktif</SelectItem>
                            <SelectItem value="on_leave">Cuti</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Link Lampiran (PDF/Image)</Label>
                        <Input value={form.attachment_url} onChange={(e) => setForm({ ...form, attachment_url: e.target.value })} placeholder="https://..." />
                      </div>
                      
                      {isSuperAdmin && (
                        <div className="space-y-2">
                          <Label>Role Sistem</Label>
                          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                            <SelectTrigger><SelectValue placeholder="Pilih Role" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="employee">Karyawan</SelectItem>
                              <SelectItem value="unit_leader">Kepala Unit</SelectItem>
                              <SelectItem value="hr">HR / Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {dialogMode === "create" && (
                        <div className="space-y-2">
                          <Label>Password Akun Sistem</Label>
                          <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
                        </div>
                      )}
                    </div>
                </div>
                <div className="pt-2 border-t mt-auto">
                  <Button type="submit" className="w-full">Simpan</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari karyawan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-2 shadow-sm">
              <Filter className="h-4 w-4" />
              Filter
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 px-1.5 h-5 min-w-5 flex items-center justify-center bg-primary text-primary-foreground">
                  {Object.values(filters).filter(v => v !== "all").length}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[350px] sm:w-[450px] flex flex-col p-0">
            <SheetHeader className="border-b p-6">
              <SheetTitle className="text-xl font-bold">Filter Karyawan</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-6 py-2">
              <div className="grid gap-6 py-4 pb-20">
                {/* Kategori: Struktur & Jabatan */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                    <Briefcase className="h-4 w-4" />
                    <span>Struktur & Jabatan</span>
                  </div>
                  <div className="grid gap-4 pl-6 border-l-2 border-muted py-1">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground tracking-wider">Unit Kerja</Label>
                      <Select value={filters.unit_id} onValueChange={(v) => setFilters({ ...filters, unit_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Semua Unit" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Unit</SelectItem>
                          {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground tracking-wider">Jabatan</Label>
                      <Select value={filters.position} onValueChange={(v) => setFilters({ ...filters, position: v })}>
                        <SelectTrigger><SelectValue placeholder="Semua Jabatan" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Jabatan</SelectItem>
                          <SelectItem value="Guru">Guru</SelectItem>
                          <SelectItem value="Staf">Staf</SelectItem>
                          <SelectItem value="Pengasuh">Pengasuh</SelectItem>
                          <SelectItem value="Administrasi">Administrasi</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground tracking-wider">Status Karyawan</Label>
                      <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                        <SelectTrigger><SelectValue placeholder="Semua Status" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Status</SelectItem>
                          <SelectItem value="active">Aktif</SelectItem>
                          <SelectItem value="inactive">Nonaktif</SelectItem>
                          <SelectItem value="on_leave">Cuti</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground tracking-wider">Masa Kerja</Label>
                      <Select value={filters.tenure} onValueChange={(v) => setFilters({ ...filters, tenure: v })}>
                        <SelectTrigger><SelectValue placeholder="Semua Masa" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Masa Kerja</SelectItem>
                          <SelectItem value="< 1">Di bawah 1 Tahun</SelectItem>
                          <SelectItem value="1-3">1 - 3 Tahun</SelectItem>
                          <SelectItem value="3-5">3 - 5 Tahun</SelectItem>
                          <SelectItem value="> 5">Di atas 5 Tahun</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Kategori: Informasi Pribadi */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                    <UserIcon className="h-4 w-4" />
                    <span>Informasi Pribadi</span>
                  </div>
                  <div className="grid gap-4 pl-6 border-l-2 border-muted py-1">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground tracking-wider">Jenis Kelamin</Label>
                      <Select value={filters.gender} onValueChange={(v) => setFilters({ ...filters, gender: v })}>
                        <SelectTrigger><SelectValue placeholder="Semua Gender" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua</SelectItem>
                          <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                          <SelectItem value="Perempuan">Perempuan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground tracking-wider">Pendidikan Terakhir</Label>
                      <Select value={filters.education} onValueChange={(v) => setFilters({ ...filters, education: v })}>
                        <SelectTrigger><SelectValue placeholder="Semua Jenjang" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua</SelectItem>
                          <SelectItem value="SMA">SMA/SMK</SelectItem>
                          <SelectItem value="D3">D3</SelectItem>
                          <SelectItem value="S1">S1</SelectItem>
                          <SelectItem value="S2">S2</SelectItem>
                          <SelectItem value="S3">S3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground tracking-wider">Agama</Label>
                      <Select value={filters.religion} onValueChange={(v) => setFilters({ ...filters, religion: v })}>
                        <SelectTrigger><SelectValue placeholder="Semua Agama" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua</SelectItem>
                          <SelectItem value="Islam">Islam</SelectItem>
                          <SelectItem value="Kristen">Kristen</SelectItem>
                          <SelectItem value="Katolik">Katolik</SelectItem>
                          <SelectItem value="Hindu">Hindu</SelectItem>
                          <SelectItem value="Buddha">Buddha</SelectItem>
                          <SelectItem value="Khonghucu">Khonghucu</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <SheetFooter className="p-6 bg-muted/30 border-t mt-auto">
              <div className="flex gap-2 w-full">
                <Button variant="outline" className="flex-1" onClick={resetFilters} disabled={!hasActiveFilters}>
                  Reset
                </Button>
                <SheetClose asChild>
                  <Button className="flex-[2]">Tampilkan Hasil</Button>
                </SheetClose>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {hasActiveFilters && (
          <Button variant="ghost" onClick={resetFilters} className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 h-9">
            <X className="h-4 w-4" />
            Hapus Filter
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="personal" className="gap-2">
            <UserIcon className="h-4 w-4" /> Informasi Pribadi
          </TabsTrigger>
          <TabsTrigger value="contact" className="gap-2">
            <Phone className="h-4 w-4" /> Kontak
          </TabsTrigger>
          <TabsTrigger value="employment" className="gap-2">
            <Briefcase className="h-4 w-4" /> Kepegawaian
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 bg-card rounded-xl border overflow-x-auto">
          <Table className="min-w-[1200px] border-collapse">
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="sticky top-0 left-0 z-30 bg-muted border-r px-4 py-2 w-[250px] min-w-[250px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Nama</TableHead>
                {activeTab === "personal" && (
                  <>
                    <TableHead className="sticky top-0 z-20 bg-muted border-r px-4 py-2 min-w-[150px]">ID Karyawan</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted border-r px-4 py-2 min-w-[120px]">Jenis Kelamin</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted border-r px-4 py-2 min-w-[150px]">Kewarganegaraan</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted border-r px-4 py-2 min-w-[180px]">Data Identitas</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted border-r px-4 py-2 min-w-[150px]">Tanggal Lahir</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted border-r px-4 py-2 min-w-[120px]">Agama</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted px-4 py-2 min-w-[180px]">Pendidikan Terakhir</TableHead>
                  </>
                )}
                {activeTab === "contact" && (
                  <>
                    <TableHead className="sticky top-0 z-20 bg-muted border-r px-4 py-2 min-w-[150px]">WhatsApp</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted border-r px-4 py-2 min-w-[200px]">Email</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted border-r px-4 py-2 min-w-[250px]">Alamat</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted px-4 py-2 min-w-[250px]">Domisili</TableHead>
                  </>
                )}
                {activeTab === "employment" && (
                  <>
                    <TableHead className="sticky top-0 z-20 bg-muted border-r px-4 py-2 min-w-[150px]">ID Karyawan</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted border-r px-4 py-2 min-w-[150px]">Status Karyawan</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted border-r px-4 py-2 min-w-[150px]">Unit</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted border-r px-4 py-2 min-w-[150px]">Jabatan</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted border-r px-4 py-2 min-w-[150px]">Bergabung</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted border-r px-4 py-2 min-w-[150px]">Masa Kerja</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted px-4 py-2 min-w-[150px]">Akhir Kontrak</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-4 text-muted-foreground">Memuat...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-4 text-muted-foreground">Tidak ada data</TableCell></TableRow>
              ) : (
                filtered.map((emp) => (
                  <TableRow 
                    key={emp.id} 
                    className="hover:bg-muted/20 transition-colors cursor-pointer group"
                    onClick={() => {
                      setViewingEmployee(emp);
                      setViewDialogOpen(true);
                    }}
                  >
                    <TableCell className="sticky left-0 z-10 bg-card font-semibold border-r px-4 py-2 w-[250px] min-w-[250px] group-hover:bg-muted transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      {emp.name}
                    </TableCell>
                    
                    {activeTab === "personal" && (
                      <>
                        <TableCell className="border-r px-4 py-2 font-mono text-xs">{emp.employee_id_number || "—"}</TableCell>
                        <TableCell className="border-r px-4 py-2">{emp.gender || "—"}</TableCell>
                        <TableCell className="border-r px-4 py-2">{emp.nationality || "—"}</TableCell>
                        <TableCell className="border-r px-4 py-2">{emp.identity_card_number || "—"}</TableCell>
                        <TableCell className="border-r px-4 py-2">
                          {emp.birth_date ? new Date(emp.birth_date).toLocaleDateString("id-ID") : "—"}
                        </TableCell>
                        <TableCell className="border-r px-4 py-2">{emp.religion || "—"}</TableCell>
                        <TableCell className="px-4 py-2">{emp.last_education || "—"}</TableCell>
                      </>
                    )}

                    {activeTab === "contact" && (
                      <>
                        <TableCell className="border-r px-4 py-2">{emp.whatsapp_number || emp.phone || "—"}</TableCell>
                        <TableCell className="border-r px-4 py-2 text-primary hover:underline">{emp.email}</TableCell>
                        <TableCell className="max-w-[200px] truncate border-r px-4 py-2">{emp.address || "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate px-4 py-2">{emp.address_domicile || "—"}</TableCell>
                      </>
                    )}

                    {activeTab === "employment" && (
                      <>
                        <TableCell className="border-r px-4 py-2 font-mono text-xs">{emp.employee_id_number || "—"}</TableCell>
                        <TableCell className="border-r px-4 py-2">{statusBadge(emp.status)}</TableCell>
                        <TableCell className="border-r px-4 py-2">{emp.units?.name ?? "—"}</TableCell>
                        <TableCell className="border-r px-4 py-2">{emp.position ?? "—"}</TableCell>
                        <TableCell className="border-r px-4 py-2">
                          {emp.join_date ? new Date(emp.join_date).toLocaleDateString("id-ID") : "—"}
                        </TableCell>
                        <TableCell className="border-r px-4 py-2">{calculateMasaKerja(emp.join_date)}</TableCell>
                        <TableCell className="px-4 py-2">
                          {emp.contract_end_date ? new Date(emp.contract_end_date).toLocaleDateString("id-ID") : "—"}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Tabs>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Hapus</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Apakah Anda yakin ingin menghapus <strong>{deletingEmployee?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="space-y-2">
              <Label>Ketik <strong>HAPUS</strong> untuk mengonfirmasi</Label>
              <Input
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="HAPUS"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Batal</Button>
              <Button variant="destructive" onClick={executeDelete} disabled={deleteConfirmation !== "HAPUS"}>
                Hapus
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between pr-8">
            <DialogTitle>Informasi Lengkap Karyawan</DialogTitle>
            {isAdminOrHr && viewingEmployee && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {
                    const emp = viewingEmployee;
                    setDialogMode("edit");
                    setEditingId(emp.id);
                    setForm({
                      name: emp.name || "",
                      email: emp.email || "",
                      phone: emp.phone || "",
                      unit_id: emp.unit_id || "",
                      position: emp.position || "",
                      password: "",
                      role: emp.role || "employee",
                      status: emp.status || "active",
                      employee_id_number: emp.employee_id_number || "",
                      gender: emp.gender || "Laki-laki",
                      nationality: emp.nationality || "WNI",
                      birth_date: emp.birth_date || "",
                      birth_place: emp.birth_place || "",
                      religion: emp.religion || "",
                      last_education: emp.last_education || "",
                      address: emp.address || "",
                      join_date: emp.join_date || new Date().toISOString().split('T')[0],
                      contract_end_date: emp.contract_end_date || "",
                      marital_status: emp.marital_status || "Belum Menikah",
                      identity_card_type: emp.identity_card_type || "KTP",
                      identity_card_number: emp.identity_card_number || "",
                      whatsapp_number: emp.whatsapp_number || "",
                      address_domicile: emp.address_domicile || "",
                      education_level: emp.education_level || "",
                      education_institution: emp.education_institution || "",
                      education_major: emp.education_major || "",
                      attachment_url: emp.attachment_url || ""
                    });
                    setViewDialogOpen(false);
                    setDialogOpen(true);
                  }}>
                    <Edit className="h-4 w-4 mr-2" /> Edit Data
                  </DropdownMenuItem>
                  {isSuperAdmin && (
                    <DropdownMenuItem onClick={() => {
                      setDeletingEmployee(viewingEmployee);
                      setDeleteConfirmation("");
                      setViewDialogOpen(false);
                      setDeleteDialogOpen(true);
                    }} className="text-destructive">
                      <Trash className="h-4 w-4 mr-2" /> Hapus Karyawan
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </DialogHeader>
          {viewingEmployee && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mt-4 text-sm">
              <div className="md:col-span-2 text-sm font-semibold border-b pb-1 text-primary">Data Pribadi</div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground font-medium">Nama Lengkap</span>
                <span className="font-semibold text-base">{viewingEmployee.name}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground font-medium">ID Karyawan</span>
                <span className="font-mono">{viewingEmployee.employee_id_number || "—"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground font-medium">Tempat, Tanggal Lahir</span>
                <span>{viewingEmployee.birth_place || "—"}, {viewingEmployee.birth_date ? new Date(viewingEmployee.birth_date).toLocaleDateString("id-ID") : "—"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground font-medium">Jenis Kelamin</span>
                <span>{viewingEmployee.gender || "—"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground font-medium">Status Perkawinan</span>
                <span>{viewingEmployee.marital_status || "—"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground font-medium">Agama</span>
                <span>{viewingEmployee.religion || "—"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground font-medium">Kewarganegaraan</span>
                <span>{viewingEmployee.nationality || "—"}</span>
              </div>

              <div className="md:col-span-2 text-sm font-semibold border-b pb-1 pt-4 text-primary">Kontak & Identitas</div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground font-medium">Tipe / No Identitas</span>
                <span>{viewingEmployee.identity_card_type || "KTP"} - {viewingEmployee.identity_card_number || "—"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground font-medium">Email</span>
                <span className="text-primary">{viewingEmployee.email}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground font-medium">WhatsApp</span>
                <span>{viewingEmployee.whatsapp_number || viewingEmployee.phone || "—"}</span>
              </div>
              <div className="md:col-span-2 flex flex-col gap-1">
                <span className="text-muted-foreground font-medium">Alamat (KTP)</span>
                <span>{viewingEmployee.address || "—"}</span>
              </div>
              <div className="md:col-span-2 flex flex-col gap-1">
                <span className="text-muted-foreground font-medium">Alamat Domisili</span>
                <span>{viewingEmployee.address_domicile || "—"}</span>
              </div>

              <div className="md:col-span-2 text-sm font-semibold border-b pb-1 pt-4 text-primary">Pendidikan Terakhir</div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground font-medium">Jenjang / Institusi</span>
                <span>{viewingEmployee.education_level || "—"} {viewingEmployee.education_institution || "—"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground font-medium">Program Studi</span>
                <span>{viewingEmployee.education_major || "—"}</span>
              </div>

              <div className="md:col-span-2 text-sm font-semibold border-b pb-1 pt-4 text-primary">Kepegawaian</div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground font-medium">Unit / Jabatan</span>
                <span>{viewingEmployee.units?.name || "—"} - {viewingEmployee.position || "—"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground font-medium">Status</span>
                <div>{statusBadge(viewingEmployee.status)}</div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground font-medium">Masa Kerja</span>
                <span>{new Date(viewingEmployee.join_date).toLocaleDateString("id-ID")} ( {calculateMasaKerja(viewingEmployee.join_date)} )</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground font-medium">Akhir Kontrak</span>
                <span>{viewingEmployee.contract_end_date ? new Date(viewingEmployee.contract_end_date).toLocaleDateString("id-ID") : "—"}</span>
              </div>
              {viewingEmployee.attachment_url && (
                <div className="md:col-span-2 flex flex-col gap-1">
                  <span className="text-muted-foreground font-medium">Lampiran</span>
                  <a href={viewingEmployee.attachment_url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">Lihat Dokumen</a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* DIALOG KONFIGURASI EKSPOR CSV */}
      <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Ekspor CSV</DialogTitle>
            <p className="text-sm text-muted-foreground">Pilih kolom yang ingin ditampilkan pada file CSV.</p>
          </DialogHeader>
          
          <div className="flex justify-between items-center py-2 border-b mb-2 w-full">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs font-semibold hover:bg-primary/10 hover:text-primary transition-colors"
              onClick={() => setCsvConfig(Object.keys(csvConfig).reduce((acc, key) => ({ ...acc, [key]: true }), {} as any))}
            >
              Pilih Semua
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
              onClick={() => setCsvConfig(Object.keys(csvConfig).reduce((acc, key) => ({ ...acc, [key]: false }), {} as any))}
            >
              Hapus Semua
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4 py-4 max-h-[50vh] overflow-y-auto pr-2">
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-primary">Data Pribadi</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="csv-name" className="text-sm cursor-pointer">Nama Lengkap</Label>
                  <Switch id="csv-name" checked={csvConfig.name} onCheckedChange={(v) => setCsvConfig({...csvConfig, name: v})} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="csv-id" className="text-sm cursor-pointer">ID Karyawan</Label>
                  <Switch id="csv-id" checked={csvConfig.employee_id} onCheckedChange={(v) => setCsvConfig({...csvConfig, employee_id: v})} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="csv-gender" className="text-sm cursor-pointer">Jenis Kelamin</Label>
                  <Switch id="csv-gender" checked={csvConfig.gender} onCheckedChange={(v) => setCsvConfig({...csvConfig, gender: v})} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="csv-religion" className="text-sm cursor-pointer">Agama</Label>
                  <Switch id="csv-religion" checked={csvConfig.religion} onCheckedChange={(v) => setCsvConfig({...csvConfig, religion: v})} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="csv-birth" className="text-sm cursor-pointer">Tgl Lahir</Label>
                  <Switch id="csv-birth" checked={csvConfig.birth_date} onCheckedChange={(v) => setCsvConfig({...csvConfig, birth_date: v})} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="csv-edu" className="text-sm cursor-pointer">Pendidikan</Label>
                  <Switch id="csv-edu" checked={csvConfig.education} onCheckedChange={(v) => setCsvConfig({...csvConfig, education: v})} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-primary">Kontak & Kepegawaian</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="csv-email" className="text-sm cursor-pointer">Email</Label>
                  <Switch id="csv-email" checked={csvConfig.email} onCheckedChange={(v) => setCsvConfig({...csvConfig, email: v})} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="csv-wa" className="text-sm cursor-pointer">WhatsApp</Label>
                  <Switch id="csv-wa" checked={csvConfig.whatsapp} onCheckedChange={(v) => setCsvConfig({...csvConfig, whatsapp: v})} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="csv-unit" className="text-sm cursor-pointer">Unit</Label>
                  <Switch id="csv-unit" checked={csvConfig.unit} onCheckedChange={(v) => setCsvConfig({...csvConfig, unit: v})} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="csv-pos" className="text-sm cursor-pointer">Jabatan</Label>
                  <Switch id="csv-pos" checked={csvConfig.position} onCheckedChange={(v) => setCsvConfig({...csvConfig, position: v})} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="csv-status" className="text-sm cursor-pointer">Status</Label>
                  <Switch id="csv-status" checked={csvConfig.status} onCheckedChange={(v) => setCsvConfig({...csvConfig, status: v})} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="csv-join" className="text-sm cursor-pointer">Tgl Bergabung</Label>
                  <Switch id="csv-join" checked={csvConfig.join_date} onCheckedChange={(v) => setCsvConfig({...csvConfig, join_date: v})} />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setCsvDialogOpen(false)}>Batal</Button>
            <Button className="flex-[2] gap-2" onClick={exportToCsv}>
              <Download className="h-4 w-4" /> Download Sekarang
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
