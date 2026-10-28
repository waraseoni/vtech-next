import { getAdminSupabase } from "@/lib/admin-supabase";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import { isTrackingEnforced, verifyTrackingToken } from "@/lib/tracking-token";

const supabase = getAdminSupabase();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;
const ID_RE = /^[A-Za-z0-9-]{1,64}$/;

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
};

function json(body: unknown, status = 200, extra?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: { ...RESPONSE_HEADERS, ...extra },
  });
}

export async function GET(request: NextRequest) {
  const ip = clientIpFromHeaders(request.headers);
  const limit = rateLimit(`tracking:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.ok) {
    return json({ error: "Bahut zyada requests — thodi der baad try karein." }, 429, {
      "Retry-After": String(limit.retryAfter),
    });
  }

  const url = new URL(request.url);
  const jobId = url.searchParams.get("job_id")?.trim();
  const code = url.searchParams.get("code")?.trim();
  const token = url.searchParams.get("token")?.trim() || null;

  // Global "recent jobs" list was a cross-customer leak. The page now keeps
  // lookups in localStorage instead.
  if (url.searchParams.get("recent")) {
    return json({ error: "Recent list hata diya gaya hai." }, 410);
  }

  if (!jobId && !code) {
    return json({ error: "job_id ya code required" }, 400);
  }
  if ((jobId && !ID_RE.test(jobId)) || (code && !ID_RE.test(code))) {
    return json({ error: "Invalid job_id ya code" }, 400);
  }

  let query = supabase
    .from("transaction_list")
    .select("id, job_id, code, item, fault, remark, status, amount, date_created")
    .limit(1);

  if (jobId) query = query.eq("job_id", jobId);
  else query = query.eq("code", code);

  const { data: txnData, error: txnErr } = await query;

  if (txnErr) {
    logger.error("public/job-status lookup failed:", txnErr.message);
    return json({ error: "Job status fetch nahi ho paya." }, 500);
  }
  if (!txnData || txnData.length === 0) {
    return json({ job: null, services: [], products: [], limited: false });
  }

  const txn = txnData[0];
  const tokenOk = verifyTrackingToken(txn.job_id, txn.code, token);
  const full = !isTrackingEnforced() || tokenOk;

  if (!full) {
    return json({
      job: {
        id: txn.id,
        job_id: txn.job_id,
        code: txn.code,
        item: txn.item,
        fault: txn.fault,
        status: txn.status,
        date_created: txn.date_created,
      },
      services: [],
      products: [],
      limited: true,
    });
  }

  const { data: svcData } = await supabase
    .from("transaction_services")
    .select("service_id, price")
    .eq("transaction_id", txn.id);

  const serviceIds = (svcData || []).map((s) => s.service_id).filter(Boolean);
  const serviceNames: Record<number, string> = {};
  if (serviceIds.length > 0) {
    const { data: services } = await supabase
      .from("service_list")
      .select("id, name")
      .in("id", serviceIds);
    if (services)
      services.forEach((s) => {
        serviceNames[s.id] = s.name;
      });
  }

  const services = (svcData || []).map((s) => ({
    service_name: serviceNames[s.service_id] || "Unknown",
    price: s.price,
  }));

  const { data: prodData } = await supabase
    .from("transaction_products")
    .select("product_id, product_name, qty, price")
    .eq("transaction_id", txn.id);

  const productIds = (prodData || []).map((p) => p.product_id).filter(Boolean);
  const productNames: Record<number, string> = {};
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from("product_list")
      .select("id, name")
      .in("id", productIds);
    if (products)
      products.forEach((p) => {
        productNames[p.id] = p.name;
      });
  }

  const products = (prodData || []).map((p) => ({
    product_name: p.product_name || productNames[p.product_id] || "Unknown",
    qty: p.qty,
    price: p.price,
    total: p.qty * p.price,
  }));

  return json({ job: txn, services, products, limited: false });
}
