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
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground" onClick={() => navigate("/attendance")}>
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Kehadiran
          </Button>
          <div className="h-5 w-px bg-border" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Jadwal Kerja (Shifting)</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Kelola master jadwal dan toleransi keterlambatan</p>
          </div>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="bg-primary hover:bg-primary/90 text-white">
              <Plus className="mr-2 h-4 w-4" /> Tambah Shift
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

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="font-semibold">Nama Shift</TableHead>
              <TableHead className="font-semibold text-center">Jam Mulai</TableHead>
              <TableHead className="font-semibold text-center">Jam Selesai</TableHead>
              <TableHead className="font-semibold text-center">Toleransi Keterlambatan</TableHead>
              <TableHead className="text-right font-semibold">Tindakan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6">Memuat...</TableCell></TableRow>
            ) : shifts.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Belum ada jadwal shift. Silakan buat baru.</TableCell></TableRow>
            ) : (
              shifts.map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell className="font-medium">{shift.name}</TableCell>
                  <TableCell className="text-center">{shift.start_time.slice(0, 5)}</TableCell>
                  <TableCell className="text-center">{shift.end_time.slice(0, 5)}</TableCell>
                  <TableCell className="text-center">{shift.late_tolerance_minutes} Menit</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="icon" onClick={() => handleOpenDialog(shift)}>
                      <Pencil className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => handleDelete(shift.id)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </DashboardLayout>
  );
}
