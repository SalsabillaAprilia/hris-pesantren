import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
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

interface QuickAttendanceDialogProps {
  trigger?: React.ReactNode;
}

export function QuickAttendanceDialog({ trigger }: QuickAttendanceDialogProps = {}) {
  const { employee } = useAuth();
  const [open, setOpen] = useState(false);
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchTodayRecord = useCallback(async () => {
    if (!employee) return;
    setLoading(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");
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
        {trigger ? (
          trigger
        ) : (
          <Button variant="ghost" className="h-9 px-4 gap-2 border border-slate-200 bg-white text-slate-700 shadow-sm transition-all active:scale-95 rounded-full text-sm font-semibold group">
            <Clock className="h-4 w-4 text-slate-500 group-hover:text-slate-900" />
            <span className="hidden sm:inline">Presensi</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none bg-transparent shadow-none">
        <div className="p-1">
          <CheckInOutWidget 
            employee={employee} 
            todayRecord={todayRecord} 
            onSuccess={fetchTodayRecord}
            isFetching={loading} 
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
