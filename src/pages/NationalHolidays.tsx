import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Pencil, Trash2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";

export default function NationalHolidays() {
  const navigate = useNavigate();
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    date: "",
    endDate: "",
    description: "",
  });

  const fetchHolidays = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("national_holidays")
      .select("*")
      .order("date", { ascending: false });
      
    if (!error && data) setHolidays(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const handleOpenDialog = (holiday = null) => {
    if (holiday) {
      setEditingHoliday(holiday);
      setFormData({
        date: holiday.date,
        endDate: holiday.date, // If editing a single, start and end are the same
        description: holiday.description,
      });
    } else {
      setEditingHoliday(null);
      setFormData({
        date: format(new Date(), "yyyy-MM-dd"),
        endDate: "",
        description: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.description) {
      return toast.error("Tanggal dan keterangan harus diisi");
    }

    if (editingHoliday) {
      // For editing, we only update that specific date row
      const { error } = await supabase.from("national_holidays").update({
        date: formData.date,
        description: formData.description,
      }).eq("id", editingHoliday.id);
      
      if (error) toast.error("Gagal mengubah hari libur");
      else toast.success("Hari libur berhasil diubah");
    } else {
      // For new inserts, check if it's a range
      if (formData.endDate && formData.endDate > formData.date) {
        const start = parseISO(formData.date);
        const end = parseISO(formData.endDate);
        
        // Generate array of dates
        const dates = [];
        let currentDate = start;
        while (currentDate <= end) {
          dates.push({
            date: format(currentDate, "yyyy-MM-dd"),
            description: formData.description
          });
          currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
        }
        
        const { error } = await supabase.from("national_holidays").insert(dates);
        if (error) toast.error("Gagal menambahkan rentang libur (mungkin ada tanggal yang tumpang tindih)");
        else toast.success(`${dates.length} hari libur berhasil ditambahkan`);
      } else {
        // Single date insertion
        const { error } = await supabase.from("national_holidays").insert([{
          date: formData.date,
          description: formData.description
        }]);
        
        if (error) toast.error("Gagal menambahkan hari libur");
        else toast.success("Hari libur berhasil ditambahkan");
      }
    }
    
    setIsDialogOpen(false);
    fetchHolidays();
  };

  const handleDelete = async (holidayId: string) => {
    if (!confirm("Yakin ingin menghapus hari libur ini?")) return;
    
    const { error } = await supabase.from("national_holidays").delete().eq("id", holidayId);
    if (error) toast.error("Gagal menghapus hari libur");
    else {
      toast.success("Hari libur berhasil dihapus");
      fetchHolidays();
    }
  };

  const [isFetchingApi, setIsFetchingApi] = useState(false);

  const handleFetchHolidaysFromApi = async () => {
    const year = new Date().getFullYear();
    if (!confirm(`Tarik data hari libur nasional tahun ${year} dari internet?`)) return;

    setIsFetchingApi(true);
    try {
      // Menggunakan API Nager.Date yang gratis dan stabil
      const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/ID`);
      if (!res.ok) throw new Error("Gagal mengambil data dari API");
      
      const apiData = await res.json();
      
      // Ambil tanggal yang sudah ada agar tidak duplikat
      const { data: existingDates } = await supabase.from("national_holidays").select("date");
      const existingDateSet = new Set(existingDates?.map(row => row.date) || []);
      
      const newHolidays = apiData
        .filter((h: any) => !existingDateSet.has(h.date))
        .map((h: any) => ({
          date: h.date,
          description: h.localName || h.name
        }));

      if (newHolidays.length === 0) {
        toast.info("Semua hari libur nasional dari API sudah terdaftar");
      } else {
        const { error } = await supabase.from("national_holidays").insert(newHolidays);
        if (error) throw error;
        toast.success(`Berhasil menarik ${newHolidays.length} data hari libur nasional!`);
        fetchHolidays();
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat menarik data");
    } finally {
      setIsFetchingApi(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-primary" />
              Kalender Hari Libur
            </h1>
          </div>
          
          <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center">
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 bg-white/50 shadow-sm border-primary/20 transition-all font-medium" 
              onClick={() => navigate("/attendance")}
            >
              <ArrowLeft className="h-4 w-4 text-primary" /> Kembali
            </Button>
            
            <Button
              variant="secondary"
              size="sm"
              onClick={handleFetchHolidaysFromApi}
              disabled={isFetchingApi}
              className="gap-2 font-medium"
            >
              {isFetchingApi ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <CalendarDays className="h-4 w-4" />}
              Tarik Data Otomatis
            </Button>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={() => handleOpenDialog()} 
                  size="sm"
                  className="gap-2 shadow-md shadow-primary/10 bg-primary hover:bg-primary/90 transition-all font-medium"
                >
                  <Plus className="h-4 w-4" /> Tambah Manual
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingHoliday ? "Edit Hari Libur" : "Tambah Hari Libur"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4 pt-4">
                {!editingHoliday ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tanggal Mulai</Label>
                      <Input 
                        type="date"
                        value={formData.date} 
                        onChange={(e) => setFormData({...formData, date: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tanggal Selesai (Opsional)</Label>
                      <Input 
                        type="date"
                        value={formData.endDate} 
                        onChange={(e) => setFormData({...formData, endDate: e.target.value})} 
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Tanggal Libur</Label>
                    <Input 
                      type="date"
                      value={formData.date} 
                      onChange={(e) => setFormData({...formData, date: e.target.value})} 
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Keterangan / Nama Libur</Label>
                  <Input 
                    value={formData.description} 
                    onChange={(e) => setFormData({...formData, description: e.target.value})} 
                    placeholder="Contoh: Idul Fitri 1446 H" 
                  />
                </div>
                <div className="pt-4 flex justify-end">
                  <Button type="submit">Simpan</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <div className="relative border rounded-md bg-white flex flex-col">
          <div className="overflow-x-auto overflow-y-visible flex-1 h-auto relative">
            <table className="w-full caption-bottom text-sm relative border-separate border-spacing-0 min-w-[600px]">
              <TableHeader className="bg-muted transition-none">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="w-[80px] text-center font-semibold text-slate-900 py-3 border-b border-r border-gray-200">No.</TableHead>
                  <TableHead className="font-semibold text-slate-900 py-3 border-b border-r border-gray-200">Tanggal</TableHead>
                  <TableHead className="font-semibold text-slate-900 py-3 border-b border-r border-gray-200">Keterangan</TableHead>
                  <TableHead className="text-right font-semibold text-slate-900 py-3 border-b">Tindakan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        Memuat data...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : holidays.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground border-b border-dashed">
                      Belum ada kalender libur nasional terdaftar.
                    </TableCell>
                  </TableRow>
                ) : (
                  holidays.map((holiday, index) => (
                    <TableRow 
                      key={holiday.id} 
                      className="hover:bg-muted/50 transition-colors h-12 group border-b border-gray-200"
                    >
                      <TableCell className="text-center text-slate-500 py-2 border-r border-gray-100">{index + 1}</TableCell>
                      <TableCell className="font-semibold text-slate-900 py-2 border-r border-gray-100 whitespace-nowrap">
                        {format(parseISO(holiday.date), "dd MMMM yyyy", { locale: id })}
                      </TableCell>
                      <TableCell className="text-slate-700 py-2 border-r border-gray-100">{holiday.description}</TableCell>
                      <TableCell className="text-right py-2 space-x-2">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-8 w-8 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                          onClick={() => handleOpenDialog(holiday)}
                        >
                          <Pencil className="h-3.5 w-3.5 text-blue-600" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-8 w-8 hover:bg-red-50 hover:border-red-200 transition-colors"
                          onClick={() => handleDelete(holiday.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
