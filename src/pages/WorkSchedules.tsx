import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function WorkSchedules() {
  const navigate = useNavigate();
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    start_time: "08:00",
    end_time: "16:00",
    late_tolerance_minutes: 15
  });

  const fetchShifts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("work_shifts").select("*").order("name");
    if (!error && data) setShifts(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  const handleOpenDialog = (shift = null) => {
    if (shift) {
      setEditingShift(shift);
      setFormData({
        name: shift.name,
        start_time: shift.start_time.slice(0, 5), // Assuming HH:mm:ss format from DB
        end_time: shift.end_time.slice(0, 5),
        late_tolerance_minutes: shift.late_tolerance_minutes
      });
    } else {
      setEditingShift(null);
      setFormData({
        name: "",
        start_time: "08:00",
        end_time: "16:00",
        late_tolerance_minutes: 15
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return toast.error("Nama shift harus diisi");

    if (editingShift) {
      const { error } = await supabase.from("work_shifts").update({
        name: formData.name,
        start_time: formData.start_time,
        end_time: formData.end_time,
        late_tolerance_minutes: formData.late_tolerance_minutes
      }).eq("id", editingShift.id);
      
      if (error) toast.error("Gagal mengubah shift");
      else toast.success("Shift berhasil diubah");
    } else {
      const { error } = await supabase.from("work_shifts").insert([formData]);
      
      if (error) toast.error("Gagal menambahkan shift");
      else toast.success("Shift berhasil ditambahkan");
    }
    
    setIsDialogOpen(false);
    fetchShifts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus shift ini?")) return;
    
    const { error } = await supabase.from("work_shifts").delete().eq("id", id);
    if (error) toast.error("Gagal menghapus shift (mungkin sedang digunakan)");
    else {
      toast.success("Shift berhasil dihapus");
      fetchShifts();
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Jadwal Kerja</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 bg-white/50 shadow-sm border-primary/20 transition-all font-medium" 
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
                  <Plus className="h-4 w-4" /> Tambah
                </Button>
              </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingShift ? "Edit Jadwal Shift" : "Tambah Jadwal Shift Baru"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nama / Label Shift</Label>
                <Input 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  placeholder="Cth: Shift Pagi, Security Malam" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Jam Mulai (Check In)</Label>
                  <Input 
                    type="time" 
                    value={formData.start_time} 
                    onChange={(e) => setFormData({...formData, start_time: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Jam Selesai (Check Out)</Label>
                  <Input 
                    type="time" 
                    value={formData.end_time} 
                    onChange={(e) => setFormData({...formData, end_time: e.target.value})} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Toleransi Terlambat (Menit)</Label>
                <Input 
                  type="number" 
                  min="0"
                  value={formData.late_tolerance_minutes} 
                  onChange={(e) => setFormData({...formData, late_tolerance_minutes: parseInt(e.target.value) || 0})} 
                />
              </div>
              <div className="pt-4 flex justify-end">
                <Button type="submit">Simpan Jadwal</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
          </div>
        </div>

      <div className="relative border rounded-md bg-white flex flex-col">
        <div className="overflow-x-auto overflow-y-visible flex-1 h-auto relative">
          <table className="w-full caption-bottom text-sm relative border-separate border-spacing-0 min-w-[800px]">
            <TableHeader className="bg-muted transition-none">
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className="w-[60px] text-center font-semibold text-slate-900 py-3 border-b border-r border-gray-200">No.</TableHead>
                <TableHead className="font-semibold text-slate-900 py-3 border-b border-r border-gray-200">Nama Shift</TableHead>
                <TableHead className="font-semibold text-slate-900 py-3 text-center border-b border-r border-gray-200">Jam Mulai</TableHead>
                <TableHead className="font-semibold text-slate-900 py-3 text-center border-b border-r border-gray-200">Jam Selesai</TableHead>
                <TableHead className="font-semibold text-slate-900 py-3 text-center border-b border-r border-gray-200">Toleransi Keterlambatan</TableHead>
                <TableHead className="text-right font-semibold text-slate-900 py-3 border-b">Tindakan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Memuat data jadwal...
                    </div>
                  </TableCell>
                </TableRow>
              ) : shifts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground border-b border-dashed">
                    Belum ada jadwal shift. Silakan buat baru.
                  </TableCell>
                </TableRow>
              ) : (
                shifts.map((shift, index) => (
                  <TableRow 
                    key={shift.id} 
                    className="hover:bg-muted/50 transition-colors h-12 group border-b border-gray-200"
                  >
                    <TableCell className="text-center text-slate-500 py-2 border-r border-gray-100">{index + 1}</TableCell>
                    <TableCell className="font-semibold text-slate-900 py-2 border-r border-gray-100">{shift.name}</TableCell>
                    <TableCell className="text-center text-slate-700 py-2 border-r border-gray-100">{shift.start_time.slice(0, 5)}</TableCell>
                    <TableCell className="text-center text-slate-700 py-2 border-r border-gray-100">{shift.end_time.slice(0, 5)}</TableCell>
                    <TableCell className="text-center text-slate-700 py-2 border-r border-gray-100">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        {shift.late_tolerance_minutes} Menit
                      </span>
                    </TableCell>
                    <TableCell className="text-right py-2 space-x-2">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                        onClick={() => handleOpenDialog(shift)}
                      >
                        <Pencil className="h-3.5 w-3.5 text-blue-600" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-red-50 hover:border-red-200 transition-colors"
                        onClick={() => handleDelete(shift.id)}
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
