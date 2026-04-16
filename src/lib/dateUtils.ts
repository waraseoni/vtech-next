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
