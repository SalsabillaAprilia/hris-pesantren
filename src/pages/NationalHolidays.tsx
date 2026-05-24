import { useEffect, useState, useRef, useCallback } from "react";
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
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

let globalHolidaysCache: any[] | null = null;

export default function NationalHolidays() {
  const navigate = useNavigate();
  const [holidays, setHolidays] = useState<any[]>(globalHolidaysCache || []);
  const [loading, setLoading] = useState(globalHolidaysCache === null);
  
  const isFirstFetch = useRef(globalHolidaysCache === null);
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<any>(null);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [holidayToDelete, setHolidayToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFetchDialogOpen, setIsFetchDialogOpen] = useState(false);
  const [isFetchingApi, setIsFetchingApi] = useState(false);
  
  const [formData, setFormData] = useState({
    date: "",
    endDate: "",
    description: "",
  });

  const fetchHolidays = useCallback(async () => {
    if (isFirstFetch.current) setLoading(true);
    try {
      const { data, error } = await supabase
        .from("national_holidays")
        .select("*")
        .order("date", { ascending: false });
        
      if (error) throw error;
      if (isMounted.current && data) {
        setHolidays(data);
        globalHolidaysCache = data;
      }
    } catch (err: any) {
      console.error(err);
      if (isMounted.current && err.code !== "PGRST116") toast.error("Gagal memuat data hari libur");
    } finally {
      if (isMounted.current) {
        setLoading(false);
        isFirstFetch.current = false;
      }
    }
  }, []);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

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

  const handleDeleteClick = (holiday: any) => {
    setHolidayToDelete(holiday);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!holidayToDelete) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("national_holidays").delete().eq("id", holidayToDelete.id);
      if (error) throw error;
      
      toast.success("Hari libur berhasil dihapus");
      fetchHolidays();
    } catch (error) {
      toast.error("Gagal menghapus hari libur");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setHolidayToDelete(null);
    }
  };

  const handleFetchHolidaysFromApi = async () => {
    const year = new Date().getFullYear();
    setIsFetchingApi(true);
    try {
      // Menggunakan API Nager.Date yang gratis dan stabil
      const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/ID`);
      if (!res.ok) throw new Error("Gagal mengambil data dari internet");
      
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
        toast.info("Semua hari libur nasional sudah terdaftar");
      } else {
        const { error } = await supabase.from("national_holidays").insert(newHolidays);
        if (error) throw error;
        toast.success(`Berhasil menarik ${newHolidays.length} data hari libur nasional!`);
        fetchHolidays();
      }
      setIsFetchDialogOpen(false);
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
              Kalender Hari Libur
            </h1>
          </div>
          
          <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center">
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 bg-white/50 shadow-sm border-primary/20 transition-all transform active:scale-95 font-medium" 
              onClick={() => navigate("/attendance")}
            >
              <ArrowLeft className="h-4 w-4 text-primary" /> Kembali
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFetchDialogOpen(true)}
              disabled={isFetchingApi}
              className="gap-2 bg-white/50 shadow-sm border-primary/20 transition-all transform active:scale-95 font-medium"
            >
              {isFetchingApi ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                <CalendarDays className="h-4 w-4 text-primary" />
              )}
              Tarik Data Otomatis
            </Button>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={() => handleOpenDialog()} 
                  size="sm"
                  className="gap-2 shadow-md shadow-primary/10 bg-primary hover:bg-primary/90 transition-all transform active:scale-95 font-medium"
                >
                  <Plus className="h-4 w-4" /> Tambah Manual
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
                <DialogHeader className="p-6 border-b bg-muted/30">
                  <DialogTitle className="text-xl font-bold tracking-tight">
                    {editingHoliday ? "Edit Hari Libur" : "Tambah Hari Libur"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {!editingHoliday ? (
                        <>
                          <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground/90 font-bold">Tanggal Mulai</Label>
                            <Input 
                              type="date"
                              value={formData.date} 
                              onChange={(e) => setFormData({...formData, date: e.target.value})} 
                              className="h-9 text-sm text-slate-900 shadow-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground/90 font-bold">Tanggal Selesai (Opsional)</Label>
                            <Input 
                              type="date"
                              value={formData.endDate} 
                              onChange={(e) => setFormData({...formData, endDate: e.target.value})} 
                              className="h-9 text-sm text-slate-900 shadow-sm"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-2 md:col-span-2">
                          <Label className="text-sm text-muted-foreground/90 font-bold">Tanggal Libur</Label>
                          <Input 
                            type="date"
                            value={formData.date} 
                            onChange={(e) => setFormData({...formData, date: e.target.value})} 
                            className="h-9 text-sm text-slate-900 shadow-sm"
                          />
                        </div>
                      )}
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-sm text-muted-foreground/90 font-bold">Keterangan Libur</Label>
                        <Input 
                          value={formData.description} 
                          onChange={(e) => setFormData({...formData, description: e.target.value})} 
                          placeholder="Contoh: Idul Fitri 1446 H" 
                          className="h-9 text-sm text-slate-900 shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="p-6 border-t bg-muted/30 flex justify-end gap-3">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsDialogOpen(false)}
                      className="min-w-[140px] h-10 text-sm"
                    >
                      Batal
                    </Button>
                    <Button 
                      type="submit" 
                      className="min-w-[140px] h-10 shadow-md bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all transform active:scale-95 px-6"
                    >
                      {editingHoliday ? "Simpan Perubahan" : "Simpan Hari Libur"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="relative border rounded-md bg-white flex flex-col">
          <div className="overflow-x-auto overflow-y-visible flex-1 h-auto relative">
            <table className="w-full caption-bottom text-sm relative border-separate border-spacing-0 min-w-[600px]">
              <TableHeader className="z-20 transition-none [&_th]:sticky [&_th]:top-0 [&_th:not(.sticky)]:z-30 [&_th:not(.sticky)]:bg-muted">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="w-14 text-center font-semibold text-slate-900 whitespace-nowrap">No.</TableHead>
                  <TableHead className="font-semibold text-slate-900 whitespace-nowrap">Tanggal</TableHead>
                  <TableHead className="font-semibold text-slate-900 whitespace-nowrap">Keterangan Libur</TableHead>
                  <TableHead className="w-24 font-semibold text-slate-900 whitespace-nowrap" />
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
                      className="hover:bg-muted/50 transition-colors h-11 group border-b border-gray-200 text-sm"
                    >
                      <TableCell className="text-center text-slate-500 py-1.5 font-medium">{index + 1}</TableCell>
                      <TableCell className="font-semibold text-slate-900 py-1.5 whitespace-nowrap">
                        {format(parseISO(holiday.date), "dd MMMM yyyy", { locale: id })}
                      </TableCell>
                      <TableCell className="text-slate-700 py-1.5">{holiday.description}</TableCell>
                      <TableCell className="py-1.5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0 text-slate-400 hover:text-primary hover:bg-primary/10"
                            onClick={() => handleOpenDialog(holiday)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0 text-slate-400 hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteClick(holiday)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </table>
          </div>
        </div>
      </div>
      <ConfirmDeleteDialog 
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        itemName={holidayToDelete?.description}
        description={
          <div className="space-y-4 pt-2 text-slate-600">
            <p>
              Apakah Anda yakin ingin menghapus hari libur <strong className="text-slate-900">{holidayToDelete?.description}</strong> pada tanggal <strong className="text-slate-900">{holidayToDelete ? format(parseISO(holidayToDelete.date), "dd MMMM yyyy", { locale: id }) : ""}</strong>?
              Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>
        }
      />

      <AlertDialog open={isFetchDialogOpen} onOpenChange={setIsFetchDialogOpen}>
        <AlertDialogContent className="shadow-2xl border-none max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">Tarik Data Otomatis</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-2 text-slate-600">
                <p>
                  Apakah Anda yakin ingin menarik data hari libur nasional tahun <strong className="text-slate-900">{new Date().getFullYear()}</strong> dari internet?
                </p>
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 leading-relaxed">
                  Sistem akan otomatis mengambil daftar hari libur resmi dan menambahkannya ke kalender. Hari libur yang sudah ada tidak akan ditambahkan lagi.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 pt-4">
            <AlertDialogCancel className="h-10 min-w-[120px] text-sm font-semibold">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleFetchHolidaysFromApi();
              }}
              disabled={isFetchingApi}
              className="h-10 min-w-[120px] text-sm bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
            >
              {isFetchingApi ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Memproses...
                </>
              ) : (
                "Tarik Data"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
