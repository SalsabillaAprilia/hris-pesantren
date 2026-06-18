import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Camera, Clock, LogIn, LogOut, MapPin, CalendarDays, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface CheckInOutWidgetProps {
  employee: any;
  todayRecord: any;
  onSuccess: () => void;
  isFetching?: boolean;
}

export function CheckInOutWidget({ employee, todayRecord, onSuccess, isFetching }: CheckInOutWidgetProps) {
  const [capturing, setCapturing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
    setNotes("");
  };

  const captureAndCheckIn = async () => {
    if (!videoRef.current || !employee) return;
    setIsLoading(true);
    try {
      let locationStr = "Location not available";
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      locationStr = `${position.coords.latitude}, ${position.coords.longitude}`;
    } catch (err) {
      console.warn("Could not get geolocation:", err);
    }

    // Ambil waktu dari server eksternal. Jika gagal, gunakan waktu device
    // tapi tampilkan peringatan agar admin tahu.
    let secureDateObj = new Date();
    let secureTodayStr = today;
    let usingDeviceTime = false;
    try {
      const res = await fetch("https://timeapi.io/api/Time/current/zone?timeZone=Asia/Jakarta");
      if (res.ok) {
        const timeData = await res.json();
        secureDateObj = new Date(timeData.dateTime + "+07:00");
        secureTodayStr = timeData.dateTime.split("T")[0];
      } else {
        usingDeviceTime = true;
      }
    } catch (err) {
      console.warn("Secure time fetch failed, fallback to device time:", err);
      usingDeviceTime = true;
    }

    // ── Validasi hari libur & work_days (hanya untuk check-in baru) ─────────
    if (!todayRecord) {
      // Tentukan hari dalam minggu (1=Senin...7=Minggu, sesuai format work_days)
      const jsDay = secureDateObj.getDay(); // 0=Sun
      const workDay = jsDay === 0 ? 7 : jsDay;

      // Cek apakah hari ini adalah hari libur nasional
      const { data: holidayData } = await supabase
        .from("national_holidays")
        .select("id, description")
        .eq("date", secureTodayStr)
        .eq("instansi_id", employee.instansi_id)
        .maybeSingle();

      // Cek apakah hari ini sesuai work_days shift karyawan
      let isOffDay = false;
      if (employee.shift_id) {
        const { data: shiftData } = await (supabase as any)
          .from("work_shifts")
          .select("work_days")
          .eq("id", employee.shift_id)
          .single();
        if (shiftData?.work_days && !shiftData.work_days.includes(workDay)) {
          isOffDay = true;
        }
      }

      const isHoliday = !!holidayData;

      // Jika hari libur atau hari off: cek apakah ada approval lembur yang aktif
      if (isHoliday || isOffDay) {
        const { data: overtimeApproval } = await supabase
          .from("approvals")
          .select("id")
          .eq("employee_id", employee.id)
          .eq("type", "overtime")
          .eq("start_date", secureTodayStr)
          .in("status", ["approved_unit_leader", "approved_hr"])
          .maybeSingle();

        if (!overtimeApproval) {
          // Tidak ada lembur yang disetujui → blokir check-in
          if (isHoliday) {
            toast.error(`Hari ini adalah hari libur${holidayData?.description ? ` (${holidayData.description})` : ""}. Presensi tidak tersedia. Hubungi atasan jika Anda bekerja lembur.`);
          } else {
            toast.error("Hari ini bukan hari kerja sesuai jadwal shift Anda. Hubungi atasan jika Anda bekerja lembur.");
          }
          return;
        }
        // Ada approval lembur → lanjutkan dengan status khusus
      }
    }
    // ── End validasi ─────────────────────────────────────────────────────────

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
    if (!blob) return;

    const fileName = `${employee.id}/${secureTodayStr}-${Date.now()}.jpg`;
    const { error: uploadErr } = await supabase.storage.from("attendance-selfies").upload(fileName, blob);
    if (uploadErr) { toast.error("Gagal upload selfie"); return; }

    const { data: { publicUrl } } = supabase.storage.from("attendance-selfies").getPublicUrl(fileName);

    if (!todayRecord) {
      let late_minutes: number | null = null;
      let daily_status = 'Hadir';

      try {
        if (employee.shift_id) {
          late_minutes = 0;
          const { data: shift } = await (supabase as any)
            .from("work_shifts")
            .select("start_time, late_tolerance_minutes, work_days")
            .eq("id", employee.shift_id)
            .single();

          if (shift) {
            // Tandai sebagai Lembur jika hari ini di luar work_days
            const jsDay = secureDateObj.getDay();
            const workDay = jsDay === 0 ? 7 : jsDay;
            if (shift.work_days && !shift.work_days.includes(workDay)) {
              daily_status = 'Lembur';
              late_minutes = null;
            } else if (shift.start_time) {
              const startStr = shift.start_time.split(":").slice(0, 2).join(":");
              const start_dt = new Date(`${secureTodayStr}T${startStr}:00+07:00`);
              const tolerance = shift.late_tolerance_minutes || 0;
              const tolerance_dt = new Date(start_dt.getTime() + tolerance * 60000);
              if (secureDateObj > tolerance_dt) {
                late_minutes = Math.max(0, Math.round((secureDateObj.getTime() - start_dt.getTime()) / 60000));
                daily_status = 'Terlambat';
              }
            }
          }
        } else {
          daily_status = 'Hadir (Tanpa Shift)';
        }
      } catch (err) {
        console.error("Error calculating late minutes:", err);
      }

      await supabase.from("attendance").insert({
        employee_id: employee.id,
        instansi_id: employee.instansi_id,
        date: secureTodayStr,
        check_in: secureDateObj.toISOString(),
        check_in_location: locationStr,
        check_in_method: 'selfie',
        selfie_url: publicUrl,
        late_minutes,
        daily_status,
        notes: notes.trim() ? `[Datang]: ${notes.trim()}` : null
      });

      if (usingDeviceTime) {
        toast.warning("Check-in berhasil menggunakan jam perangkat (server waktu tidak tersedia).");
      } else if (late_minutes && late_minutes > 0) {
        toast.warning(`Check-in berhasil! Tercatat terlambat ${late_minutes} menit.`);
      } else if (daily_status === 'Lembur') {
        toast.success("Check-in lembur berhasil dicatat.");
      } else {
        toast.success("Check-in berhasil!");
      }

    } else {
      let overtime_minutes = null;
      let early_leave_minutes: number | null = null;
      
      try {
        if (employee.shift_id) {
          early_leave_minutes = 0;
          const { data: shift } = await supabase
            .from("work_shifts")
            .select("end_time")
            .eq("id", employee.shift_id)
            .single();

          if (shift && shift.end_time) {
            const endStr = shift.end_time.split(":").slice(0, 2).join(":");
            const end_dt = new Date(`${secureTodayStr}T${endStr}:00+07:00`);
            if (secureDateObj < end_dt) {
              early_leave_minutes = Math.max(0, Math.round((end_dt.getTime() - secureDateObj.getTime()) / 60000));
            }
          }
        }
      } catch (err) {}

      try {
        const { data: overtimeApp } = await supabase.from("approvals")
          .select("start_time, end_time")
          .eq("employee_id", employee.id)
          .eq("type", "overtime")
          .eq("start_date", todayRecord.date)
          .in("status", ["approved_unit_leader", "approved_hr"])
          .maybeSingle();

        if (overtimeApp && overtimeApp.start_time && overtimeApp.end_time) {
          const [startH, startM] = overtimeApp.start_time.split(":").map(Number);
          const [endH, endM] = overtimeApp.end_time.split(":").map(Number);
          const start_dt = new Date(); start_dt.setHours(startH, startM, 0, 0);
          const end_dt = new Date(); end_dt.setHours(endH, endM, 0, 0);
          
          const approvedMins = Math.max(0, (end_dt.getTime() - start_dt.getTime()) / 60000);
          const actualMins = Math.max(0, (secureDateObj.getTime() - start_dt.getTime()) / 60000);
          overtime_minutes = Math.round(Math.min(approvedMins, actualMins));
        }
      } catch (err) {}

      let finalNotes = todayRecord.notes || null;
      if (notes.trim()) {
        finalNotes = finalNotes ? `${finalNotes}\n[Pulang]: ${notes.trim()}` : `[Pulang]: ${notes.trim()}`;
      }

      await supabase.from("attendance").update({
        check_out: secureDateObj.toISOString(),
        check_out_location: locationStr,
        check_out_method: 'selfie',
        overtime_minutes,
        early_leave_minutes,
        notes: finalNotes
      }).eq("id", todayRecord.id);
      
      toast.success("Check-out berhasil!");
    }

      stopCamera();
      onSuccess();
    } finally {
      setIsLoading(false);
    }
  };

  const isCheckedIn = !!todayRecord?.check_in;
  const isCheckedOut = !!todayRecord?.check_out;
  const statusColor = isCheckedOut ? "text-emerald-500" : isCheckedIn ? "text-blue-500" : "text-amber-500";
  const statusText = isFetching ? "Memuat..." : isCheckedOut ? "Sesi Selesai" : isCheckedIn ? "Sedang Bekerja" : "Belum Presensi";

  return (
    <div className="flex flex-col bg-background rounded-xl overflow-hidden shadow-2xl border">
      <div className="p-6 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2 text-foreground font-bold text-lg tracking-tight">
          <Camera className="h-5 w-5 text-primary" />
          <span>Presensi Langsung</span>
        </div>
        <div className={`text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap mr-6 ${
          isCheckedOut ? "text-[hsl(142,45%,25%)] bg-[hsl(142,45%,96%)] border-[hsl(142,45%,90%)]" 
          : isCheckedIn ? "text-[hsl(232,59%,21%)] bg-[hsl(232,59%,96%)] border-[hsl(232,59%,90%)]" 
          : "text-[hsl(38,55%,30%)] bg-[hsl(38,55%,94%)] border-[hsl(38,55%,88%)]"
        }`}>
          {statusText}
        </div>
      </div>
      
      <div className="p-6 flex-1 flex flex-col justify-center items-center text-center space-y-6">
        {!capturing && (
          <div className="space-y-1 w-full">
            <h2 className="text-4xl font-extrabold tracking-tight text-foreground tabular-nums">
              {format(currentTime, "HH:mm:ss")}
            </h2>
            <p className="text-sm font-medium text-muted-foreground flex items-center justify-center gap-1.5 mt-2">
              <CalendarDays className="h-4 w-4" />
              {format(currentTime, "EEEE, dd MMMM yyyy", { locale: localeId })}
            </p>
          </div>
        )}

        {isFetching ? (
          <div className="w-full flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
            <p className="text-sm text-muted-foreground font-medium">Memeriksa status presensi...</p>
          </div>
        ) : isCheckedIn && isCheckedOut ? (
          <div className="w-full bg-muted/20 border rounded-xl p-4 text-foreground space-y-2 mt-4">
            <div className="flex justify-center mb-2">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-primary" />
              </div>
            </div>
            <p className="font-semibold text-sm">Rekap Kehadiran Anda</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-background p-2 rounded border text-center">
                <span className="block text-muted-foreground mb-0.5">Datang</span>
                <strong className="text-sm">{format(new Date(todayRecord.check_in), "HH:mm")}</strong>
              </div>
              <div className="bg-background p-2 rounded border text-center">
                <span className="block text-muted-foreground mb-0.5">Pulang</span>
                <strong className="text-sm">{format(new Date(todayRecord.check_out), "HH:mm")}</strong>
              </div>
            </div>
          </div>
        ) : capturing ? (
          <div className="w-full space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="relative rounded-xl overflow-hidden shadow-inner bg-black aspect-video border border-muted">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-0 border-2 border-primary/30 rounded-xl pointer-events-none" />
            </div>
            <Textarea
              placeholder={todayRecord ? "Catatan pulang (contoh: izin pulang cepat)..." : "Catatan kedatangan (contoh: macet)..."}
              className="w-full text-sm resize-none h-[72px] shadow-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3 w-full pt-2">
              <Button onClick={captureAndCheckIn} disabled={isLoading} className="h-10 shadow-md bg-primary hover:bg-primary/90 text-white font-bold transition-all transform active:scale-95">
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memproses...</>
                ) : (
                  <><Camera className="h-4 w-4 mr-2" /> {todayRecord ? "Check-out" : "Check-in"}</>
                )}
              </Button>
              <Button variant="outline" onClick={stopCamera} disabled={isLoading} className="h-10 text-sm bg-white/50 shadow-sm transition-all font-medium">Batal</Button>
            </div>
          </div>
        ) : (
          <div className="w-full mt-2">
            <Button 
              onClick={startCamera} 
              className={`w-full h-12 text-sm shadow-md transition-all transform active:scale-95 font-bold ${
                !todayRecord 
                  ? "bg-primary hover:bg-primary/90 text-white" 
                  : "bg-[hsl(38,90%,50%)] hover:bg-[hsl(38,90%,45%)] text-white"
              }`}
            >
              {todayRecord ? (
                <><LogOut className="h-4 w-4 mr-2" /> Check-out</>
              ) : (
                <><LogIn className="h-4 w-4 mr-2" /> Check-in</>
              )}
            </Button>
            
            {isCheckedIn && !isCheckedOut && (
              <p className="text-xs text-muted-foreground mt-4 font-medium flex items-center justify-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Waktu Datang: {format(new Date(todayRecord.check_in), "HH:mm")}
              </p>
            )}
            
            <p className="text-[10px] text-muted-foreground/70 mt-5 flex items-center justify-center gap-1">
              <MapPin className="h-3 w-3" />
              Lokasi & Waktu dilacak secara presisi
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

