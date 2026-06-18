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
  let shiftDays = employeeShift.work_days;
  if (!shiftDays || shiftDays.length === 0) {
    shiftDays = [1, 2, 3, 4, 5]; // Default to Mon-Fri if missing
  }
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
        });
      }
    }
    currentDate = addDays(currentDate, 1);
  }

  if (recordsToInsert.length > 0) {
    const dates = recordsToInsert.map(r => r.date);
    const { data: existing, error: fetchErr } = await supabase
      .from("attendance")
      .select("id, date")
      .eq("employee_id", approval.employee_id)
      .in("date", dates);

    if (fetchErr) {
      console.error("Failed to check existing attendance records:", fetchErr);
      throw new Error(`Gagal mengecek rekam kehadiran yang ada: ${fetchErr.message}`);
    }

    const existingDates = new Set(existing?.map(e => e.date) || []);
    
    const toInsert = recordsToInsert.filter(r => !existingDates.has(r.date));
    const toUpdate = recordsToInsert.filter(r => existingDates.has(r.date));

    if (toInsert.length > 0) {
      const { error } = await supabase.from("attendance").insert(toInsert);
      if (error) {
        console.error("Failed to insert auto-generated attendance records:", error);
        throw new Error(`Gagal membuat rekam kehadiran otomatis: ${error.message}`);
      }
    }
    
    if (toUpdate.length > 0) {
      for (const record of toUpdate) {
        const { error } = await supabase.from("attendance")
          .update({ daily_status: record.daily_status })
          .eq("employee_id", record.employee_id)
          .eq("date", record.date);
          
        if (error) {
          console.error("Failed to update auto-generated attendance:", error);
          throw new Error(`Gagal memperbarui rekam kehadiran otomatis: ${error.message}`);
        }
      }
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
