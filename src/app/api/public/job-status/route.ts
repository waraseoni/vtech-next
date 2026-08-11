import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("job_id")?.trim();
  const code = url.searchParams.get("code")?.trim();
  const recent = url.searchParams.get("recent");

  if (recent === "1") {
    const { data, error } = await supabase
      .from("transaction_list")
      .select("id, job_id, code, item, status, date_created")
      .order("id", { ascending: false })
      .limit(10);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ recent: data || [] });
  }

  if (!jobId && !code) {
    return NextResponse.json({ error: "job_id ya code required" }, { status: 400 });
  }

  let query = supabase
    .from("transaction_list")
    .select("id, job_id, code, item, fault, remark, status, amount, date_created")
    .limit(1);

  if (jobId) query = query.eq("job_id", jobId);
  else query = query.eq("code", code);

  const { data: txnData, error: txnErr } = await query;

  if (txnErr) return NextResponse.json({ error: txnErr.message }, { status: 500 });
  if (!txnData || txnData.length === 0) {
    return NextResponse.json({ job: null, services: [], products: [] });
  }

  const txn = txnData[0];

  const { data: svcData } = await supabase
    .from("transaction_services")
    .select("service_id, price")
    .eq("transaction_id", txn.id);

  const serviceIds = (svcData || []).map((s) => s.service_id).filter(Boolean);
  const serviceNames: Record<number, string> = {};
  if (serviceIds.length > 0) {
    const { data: services } = await supabase.from("service_list").select("id, name").in("id", serviceIds);
    if (services) services.forEach((s) => { serviceNames[s.id] = s.name; });
  }

  const services = (svcData || []).map((s) => ({
    service_name: serviceNames[s.service_id] || "Unknown",
    price: s.price,
  }));

  const { data: prodData } = await supabase
    .from("transaction_products")
    .select("product_id, qty, price")
    .eq("transaction_id", txn.id);

  const productIds = (prodData || []).map((p) => p.product_id).filter(Boolean);
  const productNames: Record<number, string> = {};
  if (productIds.length > 0) {
    const { data: products } = await supabase.from("product_list").select("id, name").in("id", productIds);
    if (products) products.forEach((p) => { productNames[p.id] = p.name; });
  }

  const products = (prodData || []).map((p) => ({
    product_name: productNames[p.product_id] || "Unknown",
    qty: p.qty,
    price: p.price,
    total: p.qty * p.price,
  }));

  return NextResponse.json({ job: txn, services, products });
}
