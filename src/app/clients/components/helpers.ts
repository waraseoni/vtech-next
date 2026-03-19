export const toNum = (v: unknown) => { const x = Number(v); return isNaN(x) ? 0 : x; };
export const inr   = (v: number) => "₹" + Math.abs(v).toLocaleString("en-IN", { minimumFractionDigits: 2 });
export const daysSince = (d: string | null) =>
  d ? Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000) : 999;

export function getBalanceMeta(balance: number, lastTxnDate: string | null) {
  if (balance > 50_000) return {
    rowCls: "dark:border-l-[3px] border-l-2 dark:border-red-500 border-red-400 dark:bg-red-500/5 bg-red-500/10",
    badge:  "dark:bg-red-500/20 bg-red-500/10 dark:text-red-400 text-red-600 dark:border-red-500/30 border-red-400/50",
    dot: "bg-red-500", label: "Very High", waType: "reminder",
  };
  if (balance > 20_000) return {
    rowCls: "dark:border-l-[3px] border-l-2 dark:border-orange-400 border-orange-400 dark:bg-orange-400/5 bg-orange-400/10",
    badge:  "dark:bg-orange-400/20 bg-orange-400/10 dark:text-orange-300 text-orange-600 dark:border-orange-400/30 border-orange-400/50",
    dot: "bg-orange-400", label: "High", waType: "reminder",
  };
  if (balance > 0) return {
    rowCls: "dark:border-l-[3px] border-l-2 dark:border-yellow-400 border-yellow-400 dark:bg-yellow-400/5 bg-yellow-400/10",
    badge:  "dark:bg-yellow-400/20 bg-yellow-400/10 dark:text-yellow-300 text-yellow-600 dark:border-yellow-400/30 border-yellow-400/50",
    dot: "bg-yellow-400", label: "Pending", waType: "reminder",
  };
  if (daysSince(lastTxnDate) > 30) return {
    rowCls: "",
    badge:  "dark:bg-teal-400/20 bg-teal-400/10 dark:text-teal-300 text-teal-600 dark:border-teal-400/30 border-teal-400/50",
    dot: "bg-teal-400", label: "Follow-up", waType: "followup",
  };
  return {
    rowCls: "",
    badge:  "dark:bg-emerald-400/20 bg-emerald-400/10 dark:text-emerald-300 text-emerald-600 dark:border-emerald-400/30 border-emerald-400/50",
    dot: "bg-emerald-400", label: "Clear", waType: "welcome",
  };
}