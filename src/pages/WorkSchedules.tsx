import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useInstansiFilter } from "@/hooks/useInstansiFilter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, ArrowLeft, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

let globalWorkSchedulesCache: any[] | null = null;
let globalWorkSchedulesCacheInstansiId: string | null | undefined = undefined;

export default function WorkSchedules() {
  const navigate = useNavigate();
  const { effectiveInstansiId } = useInstansiFilter();
  const isCacheValid = globalWorkSchedulesCacheInstansiId === effectiveInstansiId;
  const [shifts, setShifts] = useState<any[]>((isCacheValid && globalWorkSchedulesCache) ? globalWorkSchedulesCache : []);
  const [loading, setLoading] = useState(!isCacheValid || globalWorkSchedulesCache === null);
  
  const isFirstFetch = useRef(!isCacheValid || globalWorkSchedulesCache === null);
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<any>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLTableSectionElement>(null);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [replacementShiftId, setReplacementShiftId] = useState<string>("");
  
  const [formData, setFormData] = useState({
    name: "",
    start_time: "08:00",
    end_time: "16:00",
    late_tolerance_minutes: 15,
    work_days: [1, 2, 3, 4, 5] // 1=Senin..7=Minggu
  });

  const fetchShifts = useCallback(async () => {
    if (isFirstFetch.current) setLoading(true);
    try {
      let shiftQ: any = supabase.from("work_shifts").select("*").order("name");
      let empQ: any = supabase.from("employees").select("shift_id").not("shift_id", "is", null);
      if (effectiveInstansiId) {
        shiftQ = shiftQ.eq("instansi_id", effectiveInstansiId);
        empQ = empQ.eq("instansi_id", effectiveInstansiId);
      }

      const [shiftRes, empRes] = await Promise.all([shiftQ, empQ]);

      if (shiftRes.error) throw shiftRes.error;
      if (empRes.error) console.warn("WorkSchedules: Gagal memuat data personel shift", empRes.error);

      if (isMounted.current) {
        const counts: Record<string, number> = {};
        (empRes.data || []).forEach((emp: any) => {
          counts[emp.shift_id] = (counts[emp.shift_id] || 0) + 1;
        });

        const formatted = (shiftRes.data || []).map(s => ({
          ...s,
          employee_count: counts[s.id] || 0
        }));

        setShifts(formatted);
        globalWorkSchedulesCache = formatted;
        globalWorkSchedulesCacheInstansiId = effectiveInstansiId;
      }
    } catch (err: any) {
      console.error(err);
      if (isMounted.current && err.code !== "PGRST116") toast.error("Gagal memuat data shift");
    } finally {
      if (isMounted.current) {
        setLoading(false);
        isFirstFetch.current = false;
      }
    }
  }, [effectiveInstansiId]);

  useEffect(() => { fetchShifts(); }, [fetchShifts]);

  const recalculateSticky = () => {
    const mainEl = document.querySelector('main');
    if (!mainEl || !scrollContainerRef.current || !headerRef.current) return;
    const rect = scrollContainerRef.current.getBoundingClientRect();
    const stickThreshold = Math.max(0, mainEl.getBoundingClientRect().top);
    let finalOffset = 0;
    if (rect.top < stickThreshold) {
      const maxOffset = rect.height - 44;
      const offset = Math.min(stickThreshold - rect.top, maxOffset);
      finalOffset = Math.max(0, offset);
    }
    headerRef.current.style.setProperty('--sticky-offset', `${finalOffset}px`);
  };

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => { recalculateSticky(); ticking = false; });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('resize', handleScroll);
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(recalculateSticky, 50);
    return () => clearTimeout(timer);
  }, [shifts]);

  const handleHorizontalScroll = () => {
    if (scrollContainerRef.current) {
      const scrolled = scrollContainerRef.current.scrollLeft > 2;
      if (scrolled !== isScrolled) setIsScrolled(scrolled);
    }
  };

  const handleOpenDialog = (shift = null) => {
    if (shift) {
      setEditingShift(shift);
      setFormData({
        name: shift.name,
        start_time: shift.start_time.slice(0, 5),
        end_time: shift.end_time.slice(0, 5),
        late_tolerance_minutes: shift.late_tolerance_minutes,
        work_days: shift.work_days || [1, 2, 3, 4, 5]
      });
    } else {
      setEditingShift(null);
      setFormData({
        name: "",
        start_time: "08:00",
        end_time: "16:00",
        late_tolerance_minutes: 15,
        work_days: [1, 2, 3, 4, 5]
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return toast.error("Nama shift harus diisi");
    if (formData.work_days.length === 0) return toast.error("Minimal satu hari kerja harus dipilih");

    if (editingShift) {
      const { error } = await supabase.from("work_shifts").update({
        name: formData.name,
        start_time: formData.start_time,
        end_time: formData.end_time,
        late_tolerance_minutes: formData.late_tolerance_minutes,
        work_days: formData.work_days
      }).eq("id", editingShift.id);
      
      if (error) toast.error("Gagal mengubah shift");
      else toast.success("Shift berhasil diubah");
    } else {
      const { error } = await supabase.from("work_shifts").insert([{
        ...formData,
        instansi_id: effectiveInstansiId ?? null,
      }]);
      
      if (error) toast.error("Gagal menambahkan shift");
      else toast.success("Shift berhasil ditambahkan");
    }
    
    setIsDialogOpen(false);
    fetchShifts();
  };

  const handleDeleteClick = (shift: any) => {
    setShiftToDelete(shift);
    setReplacementShiftId("");
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!shiftToDelete) return;
    
    setIsDeleting(true);
    try {
      // Jika ada personel, pindahkan dulu
      if (shiftToDelete.employee_count > 0) {
        if (!replacementShiftId) {
          toast.error("Pilih jadwal pengganti untuk memindahkan personel");
          setIsDeleting(false);
          return;
        }

        const { error: updateError } = await supabase
          .from("employees")
          .update({ shift_id: replacementShiftId })
          .eq("shift_id", shiftToDelete.id);

        if (updateError) throw updateError;
        toast.success(`${shiftToDelete.employee_count} personel berhasil dipindahkan ke jadwal baru.`);
      }

      const { error } = await supabase.from("work_shifts").delete().eq("id", shiftToDelete.id);
      if (error) throw error;
      
      toast.success("Shift berhasil dihapus");
      fetchShifts();
    } catch (error: any) {
      toast.error("Gagal menghapus shift (mungkin sedang digunakan)");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setShiftToDelete(null);
    }
  };

  const toggleDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      work_days: prev.work_days.includes(day)
        ? prev.work_days.filter(d => d !== day)
        : [...prev.work_days, day].sort()
    }));
  };

  const dayNames = [
    { value: 1, label: "Senin" },
    { value: 2, label: "Selasa" },
    { value: 3, label: "Rabu" },
    { value: 4, label: "Kamis" },
    { value: 5, label: "Jumat" },
    { value: 6, label: "Sabtu" },
    { value: 7, label: "Minggu" }
  ];

  const formatWorkDays = (days: number[]) => {
    if (!days || days.length === 0) return "—";
    if (days.length === 7) return "Setiap Hari";
    if (days.length === 5 && days.every(d => d <= 5)) return "Senin - Jumat";
    
    const shortNames: Record<number, string> = {
      1: "Sen", 2: "Sel", 3: "Rab", 4: "Kam", 5: "Jum", 6: "Sab", 7: "Min"
    };
    return days.sort((a, b) => a - b).map(d => shortNames[d]).join(", ");
  };

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1 className="page-title">Jadwal Kerja</h1>
        <div className="flex items-center gap-3">
          
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 bg-white/50 shadow-sm border-primary/20 transition-all transform active:scale-95 font-medium" 
              onClick={() => navigate("/attendance")}
            >
              <ArrowLeft className="h-4 w-4 text-primary" /> Kembali
            </Button>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={() => handleOpenDialog()} 
                  size="sm"
                  className="gap-2 shadow-md shadow-primary/10 bg-primary hover:bg-primary/90 transition-all transform active:scale-95 font-medium"
                >
                  <Plus className="h-4 w-4" /> Tambah Shift
                </Button>
              </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
            <DialogHeader className="p-6 border-b bg-muted/30">
              <DialogTitle className="text-xl font-bold tracking-tight">
                {editingShift ? "Edit Shift" : "Tambah Shift Baru"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground/90 font-bold">Nama Shift</Label>
                  <Input 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})} 
                    placeholder="Contoh: Shift Pagi" 
                    className="h-9 text-sm text-slate-900 shadow-sm"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground/90 font-bold">Jam Mulai (Check In)</Label>
                    <Input 
                      type="time" 
                      value={formData.start_time} 
                      onChange={(e) => setFormData({...formData, start_time: e.target.value})} 
                      className="h-9 text-sm text-slate-900 shadow-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground/90 font-bold">Jam Selesai (Check Out)</Label>
                    <Input 
                      type="time" 
                      value={formData.end_time} 
                      onChange={(e) => setFormData({...formData, end_time: e.target.value})} 
                      className="h-9 text-sm text-slate-900 shadow-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground/90 font-bold">Toleransi Terlambat (Menit)</Label>
                  <Input 
                    type="number" 
                    min="0"
                    value={formData.late_tolerance_minutes} 
                    onChange={(e) => setFormData({...formData, late_tolerance_minutes: parseInt(e.target.value) || 0})} 
                    className="h-9 text-sm text-slate-900 shadow-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground/90 font-bold">Hari Kerja</Label>
                  <div className="grid grid-cols-7 gap-1.5 pt-1">
                    {dayNames.map(day => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={`py-1.5 text-xs font-semibold rounded-md transition-all transform active:scale-95 text-center ${
                          formData.work_days.includes(day.value) 
                            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 shadow-sm'
                        }`}
                      >
                        {day.label.substring(0, 3)}
                      </button>
                    ))}
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
                  {editingShift ? "Simpan Perubahan" : "Simpan Jadwal"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="relative border rounded-md bg-white flex flex-col">
        <div
          ref={scrollContainerRef}
          onScroll={handleHorizontalScroll}
          className="overflow-x-auto overflow-y-visible flex-1 h-auto relative"
        >
          <table className="w-full caption-bottom text-sm relative border-separate border-spacing-0 min-w-[800px]">
            <TableHeader
              ref={headerRef}
              className="z-20 transition-none [&_th]:sticky [&_th]:top-[var(--sticky-offset)] [&_th:not(.sticky)]:z-30 [&_th:not(.sticky)]:bg-muted"
              style={{ "--sticky-offset": "0px" } as React.CSSProperties}
            >
              <TableRow className="border-none hover:bg-transparent">
                <TableHead
                  className={`sticky left-0 z-[40] bg-muted transition-none w-[40px] min-w-[40px] font-semibold text-center whitespace-nowrap
                    ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.3)]' : 'shadow-none'}`}
                >
                  No.
                </TableHead>
                <TableHead
                  className={`sticky left-[40px] z-[40] bg-muted transition-none w-[180px] min-w-[180px] font-semibold whitespace-nowrap
                    ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.3)]' : 'shadow-none'}`}
                >
                  Nama Shift
                </TableHead>
                <TableHead className="font-semibold whitespace-nowrap">Hari Kerja</TableHead>
                <TableHead className="font-semibold text-center whitespace-nowrap">Jam Mulai</TableHead>
                <TableHead className="font-semibold text-center whitespace-nowrap">Jam Selesai</TableHead>
                <TableHead className="font-semibold text-center whitespace-nowrap">Toleransi</TableHead>
                <TableHead className="font-semibold text-center whitespace-nowrap">Personel</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Memuat data jadwal...
                    </div>
                  </TableCell>
                </TableRow>
              ) : shifts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground border-b border-dashed">
                    Belum ada jadwal shift. Silakan buat baru.
                  </TableCell>
                </TableRow>
              ) : (
                shifts.map((shift, index) => (
                  <TableRow
                    key={shift.id}
                    className="hover:bg-muted/50 transition-colors h-11 group border-b border-gray-200 text-sm"
                  >
                    <TableCell className={`sticky left-0 z-[20] bg-white text-center transition-all duration-75 w-[40px] max-w-[40px] min-w-[40px] group-hover:bg-[#f8fafc] py-1.5 text-slate-500 ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.25)]' : 'shadow-none'}`}>
                      {index + 1}
                    </TableCell>
                    <TableCell className={`sticky left-[40px] z-[20] bg-white font-semibold transition-all duration-75 w-[180px] max-w-[180px] min-w-[180px] group-hover:bg-[#f8fafc] py-1.5 truncate text-slate-900 ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.25)]' : 'shadow-none'}`}>
                      {shift.name}
                    </TableCell>
                    <TableCell className="text-slate-900 py-1.5">{formatWorkDays(shift.work_days)}</TableCell>
                    <TableCell className="text-center text-slate-900 py-1.5">{shift.start_time.slice(0, 5)}</TableCell>
                    <TableCell className="text-center text-slate-900 py-1.5">{shift.end_time.slice(0, 5)}</TableCell>
                    <TableCell className="text-center py-1.5">
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                        {shift.late_tolerance_minutes}m
                      </span>
                    </TableCell>
                    <TableCell className="text-center py-1.5">
                      {shift.employee_count > 0 ? (
                        <span className="text-[11px] font-semibold text-[hsl(232,59%,21%)] bg-[hsl(232,59%,96%)] px-2 py-0.5 rounded border border-[hsl(232,59%,90%)] whitespace-nowrap">
                          {shift.employee_count} Karyawan
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-primary hover:bg-primary/10"
                          onClick={() => handleOpenDialog(shift)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteClick(shift)}
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
      <ConfirmDeleteDialog 
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        itemName={shiftToDelete?.name}
        description={
          <div className="space-y-4 pt-2 text-slate-600">
            <p>
              Apakah Anda yakin ingin menghapus jadwal <strong className="text-slate-900">{shiftToDelete?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>
            
            {shiftToDelete?.employee_count > 0 ? (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-3">
                <p className="text-orange-800 text-sm font-medium">
                  ⚠️ Terdapat {shiftToDelete.employee_count} personel yang menggunakan jadwal ini.
                </p>
                <div className="space-y-2">
                  <Label className="text-orange-900 font-semibold text-sm">Pilih Jadwal Pengganti *</Label>
                  <Select value={replacementShiftId} onValueChange={setReplacementShiftId}>
                    <SelectTrigger className="bg-white border-orange-200 focus:ring-orange-500 text-slate-900">
                      <SelectValue placeholder="Pilih Jadwal..." />
                    </SelectTrigger>
                    <SelectContent>
                      {shifts
                        .filter(s => s.id !== shiftToDelete?.id)
                        .map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-orange-700">Personel terkait akan dipindahkan ke jadwal baru sebelum jadwal ini dihapus.</p>
                </div>
              </div>
            ) : null}
          </div>
        }
        confirmText={shiftToDelete?.employee_count > 0 ? "Hapus & Pindahkan" : "Hapus"}
        disableConfirm={shiftToDelete?.employee_count > 0 && !replacementShiftId}
      />
    </DashboardLayout>
  );
}
