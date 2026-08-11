"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft, Wrench, User, Clock,
  Package, Settings2, AlertTriangle, CheckCircle2,
  IndianRupee, Printer, Edit, Trash2,
  Loader2, Box,
  Banknote, Send,
  Plus, X, CheckCircle, FileText,
  RefreshCw, Image as ImageIcon,
} from "lucide-react";
import { substituteTemplate, firmVars } from "@/lib/whatsapp";
import { DEFAULT_TEMPLATES } from "@/lib/whatsappTemplates";

// ─── IST HELPERS ─────────────────────────────────────────────────────────────
function fmtDate(d: string | null) {
  if (!d) return "N/A";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(d));
}
function fmtDateTime(d: string | null) {
  if (!d) return "N/A";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(new Date(d));
}
function nowIST(): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => p.find(x => x.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:${g("second")}+05:30`;
}
function todayISTStr(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const p: Record<string, string> = {};
  parts.forEach(x => { p[x.type] = x.value; });
  return `${p.year}-${p.month}-${p.day}`;
}
// Convert ISO/DB date to YYYY-MM-DD for <input type="date">
function toDateInput(d: string | null): string {
  if (!d) return todayISTStr();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(d));
  const p: Record<string, string> = {};
  parts.forEach(x => { p[x.type] = x.value; });
  return `${p.year}-${p.month}-${p.day}`;
}

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface JobDetail {
  id: number; job_id: string; code: string; client_name: string;
  item: string; fault: string; remark: string; uniq_id: string;
  amount: number; mechanic_amount: number; mechanic_commission_amount: number;
  mechanic_id: number | null; user_id: number; del_status: number; status: number;
  date_created: string; date_updated: string; date_completed: string | null;
}
interface Client {
  id: number; firstname: string; middlename: string;
  lastname: string; contact: string; email: string; address: string;
}
interface Mechanic {
  id: number; firstname: string; middlename: string;
  lastname: string; designation: string; contact: string;
}
interface TransactionProduct {
  transaction_id: number; product_id: number;
  product_name: string | null; qty: number; price: number;
}
interface TransactionService {
  transaction_id: number; service_id: number;
  service_name: string | null; price: number;
}
interface TransactionImage {
  id: number; transaction_id: number; image_path: string; date_created: string;
}
type Toast = { type: "success" | "error" | "info"; msg: string };

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────
const STATUS_MAP: Record<number, {
  label: string; explanation: string;
  badgeColor: string; // Bootstrap-like color name for PHP-style badge
}> = {
  0: { label: "Pending",     explanation: "Kaam shuru nahi hua hai",             badgeColor: "secondary" },
  1: { label: "On-Progress", explanation: "Kaam chal raha hai, jald ready hoga", badgeColor: "primary"   },
  2: { label: "Done",        explanation: "Kaam pura ho gaya hai",               badgeColor: "info"      },
  3: { label: "Paid",        explanation: "Bill chuka diya gaya hai",            badgeColor: "success"   },
  4: { label: "Cancelled",   explanation: "Transaction radd kar diya gaya hai",  badgeColor: "danger"    },
  5: { label: "Delivered",   explanation: "Aapko item mil chuka hai",            badgeColor: "warning"   },
};

// PHP-style badge colors mapped to Tailwind
const BADGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  secondary: { bg: "bg-slate-600",   text: "text-white", border: "border-slate-700"  },
  primary:   { bg: "bg-blue-600",   text: "text-white", border: "border-blue-700"  },
  info:      { bg: "bg-cyan-500",   text: "text-white", border: "border-cyan-600"  },
  success:   { bg: "bg-green-600",  text: "text-white", border: "border-green-700" },
  danger:    { bg: "bg-red-600",    text: "text-white", border: "border-red-700"   },
  warning:   { bg: "bg-yellow-500", text: "text-gray-900", border: "border-yellow-600" },
};

const DEL_STATUS: Record<number, string> = { 0: "In Shop", 1: "Delivered" };
const FIRM = { name: "V-Technologies", contact: "9179105875", address: "Jabalpur", owner: "Vikram Jain" };

// Job status → WhatsApp template key (PHP: pending=0, repairing=1, ready=2, delivered=3/5, cancelled=4)
const STATUS_WA_KEY: Record<number, string> = {
  0: "whatsapp_status_pending",
  1: "whatsapp_status_repairing",
  2: "whatsapp_status_ready",
  3: "whatsapp_status_delivered",
  4: "whatsapp_status_cancelled",
  5: "whatsapp_status_delivered",
};
const WA_FALLBACK = (st: number) => DEFAULT_TEMPLATES[STATUS_WA_KEY[st]] || DEFAULT_TEMPLATES.whatsapp_status_pending;

// ─── FIELDSET COMPONENT (PHP jaisi styling) ───────────────────────────────────
function Fieldset({ title, icon: Icon, children, color = "primary" }: {
  title: string; icon?: React.ElementType; children: React.ReactNode; color?: "primary" | "success" | "info" | "danger";
}) {
  const colors = {
    primary: "text-blue-400 border-blue-500/30",
    success: "text-emerald-400 border-emerald-500/30",
    info:    "text-cyan-400 border-cyan-500/30",
    danger:  "text-red-400 border-red-500/30",
  };
  return (
    <fieldset className={`border-2 ${colors[color].split(" ")[1]} rounded-lg bg-[#111520] mb-4`}>
      <legend className={`px-3 py-1 text-sm font-bold ${colors[color].split(" ")[0]} ml-3 flex items-center gap-1.5`}>
        {Icon && <Icon size={14}/>}
        {title}
      </legend>
      <div className="px-4 pb-4 pt-1">{children}</div>
    </fieldset>
  );
}

