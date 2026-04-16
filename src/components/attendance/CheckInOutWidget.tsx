import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  };

  const captureAndCheckIn = async () => {
    if (!videoRef.current || !employee) return;

    // Get Geolocation
    let locationStr = "Location not available";
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      locationStr = `${position.coords.latitude}, ${position.coords.longitude}`;
    } catch (err) {
      console.warn("Could not get geolocation:", err);
      // We still proceed even if geolocation fails, but log it.
    }

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
        check_in_location: locationStr,
        check_in_method: 'selfie',
        selfie_url: publicUrl,
      });
      toast.success("Check-in berhasil!");
    } else {
      await supabase.from("attendance").update({
        check_out: new Date().toISOString(),
        check_out_location: locationStr,
        check_out_method: 'selfie'
      }).eq("id", todayRecord.id);
      toast.success("Check-out berhasil!");
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
            Anda sudah check-in ({format(new Date(todayRecord.check_in), "HH:mm")}) dan check-out ({format(new Date(todayRecord.check_out), "HH:mm")}) hari ini.
          </p>
        ) : capturing ? (
          <div className="space-y-4">
            <video ref={videoRef} autoPlay playsInline muted className="rounded-lg w-full max-w-sm mx-auto aspect-video bg-muted object-cover" />
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
