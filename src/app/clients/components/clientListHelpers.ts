// Shared pure helpers + types for the Clients registry list.
// Client-side safe (no server/browser globals) — used by ClientsBody.tsx.

export type Client = {
  id: number;
  name: string;
  contact: string;
  email: string;
  address: string;
  date_created: string;
  opening_balance: number;
  repair_billed: number;
  direct_sales_billed: number;
  total_loan_given: number;
  total_paid: number;
  balance: number;
  last_txn_date: string | null;
  image_path?: string;
  login_allowed: boolean;
};

export const toNum = (v: unknown): number => {
  const x = Number(v);
  return Number.isNaN(x) ? 0 : x;
};

export const inr = (v: number): string =>
  "₹" + Math.abs(v).toLocaleString("en-IN", { minimumFractionDigits: 2 });

export const daysSince = (d: string | null): number =>
  d ? Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000) : 999;

type BalanceMeta = {
  rowCls: string;
  badge: string;
  dot: string;
  label: string;
  waType: "reminder" | "followup" | "welcome";
};

export function getBalanceMeta(balance: number, lastTxnDate: string | null): BalanceMeta {
  if (balance > 50_000)
    return {
      rowCls: "border-l-[3px] border-red-500 bg-red-500/5",
      badge: "bg-red-500/20 text-red-400 border-red-500/30",
      dot: "bg-red-500",
      label: "Very High",
      waType: "reminder",
    };
  if (balance > 20_000)
    return {
      rowCls: "border-l-[3px] border-orange-400 bg-orange-400/5",
      badge: "bg-orange-400/20 text-orange-300 border-orange-400/30",
      dot: "bg-orange-400",
      label: "High",
      waType: "reminder",
    };
  if (balance > 0)
    return {
      rowCls: "border-l-[3px] border-yellow-400 bg-yellow-400/5",
      badge: "bg-yellow-400/20 text-yellow-300 border-yellow-400/30",
      dot: "bg-yellow-400",
      label: "Pending",
      waType: "reminder",
    };
  if (daysSince(lastTxnDate) > 30)
    return {
      rowCls: "",
      badge: "bg-teal-400/20 text-teal-300 border-teal-400/30",
      dot: "bg-teal-400",
      label: "Follow-up",
      waType: "followup",
    };
  return {
    rowCls: "",
    badge: "bg-emerald-400/20 text-emerald-300 border-emerald-400/30",
    dot: "bg-emerald-400",
    label: "Clear",
    waType: "welcome",
  };
}