// ─── INFO ROW ─────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-sm">
      <span className="font-semibold text-slate-500">{label}:</span>{" "}
      <span className="text-slate-200">{value}</span>
    </p>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function JobDetailsPage() {
  const params  = useParams();
  const router  = useRouter();
  const jobId   = params.id as string;

  const [job,      setJob]      = useState<JobDetail | null>(null);
  const [client,   setClient]   = useState<Client | null>(null);
  const [mechanic, setMechanic] = useState<Mechanic | null>(null);
  const [products, setProducts] = useState<TransactionProduct[]>([]);
  const [services, setServices] = useState<TransactionService[]>([]);
  const [images,   setImages]   = useState<TransactionImage[]>([]);
  const [userRole, setUserRole] = useState<string>("staff");
  const [loading,  setLoading]  = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [toast,    setToast]    = useState<Toast | null>(null);
  const [firmInfo, setFirmInfo] = useState<Record<string, string>>({});

  // Status modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus,       setNewStatus]       = useState(0);
  const [deliveryDate,    setDeliveryDate]    = useState("");  // for Delivered status
  const [deliveryTime,    setDeliveryTime]    = useState("");  // HH:MM
  const [updatingStatus,  setUpdatingStatus]  = useState(false);

  // Payment modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount,    setPayAmount]    = useState("");
  const [payDiscount,  setPayDiscount]  = useState("0");
  const [payMode,      setPayMode]      = useState("Cash");
  const [payRemarks,   setPayRemarks]   = useState("");
  const [savingPay,    setSavingPay]    = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── FETCH ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const numId = Number(jobId?.trim());
      if (!jobId || isNaN(numId) || numId <= 0) { router.push("/jobs"); return; }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        setUserRole(p?.role || "staff");
      }

      // Firm info + WhatsApp templates (system_info key-value)
      const { data: sys } = await supabase.from("system_info").select("meta_field, meta_value");
      const info: Record<string, string> = {};
      (sys || []).forEach(r => { info[r.meta_field] = r.meta_value; });
      setFirmInfo(info);

      const { data: jobData, error: jobErr } = await supabase
        .from("transaction_list").select("*")
        .eq("id", numId).eq("del_status", 0).single();

      if (jobErr || !jobData) { router.push("/jobs"); return; }
      setJob(jobData as JobDetail);
      setNewStatus(jobData.status);
      // Pre-fill delivery date
      setDeliveryDate(toDateInput(jobData.date_completed));
      setDeliveryTime(jobData.date_completed
        ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(jobData.date_completed))
        : new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()));

      const clientId = Number(jobData.client_name);
      const [clientRes, mechRes, prodRes, svcRes, imgRes] = await Promise.all([
        supabase.from("client_list")
          .select("id, firstname, middlename, lastname, contact, email, address")
          .eq("id", clientId).single(),
        jobData.mechanic_id
          ? supabase.from("mechanic_list")
              .select("id, firstname, middlename, lastname, designation, contact")
              .eq("id", jobData.mechanic_id).single()
          : Promise.resolve({ data: null }),
        supabase.from("transaction_products").select("*").eq("transaction_id", numId),
        supabase.from("transaction_services").select("*").eq("transaction_id", numId),
        supabase.from("transaction_images").select("*").eq("transaction_id", numId)
          .order("date_created", { ascending: false }),
      ]);

      if (clientRes.data) setClient(clientRes.data as Client);
      if (mechRes.data)   setMechanic(mechRes.data as Mechanic);
      setImages((imgRes.data || []) as TransactionImage[]);

      const prods = (prodRes.data || []) as TransactionProduct[];
      const missingPIds = prods.filter(p => !p.product_name).map(p => p.product_id);
      if (missingPIds.length > 0) {
        const { data: pn } = await supabase.from("product_list").select("id, name").in("id", missingPIds);
        const pm = Object.fromEntries((pn || []).map(p => [p.id, p.name]));
        setProducts(prods.map(p => ({ ...p, product_name: p.product_name || pm[p.product_id] || null })));
      } else { setProducts(prods); }

      const svcs = (svcRes.data || []) as TransactionService[];
      const missingSIds = svcs.filter(s => !s.service_name).map(s => s.service_id);
      if (missingSIds.length > 0) {
        const { data: sn } = await supabase.from("service_list").select("id, name").in("id", missingSIds);
        const sm = Object.fromEntries((sn || []).map(s => [s.id, s.name]));
        setServices(svcs.map(s => ({ ...s, service_name: s.service_name || sm[s.service_id] || null })));
      } else { setServices(svcs); }

    } catch (err) { console.error("fetchData:", err); }
    finally { setLoading(false); }
  }, [jobId, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── WHATSAPP ───────────────────────────────────────────────────────────────
  const sendWA = () => {
    if (!job || !client) return;
    const phone = client.contact?.replace(/\D/g, "");
    if (!phone || phone.length < 10) { setToast({ type: "error", msg: "Valid mobile number nahi mila!" }); return; }
    const name = [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ");
    const amt  = (job.amount || 0).toLocaleString("en-IN");
    const key  = STATUS_WA_KEY[job.status] || "whatsapp_status_pending";
    const tpl  = firmInfo[key] || WA_FALLBACK(job.status);
    const msg  = substituteTemplate(tpl, {
      client_name: name,
      item: job.item,
      job_id: job.job_id,
      code: job.code,
      amount: `₹${amt}`,
      ...firmVars(firmInfo),
    });
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // ── UPDATE STATUS ──────────────────────────────────────────────────────────
  const handleStatusUpdate = async () => {
    if (!job) return;
    setUpdatingStatus(true);
    const updates: Record<string, unknown> = {
      status: newStatus,
      date_updated: nowIST(),
    };
    // Delivery date: use user-provided date+time when status = 5
    if (newStatus === 5) {
      const dateStr = deliveryDate || todayISTStr();
      const timeStr = deliveryTime || "00:00";
      // Combine date + time with IST offset
      updates.date_completed = `${dateStr}T${timeStr}:00+05:30`;
    }
    const { error } = await supabase.from("transaction_list").update(updates).eq("id", job.id);
    if (error) {
      setToast({ type: "error", msg: "Status update failed: " + error.message });
    } else {
      setJob({ ...job, ...updates } as JobDetail);
      setToast({ type: "success", msg: `Status "${STATUS_MAP[newStatus]?.label}" update ho gaya!` });
      setShowStatusModal(false);
    }
    setUpdatingStatus(false);
  };

  // ── ADD PAYMENT ────────────────────────────────────────────────────────────
  const handleAddPayment = async () => {
    if (!client || !job) return;
    const amt  = parseFloat(payAmount);
    const disc = parseFloat(payDiscount) || 0;
    if (isNaN(amt) || amt <= 0) { setToast({ type: "error", msg: "Valid amount enter karo!" }); return; }
    setSavingPay(true);
    const { error } = await supabase.from("client_payments").insert({
      client_id: client.id, job_id: job.job_id,
      amount: amt, discount: disc,
      payment_mode: payMode,
      remarks: payRemarks.trim() || null,
      payment_date: `${todayISTStr()}T00:00:00+05:30`,
    });
    if (error) { setToast({ type: "error", msg: "Payment save nahi hua: " + error.message }); }
    else {
      setToast({ type: "success", msg: "Payment save ho gayi!" });
      setShowPayModal(false);
      setPayAmount(""); setPayDiscount("0"); setPayRemarks("");
    }
    setSavingPay(false);
  };

  // ── DELETE ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (userRole !== "admin") { setToast({ type: "error", msg: "Sirf Admin delete kar sakta hai!" }); return; }
    if (!confirm("Kya aap pakka is job ko delete karna chahte hain?")) return;
    setDeleting(true);
    const { error } = await supabase.from("transaction_list").update({ del_status: 1 }).eq("id", jobId);
    if (!error) router.push("/jobs");
    else { setToast({ type: "error", msg: "Delete failed!" }); setDeleting(false); }
  };

  // ── PRINT ──────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!job) return;
    const svcHtml = services.length > 0
      ? `<table border="1" style="border-collapse:collapse;width:100%;margin:8px 0"><thead><tr style="background:#001f3f;color:#fff"><th style="padding:6px">Service</th><th style="padding:6px;text-align:right">Price</th></tr></thead><tbody>${services.map(s => `<tr><td style="padding:5px">${s.service_name || s.service_id}</td><td style="padding:5px;text-align:right">Rs.${s.price.toFixed(2)}</td></tr>`).join("")}</tbody></table>` : "";
    const prodHtml = products.length > 0
      ? `<table border="1" style="border-collapse:collapse;width:100%;margin:8px 0"><thead><tr style="background:#001f3f;color:#fff"><th style="padding:6px">Product</th><th style="padding:6px;text-align:center">Qty</th><th style="padding:6px;text-align:right">Price</th><th style="padding:6px;text-align:right">Total</th></tr></thead><tbody>${products.map(p => `<tr><td style="padding:5px">${p.product_name || p.product_id}</td><td style="padding:5px;text-align:center">${p.qty}</td><td style="padding:5px;text-align:right">Rs.${p.price.toFixed(2)}</td><td style="padding:5px;text-align:right">Rs.${(p.qty*p.price).toFixed(2)}</td></tr>`).join("")}</tbody></table>` : "";
    const win = window.open("", `Bill_${job.job_id}`, "width=900,height=700");
    if (!win) { alert("Popup blocked! Browser mein allow karo."); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Job Bill - ${job.job_id}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:13px;color:#333;padding:20px}
h1{font-size:18px;font-weight:900;color:#001f3f;margin-bottom:2px}h2{font-size:12px;color:#555;margin-bottom:10px}
hr{border:1px solid #001f3f;margin:8px 0}.total{font-size:16px;font-weight:900;margin-top:12px;color:#155724}
@page{margin:1cm;size:A4}</style></head><body>
<h1>${firmInfo.name || FIRM.name}</h1><h2>${firmInfo.owner || FIRM.owner} | ${firmInfo.address || FIRM.address} | ${firmInfo.contact || FIRM.contact}</h2><hr/>
<p><b>Job ID:</b> ${job.job_id}&nbsp;&nbsp;<b>Code:</b> ${job.code}&nbsp;&nbsp;<b>Status:</b> ${STATUS_MAP[job.status]?.label}</p>
<p><b>Client:</b> ${[client?.firstname, client?.middlename, client?.lastname].filter(Boolean).join(" ")}&nbsp;&nbsp;<b>Contact:</b> ${client?.contact || ""}</p>
<p><b>Item:</b> ${job.item}&nbsp;&nbsp;<b>Fault:</b> ${job.fault}</p>
<p><b>Mechanic:</b> ${mechanic ? [mechanic.firstname, mechanic.middlename, mechanic.lastname].filter(Boolean).join(" ") : "N/A"}&nbsp;&nbsp;<b>Date:</b> ${fmtDate(job.date_created)}</p>
${job.date_completed ? `<p><b>Delivered:</b> ${fmtDateTime(job.date_completed)}</p>` : ""}
${svcHtml}${prodHtml}
<p class="total">Total Bill Amount: Rs.${job.amount.toLocaleString("en-IN", { minimumFractionDigits:2 })}</p>
</body></html>`);
    win.document.close();
    win.onload = () => { win.print(); win.onafterprint = () => win.close(); };
    setTimeout(() => { if (win && !win.closed) { win.print(); win.onafterprint = () => win.close(); } }, 800);
  };

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center gap-3">
      <Loader2 className="animate-spin text-blue-700" size={40}/>
      <p className="text-slate-500 font-medium uppercase tracking-widest text-sm animate-pulse">
        Loading Transaction Details...
      </p>
    </div>
  );
  if (!job) return null;

  const st         = STATUS_MAP[job.status] || STATUS_MAP[0];
  const badge      = BADGE_COLORS[st.badgeColor];
  const clientName = client
    ? [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ")
    : `Client #${job.client_name}`;
  const mechName   = mechanic
    ? [mechanic.firstname, mechanic.middlename, mechanic.lastname].filter(Boolean).join(" ")
    : null;
  const productsTotal = products.reduce((s, p) => s + p.price * p.qty, 0);
  const servicesTotal = services.reduce((s, s2) => s + s2.price, 0);

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d1117] font-sans">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border text-sm font-semibold ${
          toast.type === "success" ? "bg-green-50 border-green-300 text-green-800"
          : toast.type === "info"  ? "bg-blue-50 border-blue-300 text-blue-800"
          : "bg-red-50 border-red-300 text-red-800"
        }`}>
          {toast.type === "success" ? <CheckCircle size={16}/> : <AlertTriangle size={16}/>}
          {toast.msg}
        </div>
      )}

      {/* ── PAGE CONTENT ─────────────────────────────────────────────────────── */}
      <div className="py-4 px-3 md:px-6 text-slate-200">
        <div className="max-w-5xl mx-auto">

          {/* Card */}
          <div className="bg-[#161b27] rounded shadow-sm border border-[#21293d]">

            {/* Card Header — PHP style navy */}
            <div className="bg-[#0d1f35] text-white rounded-t px-4 py-3 flex items-center justify-between flex-wrap gap-2 border-b border-[#21293d]">
              <h5 className="font-bold text-base flex items-center gap-2 m-0">
                <FileText size={16}/>
                Transaction Details — {job.job_id} ({job.code})
              </h5>
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/clients/${job.client_name}/view`}
                  className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1.5 rounded text-xs font-semibold no-underline transition-colors">
                  <User size={12}/> View Client
                </Link>
                <Link href={`/api/print-bill?job_id=${job.job_id}&bill_type=gst`} target="_blank"
                  className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs font-semibold no-underline transition-colors">
                  <FileText size={12}/> GST Bill
                </Link>
                <button onClick={handlePrint}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors">
                  <Printer size={12}/> Print Bill
                </button>
                <button onClick={() => router.back()}
                  className="flex items-center gap-1.5 bg-slate-600 hover:bg-slate-700 text-white border border-slate-500 px-3 py-1.5 rounded text-xs font-semibold transition-colors">
                  <ArrowLeft size={12}/> Back
                </button>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-4 text-slate-200">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                {/* ── LEFT COLUMN (7/12) ─────────────────────────────────── */}
                <div className="lg:col-span-7 lg:border-r lg:border-[#21293d] lg:pr-4">

                  {/* Client + Job Info row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">

                    {/* Client Info */}
                    <Fieldset title="Client Information" icon={User} color="primary">
                      <InfoRow label="Name"
                        value={
                          <Link href={`/clients/${job.client_name}/view`}
                            className="text-blue-400 font-semibold hover:underline">
                            {clientName}
                          </Link>
                        }/>
                      {client?.contact && (
                        <InfoRow label="Contact"
                          value={<a href={`tel:${client.contact}`} className="text-blue-400">{client.contact}</a>}/>
                      )}
                      {client?.address && <InfoRow label="Address" value={<span className="text-slate-400 text-xs">{client.address}</span>}/>}
                      {client?.email && <InfoRow label="Email" value={<span className="text-slate-400 text-xs">{client.email}</span>}/>}
                    </Fieldset>

                    {/* Job Details */}
                    <Fieldset title="Job Details" icon={Wrench} color="info">
                      <InfoRow label="Mechanic" value={mechName || <em className="text-slate-600">Not Assigned</em>}/>
                      <InfoRow label="Received" value={fmtDateTime(job.date_created)}/>
                      <InfoRow label="Job No." value={<span className="font-bold">{job.job_id}</span>}/>
                      <InfoRow label="Code"    value={<span className="font-bold font-mono">{job.code}</span>}/>
                      <InfoRow label="Locate"  value={job.uniq_id || <em className="text-slate-600">N/A</em>}/>
                      <InfoRow label="Del. Status" value={DEL_STATUS[job.del_status]}/>
                    </Fieldset>
                  </div>

                  {/* Item Description */}
                  <Fieldset title="Item Description" icon={Box} color="primary">
                    <InfoRow label="Item / Model" value={<span className="font-semibold">{job.item}</span>}/>
                    <div className="mb-1.5 text-sm">
                      <span className="font-semibold text-slate-500">Fault Reported:</span>
                      <p className="mt-0.5 text-slate-300 whitespace-pre-line">{job.fault}</p>
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-slate-500">Remarks:</span>
                      <p className="mt-0.5 text-slate-400 whitespace-pre-line">
                        {job.remark?.trim() || <em className="text-slate-600">No remarks</em>}
                      </p>
                    </div>
                  </Fieldset>

                  {/* Services */}
                  {services.length > 0 && (
                    <Fieldset title="Services Availed" icon={Settings2} color="primary">
                      <div className="overflow-x-auto">
                        <table className="w-full border border-[#21293d] text-sm">
                          <thead className="bg-[#0d1f35] text-slate-300">
                            <tr>
                              <th className="px-3 py-2 text-left">Service</th>
                              <th className="px-3 py-2 text-right">Charge</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#21293d]">
                            {services.map((s, i) => (
                              <tr key={i} className={i % 2 === 0 ? "bg-[#111520]" : "bg-[#161b27]"}>
                                <td className="px-3 py-2 text-slate-300">{s.service_name || `Service #${s.service_id}`}</td>
                                <td className="px-3 py-2 text-right font-medium text-slate-200">Rs.{s.price.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-[#0d1117] font-bold border-t border-[#21293d]">
                            <tr>
                              <td className="px-3 py-2 text-right text-sm text-slate-500">Services Total:</td>
                              <td className="px-3 py-2 text-right text-emerald-400">Rs.{servicesTotal.toFixed(2)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </Fieldset>
                  )}

                  {/* Products */}
                  {products.length > 0 && (
                    <Fieldset title="Products Used" icon={Package} color="success">
                      <div className="overflow-x-auto">
                        <table className="w-full border border-[#21293d] text-sm">
                          <thead className="bg-emerald-900/50 text-emerald-300">
                            <tr>
                              <th className="px-3 py-2 text-left">Product</th>
                              <th className="px-3 py-2 text-center">Qty</th>
                              <th className="px-3 py-2 text-right">Price</th>
                              <th className="px-3 py-2 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#21293d]">
                            {products.map((p, i) => (
                              <tr key={i} className={i % 2 === 0 ? "bg-[#111520]" : "bg-[#161b27]"}>
                                <td className="px-3 py-2 text-slate-300">{p.product_name || `Product #${p.product_id}`}</td>
                                <td className="px-3 py-2 text-center text-slate-400">{p.qty}</td>
                                <td className="px-3 py-2 text-right text-slate-400">Rs.{p.price.toFixed(2)}</td>
                                <td className="px-3 py-2 text-right font-medium text-slate-200">Rs.{(p.qty * p.price).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-[#0d1117] font-bold border-t border-[#21293d]">
                            <tr>
                              <td colSpan={3} className="px-3 py-2 text-right text-sm text-slate-500">Products Total:</td>
                              <td className="px-3 py-2 text-right text-emerald-400">Rs.{productsTotal.toFixed(2)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </Fieldset>
                  )}
                </div>

                {/* ── RIGHT COLUMN (5/12) ────────────────────────────────── */}
                <div className="lg:col-span-5">

                  {/* Current Status — PHP style big badge */}
                  <div className="text-center mb-5">
                    <p className="text-slate-400 font-semibold text-sm mb-2">Current Job Status</p>
                    <span className={`inline-block px-8 py-4 rounded-sm shadow-sm font-black text-2xl ${badge.bg} ${badge.text} border ${badge.border}`}
                      style={{ minWidth: "90%" }}>
                      {st.label}
                    </span>
                    <p className="text-slate-500 text-sm mt-2 italic">{st.explanation}</p>
                    {job.status === 5 && job.date_completed && (
                      <div className="mt-3 text-emerald-400 border-t border-[#21293d] pt-3">
                        <CheckCircle2 className="inline mr-1" size={16}/>
                        <span className="font-semibold">Delivered On:</span><br/>
                        <span className="text-lg font-bold">{fmtDateTime(job.date_completed)}</span>
                      </div>
                    )}
                  </div>

                  {/* Item Photos */}
                  {images.length > 0 && (
                    <Fieldset title={`Item Photos (${images.length})`} icon={ImageIcon} color="primary">
                      <div className="grid grid-cols-3 gap-2">
                        {images.map((img) => (
                          <a key={img.id} href={img.image_path} target="_blank" rel="noreferrer">
                            <Image src={img.image_path} alt="Item"
                              width={640} height={80} unoptimized
                              className="w-full h-20 object-cover rounded border border-[#21293d] hover:opacity-80 transition-opacity cursor-pointer"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}/>
                          </a>
                        ))}
                      </div>
                    </Fieldset>
                  )}

                  {/* Billing Summary */}
                  <div className="border border-emerald-500/25 rounded bg-emerald-500/5 p-4 mb-4">
                    <h5 className="text-emerald-400 font-bold text-center mb-3">Billing Summary</h5>
                    {(services.length > 0 || products.length > 0) && (
                      <div className="mb-3 space-y-1">
                        {services.length > 0 && (
                          <div className="flex justify-between text-sm text-slate-500">
                            <span>Services ({services.length})</span>
                            <span>Rs.{servicesTotal.toFixed(2)}</span>
                          </div>
                        )}
                        {products.length > 0 && (
                          <div className="flex justify-between text-sm text-slate-500">
                            <span>Products ({products.length})</span>
                            <span>Rs.{productsTotal.toFixed(2)}</span>
                          </div>
                        )}
                        <hr className="border-emerald-500/20"/>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-b border-emerald-500/25 pb-2 mb-2">
                      <span className="font-medium text-sm text-slate-400">Total Amount:</span>
                      <span className="text-2xl font-black text-white">Rs.{job.amount.toFixed(2)}</span>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-black text-emerald-400">Rs.{job.amount.toFixed(2)}</p>
                      <p className="text-slate-500 text-xs mt-1">Final Payable Amount</p>
                    </div>
                    {(job.mechanic_amount > 0 || job.mechanic_commission_amount > 0) && (
                      <div className="mt-3 pt-3 border-t border-emerald-500/20 space-y-1">
                        {job.mechanic_amount > 0 && (
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>Mechanic Amount:</span><span>Rs.{job.mechanic_amount.toFixed(0)}</span>
                          </div>
                        )}
                        {job.mechanic_commission_amount > 0 && (
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>Commission:</span><span>Rs.{job.mechanic_commission_amount.toFixed(0)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* WhatsApp Button */}
                  <button onClick={sendWA}
                    className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded font-bold text-sm flex items-center justify-center gap-2 shadow-sm mb-4 transition-colors">
                    <Send size={16}/> Send Status on WhatsApp
                  </button>

                  {/* Activity Timeline */}
                  <Fieldset title="Activity Timeline" icon={Clock} color="info">
                    <div className="space-y-0">
                      {/* Job Created */}
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-blue-500/20 border-2 border-blue-500/50 flex items-center justify-center">
                            <Plus size={14} className="text-blue-400" />
                          </div>
                          {true && <div className="w-px flex-1 bg-[#21293d] mt-1" />}
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="text-sm text-slate-300 font-medium">Job Created</p>
                          <p className="text-xs text-slate-500">{fmtDateTime(job.date_created)}</p>
                        </div>
                      </div>

                      {/* Status based activities */}
                      {[1, 2, 3, 4, 5].filter(s => s <= job.status).map((s, idx) => {
                        const statusLabels: Record<number, { label: string; icon: React.ReactNode; color: string }> = {
                          1: { label: "Marked On-Progress", icon: <Settings2 size={12} />, color: "blue" },
                          2: { label: "Marked Done", icon: <CheckCircle size={12} />, color: "teal" },
                          3: { label: "Marked Paid", icon: <Banknote size={12} />, color: "emerald" },
                          4: { label: "Marked Cancelled", icon: <AlertTriangle size={12} />, color: "red" },
                          5: { label: "Marked Delivered", icon: <CheckCircle2 size={12} />, color: "purple" },
                        };
                        const st = statusLabels[s];
                        const colorClasses: Record<string, string> = {
                          blue: "bg-blue-500/20 border-blue-500/50 text-blue-400",
                          teal: "bg-teal-500/20 border-teal-500/50 text-teal-400",
                          emerald: "bg-emerald-500/20 border-emerald-500/50 text-emerald-400",
                          red: "bg-red-500/20 border-red-500/50 text-red-400",
                          purple: "bg-purple-500/20 border-purple-500/50 text-purple-400",
                        };
                        return (
                          <div key={s} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${colorClasses[st.color]}`}>
                                {st.icon}
                              </div>
                              {idx < 4 && s < job.status && <div className="w-px flex-1 bg-[#21293d] mt-1" />}
                            </div>
                            <div className={`flex-1 pb-4 ${s === job.status ? "" : "opacity-60"}`}>
                              <p className="text-sm text-slate-300 font-medium">{st.label}</p>
                              {s === 5 && job.date_completed && (
                                <p className="text-xs text-slate-500">{fmtDateTime(job.date_completed)}</p>
                              )}
                              {s !== 5 && (
                                <p className="text-xs text-slate-500">{fmtDateTime(job.date_updated)}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* If delivered, show completion */}
                      {job.status === 5 && (
                        <div className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center">
                              <CheckCircle2 size={14} className="text-emerald-400" />
                            </div>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-slate-300 font-medium">Job Completed</p>
                            <p className="text-xs text-slate-500">Delivered on {fmtDateTime(job.date_completed || job.date_updated)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </Fieldset>
                </div>
              </div>

              {/* ── ACTION BUTTONS (bottom — PHP style) ───────────────────── */}
              <hr className="my-4 border-[#21293d]"/>
              <div className="flex flex-wrap gap-2 justify-center">
                <button onClick={() => { setNewStatus(job.status); setShowStatusModal(true); }}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded font-semibold text-sm shadow-sm transition-colors">
                  <RefreshCw size={15}/> Update Status
                </button>
                <Link href={`/jobs/${job.id}/edit`}
                  className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2.5 rounded font-semibold text-sm shadow-sm transition-colors no-underline">
                  <Edit size={15}/> Edit Transaction
                </Link>
                <button onClick={handlePrint}
                  className="flex items-center gap-1.5 bg-[#1e2637] hover:bg-[#252f45] text-slate-300 border border-[#2a3550] px-5 py-2.5 rounded font-semibold text-sm shadow-sm transition-colors">
                  <Printer size={15}/> Print Page
                </button>
                <button onClick={() => setShowPayModal(true)}
                  className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded font-semibold text-sm shadow-sm transition-colors">
                  <Plus size={15}/> Add Payment
                </button>
                {userRole === "admin" && (
                  <button onClick={handleDelete} disabled={deleting}
                    className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded font-semibold text-sm shadow-sm transition-colors disabled:opacity-50">
                    <Trash2 size={15}/> {deleting ? "Deleting..." : "Delete Transaction"}
                  </button>
                )}
              </div>

            </div>{/* /card-body */}
          </div>{/* /card */}
        </div>
      </div>

      {/* ══ UPDATE STATUS MODAL ══════════════════════════════════════════════ */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowStatusModal(false); }}>
          <div className="bg-[#161b27] rounded-lg shadow-2xl w-full max-w-md overflow-hidden border border-[#21293d]">

            {/* Modal Header */}
            <div className="bg-[#001f3f] text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <RefreshCw size={16}/> Update Transaction Status
              </h3>
              <button onClick={() => setShowStatusModal(false)} className="text-white/70 hover:text-white">
                <X size={18}/>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1.5">New Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(parseInt(e.target.value))}
                  className="w-full border border-[#2a3550] rounded px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 bg-[#0d1117]">
                  {Object.entries(STATUS_MAP).map(([val, info]) => (
                    <option key={val} value={val}>{info.label} — {info.explanation}</option>
                  ))}
                </select>
              </div>

              {/* Status preview badge */}
              <div className="text-center">
                <span className={`inline-block px-5 py-2 rounded font-bold text-sm ${BADGE_COLORS[STATUS_MAP[newStatus]?.badgeColor]?.bg} ${BADGE_COLORS[STATUS_MAP[newStatus]?.badgeColor]?.text}`}>
                  {STATUS_MAP[newStatus]?.label}
                </span>
                <p className="text-slate-500 text-xs mt-1">{STATUS_MAP[newStatus]?.explanation}</p>
              </div>

              {/* ── Delivery Date/Time — only when status = 5 (Delivered) ── */}
              {newStatus === 5 && (
                <div className="bg-emerald-500/5 border border-emerald-500/25 rounded-lg p-4 space-y-3">
                  <p className="text-emerald-400 font-semibold text-sm flex items-center gap-1.5">
                    <CheckCircle2 size={15}/> Delivery Date & Time
                  </p>
                  <p className="text-slate-500 text-xs">
                    Agar delivery pehle ho gayi thi aur ab entry kar rahe hain, to sahi date aur time enter karein.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Delivery Date</label>
                      <input
                        type="date"
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        max={todayISTStr()}
                        className="w-full border border-[#2a3550] rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200 [color-scheme:light]"/>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Delivery Time</label>
                      <input
                        type="time"
                        value={deliveryTime}
                        onChange={(e) => setDeliveryTime(e.target.value)}
                        className="w-full border border-[#2a3550] rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200 [color-scheme:light]"/>
                    </div>
                  </div>
                  {deliveryDate && deliveryTime && (
                    <p className="text-emerald-400 text-xs font-medium text-center">
                      Saved as: {fmtDateTime(`${deliveryDate}T${deliveryTime}:00`)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 bg-[#111520] border-t border-[#21293d] flex gap-3 justify-end flex-wrap">
              <button onClick={() => setShowStatusModal(false)}
                className="px-5 py-2 bg-[#1e2637] border border-[#2a3550] text-slate-400 rounded font-medium text-sm hover:bg-[#252f45] transition-colors">
                Cancel
              </button>
              <button onClick={handleStatusUpdate} disabled={updatingStatus}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-sm disabled:opacity-50 flex items-center gap-2 transition-colors">
                {updatingStatus ? <><Loader2 size={14} className="animate-spin"/>Updating...</> : <><RefreshCw size={14}/>Update Status</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ ADD PAYMENT MODAL ════════════════════════════════════════════════ */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPayModal(false); }}>
          <div className="bg-[#161b27] rounded-t-2xl sm:rounded-lg shadow-2xl w-full sm:max-w-md overflow-hidden border border-[#21293d]">

            <div className="bg-[#001f3f] text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <IndianRupee size={16}/> Record New Payment
              </h3>
              <button onClick={() => setShowPayModal(false)} className="text-white/70 hover:text-white">
                <X size={18}/>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded px-3 py-2 text-sm">
                <span className="font-semibold text-blue-400">{clientName}</span>
                <span className="text-slate-600 mx-2">·</span>
                <span className="text-slate-400">Job #{job.job_id}</span>
                <span className="text-slate-600 mx-2">·</span>
                <span className="text-slate-400">Bill: <span className="font-bold text-white">Rs.{job.amount.toFixed(2)}</span></span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Amount (Rs.) *</label>
                  <input type="number" step="0.01" min="0.01"
                    value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full border border-[#2a3550] rounded px-3 py-2.5 text-sm text-slate-200 bg-[#0d1117] focus:outline-none focus:border-blue-500"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Discount (Rs.)</label>
                  <input type="number" step="0.01" min="0"
                    value={payDiscount} onChange={(e) => setPayDiscount(e.target.value)}
                    placeholder="0.00"
                    className="w-full border border-[#2a3550] rounded px-3 py-2.5 text-sm text-slate-200 bg-[#0d1117] focus:outline-none focus:border-blue-500"/>
                </div>
              </div>

              {payAmount && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded px-4 py-2.5 flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-semibold">Net Settled</span>
                  <span className="text-emerald-400 font-black text-base">
                    Rs.{((parseFloat(payAmount)||0) + (parseFloat(payDiscount)||0)).toLocaleString("en-IN", { minimumFractionDigits:2 })}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Payment Mode *</label>
                <select value={payMode} onChange={(e) => setPayMode(e.target.value)}
                  className="w-full border border-[#2a3550] rounded px-3 py-2.5 text-sm text-slate-200 bg-[#0d1117] focus:outline-none focus:border-blue-500">
                  {["Cash","PhonePe/GPay","Bank Transfer","Credit Card"].map(m => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Remarks</label>
                <input type="text" value={payRemarks} onChange={(e) => setPayRemarks(e.target.value)}
                  placeholder="Koi notes..."
                  className="w-full border border-[#2a3550] rounded px-3 py-2.5 text-sm text-slate-200 bg-[#0d1117] focus:outline-none focus:border-blue-500"/>
              </div>
            </div>

            <div className="px-5 py-4 bg-[#111520] border-t border-[#21293d] flex gap-3 flex-wrap">
              <button onClick={() => setShowPayModal(false)}
                className="flex-1 py-2.5 bg-[#1e2637] border border-[#2a3550] text-slate-400 rounded font-medium text-sm hover:bg-[#252f45] transition-colors">
                Cancel
              </button>
              <button onClick={handleAddPayment} disabled={savingPay}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                {savingPay ? <><Loader2 size={14} className="animate-spin"/>Saving...</> : <><Plus size={14}/>Save Payment</>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}