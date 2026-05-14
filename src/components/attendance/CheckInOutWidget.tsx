import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Camera, Clock, LogIn, LogOut } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface CheckInOutWidgetProps {
  employee: any;
  todayRecord: any;
  onSuccess: () => void;
}

export function CheckInOutWidget({ employee, todayRecord, onSuccess }: CheckInOutWidgetProps) {
  const [capturing, setCapturing] = useState(false);
  const [notes, setNotes] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const today = format(new Date(), "yyyy-MM-dd");

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

    let locationStr = "Location not available";
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      locationStr = `${position.coords.latitude}, ${position.coords.longitude}`;
    } catch (err) {
      console.warn("Could not get geolocation:", err);
    }

    // Mengambil secure time dari server eksternal untuk menghindari manipulasi waktu device (Loophole #1)
    let secureDateObj = new Date();
    let secureTodayStr = today;
    try {
      const res = await fetch("https://timeapi.io/api/Time/current/zone?timeZone=Asia/Jakarta");
      if (res.ok) {
        const timeData = await res.json();
        // timeData.dateTime format: "2026-05-06T15:39:17.3677361"
        // Tambahkan +07:00 agar JS Date diparsing dengan zona waktu Jakarta, bukan local browser
        secureDateObj = new Date(timeData.dateTime + "+07:00");
        // Update string today sesuai tanggal di server waktu
        secureTodayStr = timeData.dateTime.split("T")[0];
      }
    } catch (err) {
      console.warn("Secure time fetch failed, falling back to local time", err);
    }

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
          const { data: shift } = await supabase
            .from("work_shifts")
            .select("start_time, late_tolerance_minutes")
            .eq("id", employee.shift_id)
            .single();

          if (shift && shift.start_time) {
            const [startH, startM] = shift.start_time.split(":").map(Number);
            // Kita harus membuat start_dt dengan basis zona waktu Jakarta
            const start_dt = new Date(`${secureTodayStr}T${shift.start_time}:00+07:00`);

            const tolerance = shift.late_tolerance_minutes || 0;
            const tolerance_dt = new Date(start_dt.getTime() + tolerance * 60000);

            // Opsi A: Dihitung dari jam masuk awal (start_dt) jika melewati batas toleransi
            if (secureDateObj > tolerance_dt) {
              late_minutes = Math.max(0, Math.round((secureDateObj.getTime() - start_dt.getTime()) / 60000));
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
        date: secureTodayStr,
        check_in: secureDateObj.toISOString(),
        check_in_location: locationStr,
        check_in_method: 'selfie',
        selfie_url: publicUrl,
        late_minutes,
        daily_status,
        notes: notes.trim() ? `[Datang]: ${notes.trim()}` : null
      });

      if (late_minutes && late_minutes > 0) {
        toast.warning(`Check-in berhasil! Tercatat terlambat ${late_minutes} menit.`);
      } else if (daily_status === 'Hadir (Tanpa Shift)') {
        toast.success("Check-in berhasil! (Tanpa Jadwal Shift)");
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
            const end_dt = new Date(`${secureTodayStr}T${shift.end_time}:00+07:00`);

            if (secureDateObj < end_dt) {
              early_leave_minutes = Math.max(0, Math.round((end_dt.getTime() - secureDateObj.getTime()) / 60000));
            }
          }
        }
      } catch (err) {
        console.error("Error calculating early leave minutes:", err);
      }

      try {
        const { data: overtimeApp } = await supabase.from("approvals")
          .select("start_time, end_time")
          .eq("employee_id", employee.id)
          .eq("type", "overtime")
          .eq("start_date", todayRecord.date) // Sinkronisasi tanggal sesi lembur (Celah 5)
          .in("status", ["approved_unit_leader", "approved_hr"])
          .maybeSingle();

        if (overtimeApp && overtimeApp.start_time && overtimeApp.end_time) {
          const [startH, startM] = overtimeApp.start_time.split(":").map(Number);
          const [endH, endM] = overtimeApp.end_time.split(":").map(Number);
          const start_dt = new Date(); start_dt.setHours(startH, startM, 0, 0);
          const end_dt = new Date(); end_dt.setHours(endH, endM, 0, 0);
          const checkoutTime = new Date();
          
          const approvedMins = Math.max(0, (end_dt.getTime() - start_dt.getTime()) / 60000);
          const actualMins = Math.max(0, (checkoutTime.getTime() - start_dt.getTime()) / 60000);
          overtime_minutes = Math.round(Math.min(approvedMins, actualMins));
        }
      } catch (err) {
        console.error("Error calculating overtime:", err);
      }

      let finalNotes = todayRecord.notes || null;
      if (notes.trim()) {
        if (finalNotes) {
          finalNotes += `\n[Pulang]: ${notes.trim()}`;
        } else {
          finalNotes = `[Pulang]: ${notes.trim()}`;
        }
      }

      await supabase.from("attendance").update({
        check_out: secureDateObj.toISOString(),
        check_out_location: locationStr,
        check_out_method: 'selfie',
        overtime_minutes,
        early_leave_minutes,
        notes: finalNotes
      }).eq("id", todayRecord.id);
      
      if (early_leave_minutes && early_leave_minutes > 0) {
        toast.warning(`Check-out berhasil! Tercatat pulang cepat ${early_leave_minutes} menit.`);
      } else if (overtime_minutes && overtime_minutes > 0) {
        toast.success(`Check-out berhasil! Lembur tercatat: ${overtime_minutes} menit.`);
      } else {
        toast.success("Check-out berhasil!");
      }
    }

    stopCamera();
    onSuccess();
  };

  return (
    <Card className="stat-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Absensi Hari Ini — {format(new Date(), "dd MMMM yyyy", { locale: localeId })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {todayRecord?.check_in && todayRecord?.check_out ? (
          <p className="text-muted-foreground">
            Anda sudah check-in ({format(new Date(todayRecord.check_in), "HH:mm")}) dan check-out ({format(new Date(todayRecord.check_out), "HH:mm")}) pada sesi ini.
          </p>
        ) : capturing ? (
          <div className="space-y-4">
            <video ref={videoRef} autoPlay playsInline muted className="rounded-lg w-full max-w-sm mx-auto aspect-video bg-muted object-cover" />
            <Textarea
              placeholder={todayRecord ? "Opsional catatan pulang (misal: alasan pulang cepat)..." : "Opsional catatan presensi (misal: alasan telat)..."}
              className="w-full max-w-sm mx-auto text-sm resize-none h-20"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
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
  );
}
