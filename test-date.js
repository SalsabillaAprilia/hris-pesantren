const { format, addDays, getDay } = require("date-fns");

const startDate = new Date("2026-06-21");
const endDate = new Date("2026-06-28");

const recordsToInsert = [];
let currentDate = startDate;
const validDays = [1, 2, 3, 4, 5, 6, 0];
const nationalHolidays = [];

while (currentDate <= endDate) {
  const dateStr = format(currentDate, "yyyy-MM-dd");
  const dayOfWeek = getDay(currentDate);

  if (validDays.includes(dayOfWeek)) {
    if (!nationalHolidays.includes(dateStr)) {
      recordsToInsert.push(dateStr);
    }
  }
  currentDate = addDays(currentDate, 1);
}

console.log(recordsToInsert);
