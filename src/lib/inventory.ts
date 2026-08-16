// ─── Inventory shared helpers (DRY) ───────────────────────────────────────────
// Stock is derived, not stored: available = sum(inventory_list.quantity)
// − sum(transaction_products.qty for non-cancelled jobs) − sum(direct_sale_items.qty).
// These helpers keep that formula + status thresholds consistent everywhere.

export const DEFAULT_ALERT_QTY = 5;

/** Effective low-stock threshold for a product (per-product alert_quantity, fallback 5). */
export const alertThreshold = (alertQty?: number | null) => Math.max(1, alertQty || DEFAULT_ALERT_QTY);

export type StockStatus = "out" | "low" | "ok";

/** Classify stock level against a product's alert threshold. */
export const stockStatus = (available: number, alertQty?: number | null): StockStatus => {
  if (available <= 0) return "out";
  if (available <= alertThreshold(alertQty)) return "low";
  return "ok";
};

export interface StockStatusStyle {
  label: string;
  short: string;
  color: string;
  bg: string;
  bar: string;
  glow: string;
}

/** Tailwind styles for a stock status — single source of truth for list + detail. */
export const stockStatusStyle = (available: number, alertQty?: number | null): StockStatusStyle => {
  const status = stockStatus(available, alertQty);
  if (status === "out")  return { label: "Out of Stock", short: "OUT", color: "text-red-400",     bg: "bg-red-500/10 border-red-500/25",     bar: "bg-red-500",     glow: "shadow-red-500/20"   };
  if (status === "low")  return { label: "Low Stock",    short: "LOW", color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/25", bar: "bg-amber-400",   glow: "shadow-amber-500/20" };
  return                       { label: "In Stock",     short: "OK",  color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25", bar: "bg-emerald-500", glow: "shadow-emerald-500/20" };
};

/** Stock bar color for a progress bar. */
export const stockBarColor = (available: number, alertQty?: number | null): string => {
  const status = stockStatus(available, alertQty);
  if (status === "out") return "bg-red-500";
  if (status === "low") return "bg-amber-400";
  return "bg-emerald-500";
};

/**
 * Aggregate raw rows into a per-product stock summary.
 * @param stockIn  rows from inventory_list (product_id, quantity, place?)
 * @param soldJob  rows from transaction_products already filtered to non-cancelled (product_id, qty)
 * @param soldSale rows from direct_sale_items (product_id, qty)
 */
export const aggregateStock = (
  stockIn: { product_id: number; quantity: number; place?: string | null }[],
  soldJob: { product_id: number; qty: number }[],
  soldSale: { product_id: number; qty: number }[],
) => {
  const inMap = new Map<number, { qty: number; place: string | null }>();
  stockIn.forEach(r => {
    const prev = inMap.get(r.product_id) || { qty: 0, place: null };
    inMap.set(r.product_id, { qty: prev.qty + (r.quantity || 0), place: r.place || prev.place });
  });
  const jobMap = new Map<number, number>();
  soldJob.forEach(r => jobMap.set(r.product_id, (jobMap.get(r.product_id) || 0) + (r.qty || 0)));
  const saleMap = new Map<number, number>();
  soldSale.forEach(r => saleMap.set(r.product_id, (saleMap.get(r.product_id) || 0) + (r.qty || 0)));

  const ids = new Set<number>([...inMap.keys(), ...jobMap.keys(), ...saleMap.keys()]);
  return [...ids].map(id => {
    const totalIn = inMap.get(id)?.qty || 0;
    const totalSold = (jobMap.get(id) || 0) + (saleMap.get(id) || 0);
    const available = totalIn - totalSold;
    return {
      product_id: id,
      total_in: totalIn,
      total_sold: totalSold,
      available,
      oversold: Math.max(0, -available),
      place: inMap.get(id)?.place || null,
    };
  });
};

/** Monetary stock value at a given per-unit price (0 when none available). */
export const stockValue = (available: number, price?: number | null) =>
  available > 0 ? available * (price || 0) : 0;
