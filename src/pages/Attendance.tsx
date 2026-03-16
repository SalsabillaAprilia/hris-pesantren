import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Camera, Clock, LogIn, LogOut } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

export default function Attendance() {
  const { employee, isAdminOrHr } = useAuth();
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const fetchData = useCallback(async () => {
    if (!employee) return;

    const query = isAdminOrHr
      ? supabase.from("attendance").select("*, employees(name)").order("date", { ascending: false }).limit(50)
      : supabase.from("attendance").select("*, employees(name)").eq("employee_id", employee.id).order("date", { ascending: false }).limit(30);

    const { data } = await query;
    setRecords(data ?? []);

    const { data: todayData } = await supabase
      .from("attendance")
      .select("*")
      .eq("employee_id", employee.id)
      .eq("date", today)
      .maybeSingle();

    setTodayRecord(todayData);
    setLoading(false);
  }, [employee, isAdminOrHr, today]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const startCamera = async () => {
    setCapturing(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      toast.error("Gagal mengakses kamera");
      setCapturing(false);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCapturing(false);
  };

  const captureAndCheckIn = async () => {
    if (!videoRef.current || !employee) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
    if (!blob) return;

    const fileName = `${employee.id}/${today}-${Date.now()}.jpg`;
    const { error: uploadErr } = await supabase.storage.from("attendance-selfies").upload(fileName, blob);
    if (uploadErr) { toast.error("Gagal upload selfie"); return; }

    const { data: { publicUrl } } = supabase.storage.from("attendance-selfies").getPublicUrl(fileName);

    if (!todayRecord) {
      await supabase.from("attendance").insert({
        employee_id: employee.id,
        date: today,
        check_in: new Date().toISOString(),
        selfie_url: publicUrl,
      });
      toast.success("Check-in berhasil!");
    } else {
      await supabase.from("attendance").update({
        check_out: new Date().toISOString(),
      }).eq("id", todayRecord.id);
      toast.success("Check-out berhasil!");
    }

    stopCamera();
    fetchData();
  };

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1 className="page-title">Kehadiran</h1>
        <p className="page-description">Kelola absensi harian</p>
      </div>

      {/* Check-in/out card */}
      <Card className="mb-6 stat-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Absensi Hari Ini — {format(new Date(), "dd MMMM yyyy", { locale: localeId })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayRecord?.check_in && todayRecord?.check_out ? (
            <p className="text-muted-foreground">
              Anda sudah check-in ({format(new Date(todayRecord.check_in), "HH:mm")}) dan check-out ({format(new Date(todayRecord.check_out), "HH:mm")}) hari ini.
            </p>
          ) : capturing ? (
            <div className="space-y-4">
              <video ref={videoRef} autoPlay playsInline muted className="rounded-lg w-full max-w-sm mx-auto aspect-video bg-muted" />
              <div className="flex gap-2 justify-center">
                <Button onClick={captureAndCheckIn}>
                  <Camera className="h-4 w-4 mr-2" />
                  {todayRecord ? "Check-out" : "Check-in"}
                </Button>
                <Button variant="outline" onClick={stopCamera}>Batal</Button>
              </div>
            </div>
          ) : (
            <Button onClick={startCamera}>
              {todayRecord ? <><LogOut className="h-4 w-4 mr-2" />Check-out</> : <><LogIn className="h-4 w-4 mr-2" />Check-in</>}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Records table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {isAdminOrHr && <TableHead>Karyawan</TableHead>}
              <TableHead>Tanggal</TableHead>
              <TableHead>Check-in</TableHead>
              <TableHead>Check-out</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={isAdminOrHr ? 4 : 3} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>
            ) : records.length === 0 ? (
              <TableRow><TableCell colSpan={isAdminOrHr ? 4 : 3} className="text-center py-8 text-muted-foreground">Belum ada data</TableCell></TableRow>
            ) : (
              records.map((r) => (
                <TableRow key={r.id}>
                  {isAdminOrHr && <TableCell className="font-medium">{r.employees?.name ?? "—"}</TableCell>}
                  <TableCell>{format(new Date(r.date), "dd MMM yyyy")}</TableCell>
                  <TableCell>{r.check_in ? format(new Date(r.check_in), "HH:mm") : "—"}</TableCell>
                  <TableCell>{r.check_out ? format(new Date(r.check_out), "HH:mm") : "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </DashboardLayout>
  );
}
