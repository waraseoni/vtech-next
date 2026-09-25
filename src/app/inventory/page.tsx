// ─── Sprint 4 #17 (SSR): inventory list server-rendered ────────────────────
// Pehla data server se aata hai (products + PO links/codes + stock RPC +
// role). Service-role wali locations (`places` column) RLS-anon ko blocked
// hain — wo client par mount-merge hoti hain (progressive, layout same).
// Admin-only guard bhi server par (client wala denied UI mirror).
import { ShieldCheck } from "lucide-react";
import { getServerSupabase } from "@/lib/api-auth";
import { stockValue } from "@/lib/inventory";
import { InventoryClient, type ProductStock } from "./InventoryClient";

function Denied() {
  return (
    <div className="min-h-screen bg-app flex items-center justify-center px-6">
      <div className="text-center">
        <ShieldCheck size={40} className="text-app mx-auto mb-3" />
        <h1 className="text-lg font-black text-white tracking-tight">Admin only</h1>
        <p className="text-muted-2 text-sm mt-1">
          Stock Overview sirf admin dekh sakta hai.
        </p>
      </div>
    </div>
  );
}

export default async function InventoryPage() {
  const supabase = await getServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role = "staff";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = profile?.role ?? "staff";
  }
  if (role !== "admin" && role !== "developer") return <Denied />;

  const { data: pl } = await supabase
    .from("product_list")
    .select("id, name, description, cost_price, price, image_path, alert_quantity, barcode")
    .eq("delete_flag", 0)
    .order("name");

  let products: ProductStock[] = [];
  if (pl?.length) {
    const ids = pl.map((p) => p.id);

    const [poLinkRes, stockRes] = await Promise.all([
      supabase
        .from("inventory_list")
        .select("product_id, purchase_order_id")
        .in("product_id", ids),
      supabase.rpc("get_inventory_stock", { p_product_ids: ids }),
    ]);

    // Stock rows normalize (lib/inventoryStock mirror — lib browser singleton
    // hai isliye server par import nahi ho sakta)
    const stockMap = new Map<
      number,
      { total_in: number; total_sold: number; available: number; oversold: number }
    >();
    for (const r of ((stockRes.data || []) as Record<string, unknown>[]) || []) {
      stockMap.set(Number(r.product_id ?? 0), {
        total_in: Number(r.total_in ?? 0),
        total_sold: Number(r.total_sold ?? 0),
        available: Number(r.available ?? 0),
        oversold: Number(r.oversold ?? 0),
      });
    }

    // Build PO-link map
    const poIdMap = new Map<number, Set<number>>();
    (poLinkRes.data || []).forEach((r) => {
      if (r.purchase_order_id) {
        const set = poIdMap.get(r.product_id) || new Set<number>();
        set.add(r.purchase_order_id);
        poIdMap.set(r.product_id, set);
      }
    });

    // Fetch PO codes for all referenced purchase orders
    const allPoIds = [...new Set([...poIdMap.values()].flatMap((s) => [...s]))];
    const poCodeMap = new Map<number, string>();
    if (allPoIds.length) {
      const { data: poRows } = await supabase
        .from("purchase_orders")
        .select("id, po_code")
        .in("id", allPoIds);
      (poRows || []).forEach((r: { id: number; po_code: string }) =>
        poCodeMap.set(r.id, r.po_code)
      );
    }

    products = pl.map((p) => {
      const sr = stockMap.get(p.id);
      const totalIn = sr?.total_in ?? 0;
      const totalSold = sr?.total_sold ?? 0;
      const available = sr?.available ?? 0;
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        cost_price: p.cost_price || 0,
        price: p.price || 0,
        image_path: p.image_path || null,
        barcode: p.barcode || null,
        alert_quantity: p.alert_quantity || 5,
        total_in: totalIn,
        total_sold: totalSold,
        available,
        oversold: sr?.oversold ?? 0,
        // places service-role se aate hain — client mount-merge karta hai
        place: null,
        places: [],
        poCodes: [...(poIdMap.get(p.id) || [])]
          .map((id) => poCodeMap.get(id))
          .filter(Boolean) as string[],
        stock_value: stockValue(available, p.price),
        cost_value: stockValue(available, p.cost_price),
        margin_pct:
          p.price && p.cost_price != null && p.price > 0
            ? Math.round(((p.price - (p.cost_price || 0)) / p.price) * 100)
            : 0,
      };
    });
  }

  return <InventoryClient initialProducts={products} initialRole={role} />;
}
