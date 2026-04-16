import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CheckInOutWidget } from "./CheckInOutWidget";

export function QuickAttendanceDialog() {
  const { employee } = useAuth();
  const [open, setOpen] = useState(false);
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchTodayRecord = useCallback(async () => {
    if (!employee) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", employee.id)
        .eq("date", today)
        .maybeSingle();
      setTodayRecord(data);
    } catch (err) {
      console.error("QuickAttendanceDialog: Error fetching record", err);
    } finally {
      setLoading(false);
    }
  }, [employee]);

  useEffect(() => {
    if (open) {
      fetchTodayRecord();
    }
  }, [open, fetchTodayRecord]);

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-primary/5 hover:bg-primary/10 text-primary border-primary/20 shadow-sm transition-all active:scale-95">
          <Clock className="h-4 w-4" />
          <span className="hidden sm:inline">Presensi</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none bg-transparent shadow-none">
        <div className="p-1">
          <CheckInOutWidget 
            employee={employee} 
            todayRecord={todayRecord} 
            onSuccess={fetchTodayRecord} 
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
