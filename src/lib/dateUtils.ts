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
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(", ", "T");
};

export const toLocalStr = (date: Date): string => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

export const startOfMonthIST = (date: Date = new Date()): string => {
  const istDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const y = istDate.getFullYear();
  const m = istDate.getMonth();
  return `${y}-${String(m + 1).padStart(2, "0")}-01`;
};

export const endOfMonthIST = (date: Date = new Date()): string => {
  const istDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const y = istDate.getFullYear();
  const m = istDate.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
};

export const parseISTDate = (dateStr: string): Date => {
  // Assuming dateStr is YYYY-MM-DD
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
};
