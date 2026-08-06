/**
 * Timezone-safe date utilities for IST (Asia/Kolkata)
 */

export const todayIST = (): string => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
};

export const currentMonthIST = (): string => {
  return todayIST().slice(0, 7); // YYYY-MM
};

export const formatIST = (date: string | Date, options: Intl.DateTimeFormatOptions = {}): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    ...options,
  }).format(d);
};

export const toISTString = (date: Date = new Date()): string => {
  // Returns ISO 8601 with +05:30 suffix so DB & browsers parse it correctly
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}+05:30`;
};

export const toLocalStr = (date: Date): string => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

export const toISTDatePart = (date: string | Date | null | undefined): string => {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};

export const startOfMonthIST = (date?: Date): string => {
  const todayStr = date 
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date)
    : todayIST();
  const [y, m] = todayStr.split("-");
  return `${y}-${m}-01`;
};

export const endOfMonthIST = (date?: Date): string => {
  const todayStr = date 
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date)
    : todayIST();
  const [y, m] = todayStr.split("-");
  const lastDay = new Date(Number(y), Number(m), 0).getDate();
  return `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
};

export const parseISTDate = (dateStr: string): Date => {
  // Assuming dateStr is YYYY-MM-DD
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Current time in IST as "HH:mm:ss" (24h). Used for attendance
 * check-in / check-out stamps, mirroring PHP's server-side clock.
 */
export const nowISTTime = (): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "00";
  return `${get("hour")}:${get("minute")}:${get("second")}`;
};

const _timeToMin = (v: string): number => {
  const [h, m] = v.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Minutes between two "HH:mm(:ss)" values, supporting overnight shifts.
 */
export const minsBetweenIST = (timeIn: string | null, timeOut: string | null): number | null => {
  if (!timeIn || !timeOut) return null;
  let diff = _timeToMin(timeOut) - _timeToMin(timeIn);
  if (diff < 0) diff += 1440; // overnight shift
  return diff;
};

/**
 * Human-readable working hours "Xh Ym" (or "—" when incomplete),
 * supporting overnight shifts. Mirrors PHP attendance_hours_str().
 */
export const hoursBetweenIST = (timeIn: string | null, timeOut: string | null): string => {
  const mins = minsBetweenIST(timeIn, timeOut);
  if (mins === null) return "—";
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

/**
 * Auto-derive Present(1) / Half Day(3) from check-in/out times.
 *  - No check-in      -> null (cannot derive)
 *  - Check-in only    -> Present (still working)
 *  - Both, < 6h       -> Half Day
 *  - Both, >= 6h      -> Present
 * Mirrors PHP save_attendance() / save_check_in_out() (21,600s threshold).
 */
export const deriveStatusFromTimes = (timeIn: string | null, timeOut: string | null): 1 | 3 | null => {
  if (!timeIn) return null;
  if (!timeOut) return 1;
  const mins = minsBetweenIST(timeIn, timeOut);
  return mins !== null && mins < 360 ? 3 : 1;
};

/**
 * Format a "HH:mm(:ss)" value as "h:mm AM" (for display).
 */
export const fmtTimeIST = (v: string | null | undefined): string => {
  if (!v) return "--:--";
  const [h, m] = v.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
};
