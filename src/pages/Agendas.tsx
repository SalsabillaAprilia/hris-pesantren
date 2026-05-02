import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

export default function Agendas() {
  const { employee, user, isAdminOrHr } = useAuth();
  
  const [personalAgendas, setPersonalAgendas] = useState<any[]>([]);
  const [allAgendas, setAllAgendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const [form, setForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    time: format(new Date(), "HH:mm"),
    activity: "",
  });

  const fetchData = useCallback(async () => {
    if (!employee) return;
    setLoading(true);

    try {
      // 1. Fetch personal agendas
      const { data: personalData, error: personalErr } = await supabase
        .from("agendas")
        .select("*")
        .eq("employee_id", employee.id)
        .order("date", { ascending: false })
        .order("time", { ascending: false })
        .limit(100);
      
      if (personalErr) throw personalErr;
      setPersonalAgendas(personalData || []);

      // 2. Fetch all agendas if admin/HR
      if (isAdminOrHr) {
        const { data: allData, error: allErr } = await supabase
          .from("agendas")
          .select("*, employees(name)")
          .order("date", { ascending: false })
          .order("time", { ascending: false })
          .limit(300);
        
        if (allErr) throw allErr;
        setAllAgendas(allData || []);
      }
    } catch (err) {
      console.error("Agendas fetch error:", err);
      toast.error("Gagal memuat data agenda.");
    } finally {
      setLoading(false);
    }
  }, [employee, isAdminOrHr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;

    try {
      const { error } = await supabase.from("agendas").insert({
        employee_id: employee.id,
        date: form.date,
        time: form.time,
        activity: form.activity,
        status: "todo",
      });

      if (error) throw error;
      
      toast.success("Agenda berhasil ditambahkan!");
      setDialogOpen(false);
      setForm({ date: format(new Date(), "yyyy-MM-dd"), time: format(new Date(), "HH:mm"), activity: "" });
      fetchData();
    } catch (err: any) {
      toast.error("Gagal menambah agenda: " + err.message);
    }
  };

  const updateStatus = async (agendaId: string, status: string) => {
    try {
      const { error } = await supabase.from("agendas").update({ status: status as any }).eq("id", agendaId);
      if (error) throw error;
      fetchData();
    } catch (err) {
      toast.error("Gagal merubah status.");
    }
  };

  const deleteAgenda = async (agendaId: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus agenda ini?")) return;
    try {
      const { error } = await supabase.from("agendas").delete().eq("id", agendaId);
      if (error) throw error;
      toast.success("Agenda berhasil dihapus.");
      fetchData();
    } catch (err) {
      toast.error("Gagal menghapus agenda.");
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "todo":
        return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 border border-slate-200 rounded-md">To Do</span>;
      case "on_progress":
        return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-warning bg-warning/10 border border-warning/20 rounded-md">On Progress</span>;
      case "done":
        return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-success bg-success/10 border border-success/20 rounded-md">Done</span>;
      case "cancelled":
        return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-destructive bg-destructive/10 border border-destructive/20 rounded-md">Cancelled</span>;
      default:
        return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 border border-slate-200 rounded-md">{status}</span>;
    }
  };

  const renderTable = (data: any[], forAdmin: boolean = false) => (
    <div className="relative border rounded-md bg-white flex flex-col mt-4">
      <div className="overflow-x-auto overflow-y-visible flex-1 h-auto relative">
        <Table className="w-full caption-bottom text-sm relative border-separate border-spacing-0 min-w-[800px]">
          <TableHeader className="z-20 transition-none [&_th]:sticky [&_th]:top-0 [&_th:not(.sticky)]:z-30 [&_th:not(.sticky)]:bg-muted">
            <TableRow className="h-10 border-b border-gray-200">
              <TableHead className="w-[50px] text-center font-semibold border-r border-gray-200">No.</TableHead>
              {forAdmin && <TableHead className="font-semibold border-r border-gray-200 w-[180px]">Karyawan</TableHead>}
              <TableHead className="font-semibold border-r border-gray-200 w-[120px]">Tanggal</TableHead>
              <TableHead className="font-semibold border-r border-gray-200 w-[100px]">Hari</TableHead>
              <TableHead className="font-semibold border-r border-gray-200 w-[80px]">Waktu</TableHead>
              <TableHead className="font-semibold border-r border-gray-200 min-w-[200px]">Agenda / Aktivitas</TableHead>
              <TableHead className="font-semibold border-r border-gray-200 w-[140px] text-center">Status</TableHead>
              {!forAdmin && <TableHead className="font-semibold w-[80px] text-center">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={forAdmin ? 7 : 7} className="text-center py-10 text-muted-foreground">Memuat data...</TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={forAdmin ? 7 : 7} className="text-center py-10 text-muted-foreground">Belum ada agenda yang tercatat.</TableCell>
              </TableRow>
            ) : (
              data.map((item, index) => {
                const dateObj = new Date(item.date);
                const dayName = format(dateObj, "EEEE", { locale: id });
                const formattedDate = format(dateObj, "dd MMM yyyy", { locale: id });
                return (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50 transition-colors h-11 group border-b border-gray-200 text-sm">
                    <TableCell className="text-center text-slate-500 py-1.5">{index + 1}</TableCell>
                    {forAdmin && <TableCell className="font-medium text-slate-900 py-1.5 truncate max-w-[150px]">{item.employees?.name}</TableCell>}
                    <TableCell className="text-slate-900 py-1.5">{formattedDate}</TableCell>
                    <TableCell className="text-slate-700 py-1.5 capitalize">{dayName}</TableCell>
                    <TableCell className="text-slate-900 py-1.5 font-medium">{item.time.slice(0, 5)}</TableCell>
                    <TableCell className="text-slate-900 py-1.5">{item.activity}</TableCell>
                    <TableCell className="text-center py-1.5">
                      {!forAdmin ? (
                         <Select value={item.status} onValueChange={(v) => updateStatus(item.id, v)}>
                          <SelectTrigger className="h-8 text-xs font-semibold shadow-sm border-slate-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todo">To Do</SelectItem>
                            <SelectItem value="on_progress">On Progress</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        renderStatusBadge(item.status)
                      )}
                    </TableCell>
                    {!forAdmin && (
                      <TableCell className="text-center py-1.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteAgenda(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="page-header flex gap-4 flex-col sm:flex-row items-start sm:items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Agenda
          </h1>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 shadow-md shadow-primary/10 bg-primary hover:bg-primary/90 transition-all transform active:scale-95 font-medium">
              <Plus className="h-4 w-4" /> Tambah Agenda
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[450px] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
            <DialogHeader className="p-6 border-b bg-muted/30">
              <DialogTitle className="text-xl font-bold tracking-tight">Agenda Baru</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground/90 font-bold">Tanggal</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-9 text-sm text-slate-900 shadow-sm" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground/90 font-bold">Waktu / Jam</Label>
                  <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="h-9 text-sm text-slate-900 shadow-sm" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground/90 font-bold">Aktivitas / Agenda</Label>
                  <Input placeholder="Contoh: Meeting evaluasi" value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })} className="h-9 text-sm text-slate-900 shadow-sm" required />
                </div>
              </div>
              <div className="p-6 border-t bg-muted/30 flex justify-end gap-3">
                <Button type="button" variant="outline" className="min-w-[100px] h-10 text-sm" onClick={() => setDialogOpen(false)}>Batal</Button>
                <Button type="submit" className="min-w-[140px] h-10 shadow-md bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all transform active:scale-95 px-6">
                  Simpan Agenda
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isAdminOrHr ? (
        <Tabs defaultValue="pribadi" className="w-full">
          <TabsList className="grid grid-cols-2 mb-3 bg-muted/50 h-9 rounded-lg w-[300px]">
            <TabsTrigger value="pribadi" className="text-xs">Agenda Saya</TabsTrigger>
            <TabsTrigger value="semua" className="text-xs">Semua Agenda Karyawan</TabsTrigger>
          </TabsList>
          <TabsContent value="pribadi">
            {renderTable(personalAgendas, false)}
          </TabsContent>
          <TabsContent value="semua">
            {renderTable(allAgendas, true)}
          </TabsContent>
        </Tabs>
      ) : (
        renderTable(personalAgendas, false)
      )}

    </DashboardLayout>
  );
}
