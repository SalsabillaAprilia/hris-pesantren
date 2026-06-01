import { supabase } from "@/integrations/supabase/client";
import { format, addDays, getDay } from "date-fns";

export async function generateLeaveAttendanceRecords(
  approval: any,
  employeeShift: any,
  nationalHolidays: string[]
) {
  if (!approval || !employeeShift) return;

  // We only generate attendance for these types. WFA is excluded as requested.
  const validTypes = ["leave", "permission", "sick"];
  if (!validTypes.includes(approval.type)) return;

  const typeMap: Record<string, string> = {
    leave: "Cuti",
    permission: "Izin",
    sick: "Sakit",
  };

  const status = typeMap[approval.type];
  if (!status) return;

  const startDate = new Date(approval.start_date);
  const endDate = new Date(approval.end_date);
  
  const recordsToInsert = [];
  let currentDate = startDate;

  // Convert work_days array (1=Senin..7=Minggu) to match getDay() (0=Minggu, 1=Senin..6=Sabtu)
  const shiftDays = employeeShift.work_days || [];
  const validDays = shiftDays.map((d: number) => (d === 7 ? 0 : d));

  while (currentDate <= endDate) {
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const dayOfWeek = getDay(currentDate);

    // Skip if not a work day for this employee
    if (validDays.includes(dayOfWeek)) {
      // Skip if it's a national holiday
      if (!nationalHolidays.includes(dateStr)) {
        recordsToInsert.push({
          employee_id: approval.employee_id,
          instansi_id: approval.instansi_id,
          date: dateStr,
          daily_status: status,
          check_in: null,
          check_out: null,
        });
      }
    }
    currentDate = addDays(currentDate, 1);
  }

  if (recordsToInsert.length > 0) {
    // upsert to avoid duplicating if HR manually entered it
    const { error } = await supabase
      .from("attendance")
      .upsert(recordsToInsert, { onConflict: "employee_id,date" });
    
    if (error) {
      console.error("Failed to auto-generate attendance records:", error);
      throw new Error("Gagal membuat rekam kehadiran otomatis");
    }
  }
}

export async function rollbackLeaveAttendanceRecords(
  approval: any
) {
  if (!approval) return;
  const validTypes = ["leave", "permission", "sick"];
  if (!validTypes.includes(approval.type)) return;

  const typeMap: Record<string, string> = {
    leave: "Cuti",
    permission: "Izin",
    sick: "Sakit",
  };
  const status = typeMap[approval.type];

  // We delete records for this employee between start_date and end_date that have this specific status
  // and have NO check_in/check_out (to avoid deleting real attendance if it somehow got recorded)
  const { error } = await supabase
    .from("attendance")
    .delete()
    .eq("employee_id", approval.employee_id)
    .gte("date", approval.start_date)
    .lte("date", approval.end_date)
    .eq("daily_status", status)
    .is("check_in", null)
    .is("check_out", null);

  if (error) {
    console.error("Failed to rollback attendance records:", error);
  }
}
