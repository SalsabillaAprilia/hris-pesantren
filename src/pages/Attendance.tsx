import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CalendarClock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabaseFetchWithTimeout } from "@/utils/supabase-fetch";
import { CheckInOutWidget } from "@/components/attendance/CheckInOutWidget";
import { AttendanceLogTable } from "@/components/attendance/AttendanceLogTable";
import { LeaveRequestWidget } from "@/components/attendance/LeaveRequestWidget";
import { AdminDailyAttendance } from "@/components/attendance/AdminDailyAttendance";
import { AdminSummaryAttendance } from "@/components/attendance/AdminSummaryAttendance";

export default function Attendance() {
  const { employee, isAdminOrHr, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [globalRecords, setGlobalRecords] = useState<any[]>([]);
  const [personalRecords, setPersonalRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split("T")[0];

  const fetchData = useCallback(async () => {
    if (!employee && !isSuperAdmin) return;

    try {
      const fetchGlobal = isAdminOrHr
        ? supabase.from("attendance").select("*, employees(*, units(name))").order("date", { ascending: false }).limit(200)
        : Promise.resolve({ data: [] as any[], error: null });
        
      const fetchPersonal = (employee && !isSuperAdmin)
        ? supabase.from("attendance").select("*, employees(name)").eq("employee_id", employee.id).order("date", { ascending: false }).limit(30)
        : Promise.resolve({ data: [] as any[], error: null });

      const fetchToday = (employee && !isSuperAdmin)
        ? supabase.from("attendance").select("*").eq("employee_id", employee.id).eq("date", today).maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const [globalRes, personalRes, todayRes] = await supabaseFetchWithTimeout(
        Promise.all([fetchGlobal, fetchPersonal, fetchToday])
      );

      if (globalRes.error) throw globalRes.error;
      if (personalRes.error) throw personalRes.error;
      if (todayRes.error) throw todayRes.error;

      setGlobalRecords(globalRes.data ?? []);
      setPersonalRecords(personalRes.data ?? []);
      setTodayRecord(todayRes.data);
    } catch (err) {
      console.error("Attendance: Fetch error", err);
    } finally {
      setLoading(false);
    }
  }, [employee, isAdminOrHr, isSuperAdmin, today]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (isSuperAdmin) {
    return (
      <DashboardLayout>
        <div className="page-header">
          <h1 className="page-title">Kehadiran Karyawan</h1>
        </div>
        <Tabs defaultValue="harian" className="w-full">
          <div className="flex items-center justify-between mb-3">
            <TabsList className="grid grid-cols-2 bg-muted/50 h-9 rounded-lg w-64">
              <TabsTrigger value="harian" className="text-xs">Harian</TabsTrigger>
              <TabsTrigger value="ringkasan" className="text-xs">Ringkasan</TabsTrigger>
            </TabsList>
            <Button variant="outline" size="sm" className="gap-2 bg-white/50 shadow-sm border-primary/20 transition-all font-medium" onClick={() => navigate("/work-schedules")}>
              <CalendarClock className="h-4 w-4 text-primary" />
              Jadwal Kerja
            </Button>
          </div>

          <TabsContent value="harian">
            <AdminDailyAttendance records={globalRecords} loading={loading} />
          </TabsContent>
          <TabsContent value="ringkasan">
            <AdminSummaryAttendance records={globalRecords} loading={loading} />
          </TabsContent>
        </Tabs>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1 className="page-title">Kehadiran</h1>
      </div>

      <Tabs defaultValue={isAdminOrHr ? "harian" : "presensi"} className="w-full">
        {isAdminOrHr ? (
          <div className="flex items-center justify-between mb-3">
            <TabsList className="grid grid-cols-4 bg-muted/50 h-9 rounded-lg">
              <TabsTrigger value="harian" className="text-xs">Rekap Harian</TabsTrigger>
              <TabsTrigger value="ringkasan" className="text-xs">Ringkasan</TabsTrigger>
              <TabsTrigger value="presensi" className="text-xs">Presensi Pribadi</TabsTrigger>
              <TabsTrigger value="cuti_izin" className="text-xs">Cuti & Izin</TabsTrigger>
            </TabsList>
            <Button variant="outline" size="sm" className="gap-2 bg-white/50 shadow-sm border-primary/20 hover:bg-primary/10 hover:text-primary transition-all font-medium" onClick={() => navigate("/work-schedules")}>
              <CalendarClock className="h-4 w-4 text-primary" />
              Jadwal Kerja
            </Button>
          </div>
        ) : (
          <TabsList className="grid grid-cols-2 mb-3 bg-muted/50 h-9 rounded-lg">
            <TabsTrigger value="presensi" className="text-xs">Presensi Pribadi</TabsTrigger>
            <TabsTrigger value="cuti_izin" className="text-xs">Cuti & Izin</TabsTrigger>
          </TabsList>
        )}

        {isAdminOrHr && (
          <>
            <TabsContent value="harian">
              <AdminDailyAttendance records={globalRecords} loading={loading} />
            </TabsContent>
            <TabsContent value="ringkasan">
              <AdminSummaryAttendance records={globalRecords} loading={loading} />
            </TabsContent>
          </>
        )}

        <TabsContent value="presensi" className="space-y-6">
          <CheckInOutWidget 
            employee={employee} 
            todayRecord={todayRecord} 
            onSuccess={fetchData} 
          />
          <AttendanceLogTable 
            records={personalRecords} 
            loading={loading} 
            isAdminOrHr={false} 
          />
        </TabsContent>
        
        <TabsContent value="cuti_izin">
          <LeaveRequestWidget employee={employee} />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
