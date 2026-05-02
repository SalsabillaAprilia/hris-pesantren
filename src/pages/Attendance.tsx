import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
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
  const { employee, isAdminOrHr, isEmployee, hasRole } = useAuth();
  const isUnitLeader = hasRole("unit_leader");
  // Admin/HR melihat data global. Unit leader dan karyawan melihat data personal juga.
  const canSeeGlobal = isAdminOrHr || isUnitLeader;
  // isEmployee sudah mencakup unit_leader (keduanya punya data di tabel employees)
  const navigate = useNavigate();
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [globalRecords, setGlobalRecords] = useState<any[]>([]);
  const [personalRecords, setPersonalRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), "yyyy-MM-dd");

  const fetchData = useCallback(async () => {
    if (!employee && !isAdminOrHr) return;

    try {
      let fetchGlobal;
      if (isAdminOrHr) {
         fetchGlobal = supabase.from("attendance").select("*, employees!inner(*, units:unit_id(name))").order("date", { ascending: false }).limit(1000);
      } else if (isUnitLeader && employee?.unit_id) {
         fetchGlobal = supabase.from("attendance").select("*, employees!inner(*, units:unit_id(name))").eq("employees.unit_id", employee.unit_id).order("date", { ascending: false }).limit(1000);
      } else {
         fetchGlobal = Promise.resolve({ data: [] as any[], error: null });
      }

      // Data personal hanya relevan untuk karyawan (employee & unit_leader), bukan admin/HR
      const fetchPersonal = (employee && isEmployee)
        ? supabase.from("attendance").select("*, employees(name)").eq("employee_id", employee.id).order("date", { ascending: false }).limit(30)
        : Promise.resolve({ data: [] as any[], error: null });

      const fetchToday = (employee && isEmployee)
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
  }, [employee, isAdminOrHr, isEmployee, isUnitLeader, today]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1 className="page-title">Kehadiran</h1>
        {isAdminOrHr && (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-2 bg-white/50 shadow-sm border-primary/20 hover:bg-primary/10 hover:text-primary transition-all font-medium" onClick={() => navigate("/work-schedules")}>
              <CalendarClock className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">Jadwal Kerja</span>
              <span className="sm:hidden">Jadwal</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-2 bg-white/50 shadow-sm border-primary/20 hover:bg-primary/10 hover:text-primary transition-all font-medium" onClick={() => navigate("/holidays")}>
              <CalendarClock className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">Hari Libur</span>
              <span className="sm:hidden">Libur</span>
            </Button>
          </div>
        )}
      </div>

      {/* 
        Struktur tab per role:
        - isAdminOrHr (super_admin & hr): Harian + Ringkasan saja (bukan karyawan, tidak perlu Presensi Saya)
        - isUnitLeader: Harian + Ringkasan + Presensi Saya + Pengajuan (karyawan dengan wewenang lebih)
        - employee biasa: Presensi Saya + Pengajuan saja
      */}
      <Tabs
        defaultValue={isAdminOrHr ? "harian" : isUnitLeader ? "harian" : "presensi"}
        className="w-full"
      >
        {isAdminOrHr ? (
          // Admin/HR: hanya 2 tab global, tanpa Presensi Saya
          <TabsList className="grid grid-cols-2 mb-3 bg-muted/50 h-9 rounded-lg">
            <TabsTrigger value="harian" className="text-xs">Harian</TabsTrigger>
            <TabsTrigger value="ringkasan" className="text-xs">Ringkasan</TabsTrigger>
          </TabsList>
        ) : isUnitLeader ? (
          // Unit Leader: 4 tab (global unit + personal)
          <TabsList className="grid grid-cols-4 mb-3 bg-muted/50 h-9 rounded-lg">
            <TabsTrigger value="harian" className="text-xs">Harian</TabsTrigger>
            <TabsTrigger value="ringkasan" className="text-xs">Ringkasan</TabsTrigger>
            <TabsTrigger value="presensi" className="text-xs">Presensi Saya</TabsTrigger>
            <TabsTrigger value="pengajuan" className="text-xs">Pengajuan</TabsTrigger>
          </TabsList>
        ) : (
          // Karyawan biasa: 2 tab personal
          <TabsList className="grid grid-cols-2 mb-3 bg-muted/50 h-9 rounded-lg">
            <TabsTrigger value="presensi" className="text-xs">Presensi Saya</TabsTrigger>
            <TabsTrigger value="pengajuan" className="text-xs">Pengajuan</TabsTrigger>
          </TabsList>
        )}

        {/* Tab Harian & Ringkasan: Admin/HR lihat semua, Unit Leader lihat unitnya */}
        {canSeeGlobal && (
          <>
            <TabsContent value="harian">
              <AdminDailyAttendance records={globalRecords} loading={loading} />
            </TabsContent>
            <TabsContent value="ringkasan">
              <AdminSummaryAttendance records={globalRecords} loading={loading} />
            </TabsContent>
          </>
        )}

        {/* Tab Presensi Saya & Pengajuan: hanya untuk karyawan (employee & unit_leader) */}
        {isEmployee && (
          <>
            <TabsContent value="presensi" className="space-y-6">
              <AttendanceLogTable
                records={personalRecords}
                loading={loading}
                isAdminOrHr={false}
              />
            </TabsContent>
            <TabsContent value="pengajuan">
              <LeaveRequestWidget employee={employee} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </DashboardLayout>
  );
}
