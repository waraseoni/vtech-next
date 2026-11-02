import type { SupabaseClient } from "@supabase/supabase-js";

export type ProductSeedRow = {
  id: number;
  name: string;
  description: string;
  cost_price: number;
  price: number;
  hsn: string;
  barcode: string | null;
  alert_quantity: number;
  status: number;
  delete_flag: number;
  image_path?: string | null;
};

export async function fetchProductsSeed(supabase: SupabaseClient): Promise<ProductSeedRow[]> {
  const { data, error } = await supabase
    .from("product_list")
    .select(
      "id, name, description, cost_price, price, hsn, barcode, alert_quantity, status, delete_flag, image_path"
    )
    .eq("delete_flag", 0)
    .order("name");
  if (error) throw error;
  return (data || []) as ProductSeedRow[];
}
