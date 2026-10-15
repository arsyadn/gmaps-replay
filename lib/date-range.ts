const DATE_VALUE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateValue(value: string): Date | null {
  const match = value.match(DATE_VALUE_PATTERN);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day);

  return date.getFullYear() === year && date.getMonth() === monthIndex && date.getDate() === day
    ? date
    : null;
}

export function formatDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function timestampToDateValue(timestamp: string): string {
  return formatDateValue(new Date(timestamp));
}

export function shiftDateValueByYear(value: string, years: number): string | null {
  const date = parseDateValue(value);
  if (!date) return null;

  const targetYear = date.getFullYear() + years;
  const lastDayOfTargetMonth = new Date(targetYear, date.getMonth() + 1, 0).getDate();
  return formatDateValue(
    new Date(targetYear, date.getMonth(), Math.min(date.getDate(), lastDayOfTargetMonth)),
  );
}

export function getDateRangeBounds(startDate: string, endDate: string) {
  const start = parseDateValue(startDate);
  const end = parseDateValue(endDate);
  if (!start || !end) throw new Error("Choose a valid start and end date.");
  if (end.getTime() < start.getTime()) throw new Error("End date must be on or after start date.");

  const maximumEndDate = shiftDateValueByYear(startDate, 1);
  if (!maximumEndDate || endDate > maximumEndDate) {
    throw new Error("Choose a date range of one year or less.");
  }

  const endExclusive = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
  return { startMs: start.getTime(), endExclusiveMs: endExclusive.getTime() };
}
