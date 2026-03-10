"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Wrench, User, Phone, MapPin, Calendar, Clock,
  Package, Settings2, Hash, AlertTriangle, CheckCircle2,
  IndianRupee, Printer, MessageSquare, Edit, Trash2,
  Loader2, Box, Hammer, Tag, Locate, RefreshCw, ChevronRight,
  ClipboardList, ShieldAlert, Banknote, UserCog, Send,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface JobDetail {
  id: number;
  job_id: string;
  code: string;
  client_name: string; // TEXT storing int
  item: string;
  fault: string;
  remark: string;
  uniq_id: string;
  amount: number;
  mechanic_amount: number;
  mechanic_commission_amount: number;
  mechanic_id: number | null;
  user_id: number;
  del_status: number;
  status: number;
  date_created: string;
  date_updated: string;
  date_completed: string | null;
}

interface Client {
  id: number;
  firstname: string;
  middlename: string;
  lastname: string;
  contact: string;
  email: string;
  address: string;
}

interface Mechanic {
  id: number;
  firstname: string;
  lastname: string;
  designation: string;
  contact: string;
}

interface TransactionProduct {
  transaction_id: number;
  product_id: number;
  product_name: string | null;
  qty: number;
  price: number;
}

interface TransactionService {
  transaction_id: number;
  service_id: number;
  service_name: string | null;
  price: number;
}

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUS_MAP: Record<number, { label: string; color: string; bg: string; dot: string }> = {
  0: { label: "Pending",     color: "text-slate-400",   bg: "bg-slate-500/15 border-slate-500/30",   dot: "bg-slate-400" },
  1: { label: "On-Progress", color: "text-blue-400",    bg: "bg-blue-500/15 border-blue-500/30",     dot: "bg-blue-400" },
  2: { label: "Done",        color: "text-teal-400",    bg: "bg-teal-500/15 border-teal-500/30",     dot: "bg-teal-400" },
  3: { label: "Paid",        color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", dot: "bg-emerald-400" },
  4: { label: "Cancelled",   color: "text-red-400",     bg: "bg-red-500/15 border-red-500/30",       dot: "bg-red-400" },
  5: { label: "Delivered",   color: "text-purple-400",  bg: "bg-purple-500/15 border-purple-500/30", dot: "bg-purple-400" },
};

const DEL_STATUS: Record<number, { label: string; color: string }> = {
  0: { label: "In Shop",   color: "text-amber-400"  },
  1: { label: "Delivered", color: "text-emerald-400" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
};

const fmtDateTime = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function InfoRow({ label, value, icon: Icon, valueClass = "text-slate-300" }: {
  label: string; value: React.ReactNode; icon?: React.ElementType; valueClass?: string;
}) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-[#21293d] last:border-0">
      <div className="flex items-center gap-2 text-slate-600 text-xs font-bold uppercase tracking-wider min-w-[120px]">
        {Icon && <Icon size={12} className="text-slate-700 flex-shrink-0" />}
        {label}
      </div>
      <div className={`text-sm font-semibold text-right ${valueClass}`}>{value}</div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, accent = "blue" }: {
  title: string; icon: React.ElementType; children: React.ReactNode; accent?: string;
}) {
  const accentMap: Record<string, string> = {
    blue:    "from-blue-600/20 to-transparent border-blue-500/20",
    emerald: "from-emerald-600/20 to-transparent border-emerald-500/20",
    amber:   "from-amber-600/20 to-transparent border-amber-500/20",
    purple:  "from-purple-600/20 to-transparent border-purple-500/20",
    red:     "from-red-600/20 to-transparent border-red-500/20",
  };
  const iconMap: Record<string, string> = {
    blue: "text-blue-400", emerald: "text-emerald-400", amber: "text-amber-400",
    purple: "text-purple-400", red: "text-red-400",
  };
  return (
    <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
      <div className={`flex items-center gap-2.5 px-5 py-3.5 bg-gradient-to-r ${accentMap[accent]} border-b`}>
        <Icon size={15} className={iconMap[accent]} />
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">{title}</h3>
      </div>
      <div className="px-5 py-1">{children}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function JobDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const jobId  = params.id as string;

  const [job,      setJob]      = useState<JobDetail | null>(null);
  const [client,   setClient]   = useState<Client | null>(null);
  const [mechanic, setMechanic] = useState<Mechanic | null>(null);
  const [products, setProducts] = useState<TransactionProduct[]>([]);
  const [services, setServices] = useState<TransactionService[]>([]);
  const [userRole, setUserRole] = useState<string>("staff");
  const [loading,  setLoading]  = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const h = (e: MediaQueryList | MediaQueryListEvent) => setIsMobile(e.matches);
    h(mq); mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // ── Fetch all data ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // User role
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        setUserRole(p?.role || "staff");
      }

      // Job details
      const { data: jobData, error: jobErr } = await supabase
        .from("transaction_list")
        .select("*")
        .eq("id", jobId)
        .eq("del_status", 0)
        .single();

      if (jobErr || !jobData) {
        alert("Job not found.");
        router.push("/jobs");
        return;
      }
      setJob(jobData as JobDetail);

      // Parallel fetches
      const clientId   = Number(jobData.client_name);
      const mechanicId = jobData.mechanic_id;

      const [clientRes, mechRes, prodRes, svcRes] = await Promise.all([
        supabase.from("client_list")
          .select("id, firstname, middlename, lastname, contact, email, address")
          .eq("id", clientId).single(),
        mechanicId
          ? supabase.from("mechanic_list")
              .select("id, firstname, lastname, designation, contact")
              .eq("id", mechanicId).single()
          : Promise.resolve({ data: null }),
        supabase.from("transaction_products")
          .select("*")
          .eq("transaction_id", jobData.id),
        supabase.from("transaction_services")
          .select("*")
          .eq("transaction_id", jobData.id),
      ]);

      if (clientRes.data)  setClient(clientRes.data as Client);
      if (mechRes.data)    setMechanic(mechRes.data as Mechanic);
      setProducts((prodRes.data || []) as TransactionProduct[]);
      setServices((svcRes.data  || []) as TransactionService[]);
    } catch (err) {
      console.error("fetchData error:", err);
    } finally {
      setLoading(false);
    }
  }, [jobId, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (userRole !== "admin") { alert("Sirf Admin delete kar sakta hai!"); return; }
    if (!confirm("Kya aap is job ko delete karna chahte hain?")) return;
    setDeleting(true);
    const { error } = await supabase.from("transaction_list").update({ del_status: 1 }).eq("id", jobId);
    if (!error) router.push("/jobs");
    else { alert("Delete failed: " + error.message); setDeleting(false); }
  };

  const sendWA = () => {
    if (!job || !client) return;
    const phone = client.contact?.replace(/\D/g, "");
    if (!phone || phone.length < 10) { alert("Valid mobile number nahi mila!"); return; }
    const name = [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ");
    const amt  = (job.amount || 0).toLocaleString("en-IN");
    const biz  = "Vikram Jain, V-Technologies, Jabalpur, Mob. 9179105875";

    const msgs: Record<number, string> = {
      0: `Namaste ${name} ji 🙏!\n\nAapka *${job.item}* repair ke liye register ho gaya hai. 📝\n\nJob ID: #${job.job_id}\nCode: #${job.code}\nStatus: *Received/Pending*\n\nHum jald hi update denge. Dhanyavaad! ❤️\n\n${biz}`,
      1: `Namaste ${name} ji 🙏!\n\nAapke *${job.item}* (Job #${job.job_id}) par kaam shuru ho gaya hai. 🛠️\n\nStatus: *In-Progress/Repairing*\n\n${biz}`,
      2: `Namaste ${name} ji 🙏!\n\nAapka *${job.item}* repair ho gaya hai. ✅\n\nJob #${job.job_id} | Code: ${job.code}\nBill Amount: *₹${amt}*\n\nWorkshop aakar collect karein. 🛍️\n\nDhanyavaad! ❤️\n\n${biz}`,
      3: `Namaste ${name} ji 🙏!\n\nAapka *${job.item}* (Job #${job.job_id}) deliver ho gaya. 🏁\n\nTotal Paid: *₹${amt}*\nDhanyavaad! ⭐\n\n${biz}`,
      4: `Namaste ${name} ji 🙏!\n\nAapka Job #${job.job_id} (*${job.item}*) cancel ho gaya. ❌\n\nAdhik jankari ke liye workshop par sampark karein. 🙏\n\n${biz}`,
      5: `Namaste ${name} ji 🙏!\n\nAapka *${job.item}* (Job #${job.job_id}) deliver kar diya gaya. 🏁\n\nTotal Paid: *₹${amt}*\nDhanyavaad! ⭐\n\n${biz}`,
    };
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msgs[job.status] || msgs[0])}`, "_blank");
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-500" size={40} />
        <p className="text-slate-600 text-xs font-bold uppercase tracking-[0.3em]">Loading Job Details...</p>
      </div>
    );
  }

  if (!job) return null;

  const st         = STATUS_MAP[job.status] || STATUS_MAP[0];
  const clientName = client
    ? [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ")
    : `Client #${job.client_name}`;
  const mechName   = mechanic
    ? `${mechanic.firstname} ${mechanic.lastname}`.trim()
    : null;

  const productsTotal = products.reduce((s, p) => s + p.price * p.qty, 0);
  const servicesTotal = services.reduce((s, s2) => s + s2.price, 0);

  // ════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0d1117] text-white font-sans pb-16">
      <div className="max-w-5xl mx-auto px-3 sm:px-5 pt-4 sm:pt-6 space-y-4">

        {/* ── Top Bar ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button onClick={() => router.back()}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm font-bold transition-colors">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex items-center gap-2">
            <a href={`/api/print-bill?job_id=${job.job_id}`} target="_blank"
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
              <Printer size={13} /> Print Bill
            </a>
            <Link href={`/jobs/edit/${job.id}`}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
              <Edit size={13} /> Edit
            </Link>
            <Link href={`/jobs/old-edit/${job.id}`}
              className="flex items-center gap-1.5 bg-[#21293d] hover:bg-[#2a3550] text-slate-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
              <RefreshCw size={13} /> Old Edit
            </Link>
            {userRole === "admin" && (
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-1.5 bg-red-700/30 hover:bg-red-700/50 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50">
                <Trash2 size={13} /> {deleting ? "Deleting..." : "Delete"}
              </button>
            )}
          </div>
        </div>

        {/* ── Hero Card: Job Header ── */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          {/* Status bar */}
          <div className={`h-1 w-full ${
            job.status === 0 ? "bg-slate-500" :
            job.status === 1 ? "bg-gradient-to-r from-blue-500 to-blue-600" :
            job.status === 2 ? "bg-gradient-to-r from-teal-500 to-teal-600" :
            job.status === 3 ? "bg-gradient-to-r from-emerald-500 to-emerald-600" :
            job.status === 4 ? "bg-gradient-to-r from-red-500 to-red-600" :
            "bg-gradient-to-r from-purple-500 to-purple-600"
          }`} />

          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              {/* Left: Job Identity */}
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl border ${st.bg} flex-shrink-0`}>
                  <Wrench size={22} className={st.color} />
                </div>
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl font-black text-white tracking-tight">
                      Job #{job.job_id}
                    </h1>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${st.bg} ${st.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2">
                    <span className="flex items-center gap-1.5 text-slate-500 text-xs">
                      <Hash size={11} />
                      Code: <span className="text-slate-300 font-bold">{job.code || "—"}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-500 text-xs">
                      <Locate size={11} />
                      Loc: <span className="text-slate-300 font-bold">{job.uniq_id || "—"}</span>
                    </span>
                    <span className={`flex items-center gap-1.5 text-xs font-bold ${DEL_STATUS[job.del_status].color}`}>
                      <Box size={11} />
                      {DEL_STATUS[job.del_status].label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Amount */}
              <div className="text-right">
                <div className="text-3xl font-black text-white">
                  ₹{(job.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">Bill Amount</div>
                {(job.mechanic_amount > 0 || job.mechanic_commission_amount > 0) && (
                  <div className="mt-1 text-xs text-slate-600">
                    {job.mechanic_amount > 0 && (
                      <span className="block">Mechanic: ₹{job.mechanic_amount.toFixed(0)}</span>
                    )}
                    {job.mechanic_commission_amount > 0 && (
                      <span className="block">Commission: ₹{job.mechanic_commission_amount.toFixed(0)}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Breadcrumb path */}
            <div className="flex items-center gap-1 mt-4 text-[10px] text-slate-700">
              <Link href="/jobs" className="hover:text-slate-500 transition-colors">Jobs</Link>
              <ChevronRight size={10} />
              <span className="text-slate-500">#{job.job_id}</span>
            </div>
          </div>
        </div>

        {/* ── Main Grid ── */}
        <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>

          {/* ── Device Information ── */}
          <SectionCard title="Device Information" icon={Package} accent="blue">
            <InfoRow label="Item / Model" icon={Box}       value={<span className="text-white font-bold">{job.item}</span>} />
            <InfoRow label="Fault / Issue" icon={ShieldAlert} value={<span className="text-red-400">{job.fault}</span>} />
            {job.remark && job.remark.trim() && (
              <InfoRow label="Remark" icon={MessageSquare}
                value={<span className="text-slate-400 text-xs max-w-[200px] text-right leading-relaxed">{job.remark}</span>} />
            )}
            <InfoRow label="Location ID" icon={Locate} value={job.uniq_id || "—"} />
          </SectionCard>

          {/* ── Client Information ── */}
          <SectionCard title="Client Information" icon={User} accent="emerald">
            <InfoRow label="Name" icon={User}
              value={
                <Link href={`/clients/${job.client_name}`}
                  className="text-blue-400 hover:text-blue-300 font-bold transition-colors">
                  {clientName}
                </Link>
              }
            />
            {client?.contact && (
              <InfoRow label="Contact" icon={Phone}
                value={
                  <div className="flex items-center gap-2">
                    <a href={`tel:${client.contact}`} className="text-slate-300 hover:text-white text-sm transition-colors">
                      {client.contact}
                    </a>
                    <a href={`https://wa.me/91${client.contact.replace(/\D/g, "")}`} target="_blank"
                      className="text-emerald-400 hover:text-emerald-300 transition-colors" title="WhatsApp">
                      <Phone size={13} />
                    </a>
                  </div>
                }
              />
            )}
            {client?.address && (
              <InfoRow label="Address" icon={MapPin} value={<span className="text-xs text-right leading-relaxed max-w-[200px]">{client.address}</span>} />
            )}
            {client?.email && (
              <InfoRow label="Email" icon={Tag} value={<span className="text-slate-400 text-xs">{client.email}</span>} />
            )}
            <InfoRow label="Client ID" icon={Hash} value={<span className="text-slate-500 text-xs">#{job.client_name}</span>} />
          </SectionCard>

          {/* ── Job Timeline ── */}
          <SectionCard title="Timeline" icon={Calendar} accent="amber">
            <InfoRow label="Created"      icon={Calendar} value={fmtDateTime(job.date_created)} />
            <InfoRow label="Last Updated" icon={Clock}
              value={<span className={job.date_updated !== job.date_created ? "text-amber-400" : ""}>
                {fmtDateTime(job.date_updated)}
              </span>}
            />
            <InfoRow label="Completed"    icon={CheckCircle2}
              value={
                job.date_completed
                  ? <span className="text-emerald-400">{fmtDateTime(job.date_completed)}</span>
                  : <span className="text-slate-600 text-xs">Not yet</span>
              }
            />
          </SectionCard>

          {/* ── Mechanic / Technician ── */}
          <SectionCard title="Assigned Technician" icon={UserCog} accent="purple">
            {mechanic ? (
              <>
                <InfoRow label="Name"        icon={User}
                  value={<span className="text-white font-bold">{mechName}</span>} />
                <InfoRow label="Designation" icon={Tag}
                  value={<span className="text-purple-400 text-xs font-bold uppercase tracking-wider">{mechanic.designation}</span>} />
                {mechanic.contact && (
                  <InfoRow label="Contact" icon={Phone}
                    value={
                      <a href={`tel:${mechanic.contact}`} className="text-slate-300 hover:text-white transition-colors text-sm">
                        {mechanic.contact}
                      </a>
                    }
                  />
                )}
                {job.mechanic_amount > 0 && (
                  <InfoRow label="Mech. Amount" icon={IndianRupee}
                    value={<span className="text-amber-400">₹{job.mechanic_amount.toFixed(0)}</span>} />
                )}
                {job.mechanic_commission_amount > 0 && (
                  <InfoRow label="Commission" icon={Banknote}
                    value={<span className="text-teal-400">₹{job.mechanic_commission_amount.toFixed(0)}</span>} />
                )}
              </>
            ) : (
              <div className="py-6 text-center text-slate-700 text-xs font-bold uppercase tracking-wider">
                No technician assigned
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── Products Used ── */}
        {products.length > 0 && (
          <SectionCard title={`Products Used (${products.length})`} icon={Package} accent="blue">
            <div className="-mx-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#111520]">
                    <th className="px-5 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-600">Product</th>
                    <th className="px-5 py-2.5 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-600">Qty</th>
                    <th className="px-5 py-2.5 text-right text-[10px] font-extrabold uppercase tracking-wider text-slate-600">Price</th>
                    <th className="px-5 py-2.5 text-right text-[10px] font-extrabold uppercase tracking-wider text-slate-600">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21293d]">
                  {products.map((p, i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-500/10 border border-blue-500/20 rounded flex items-center justify-center flex-shrink-0">
                            <Package size={10} className="text-blue-400" />
                          </div>
                          <span className="text-slate-200 font-medium text-xs">
                            {p.product_name || `Product #${p.product_id}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center text-slate-400 text-xs font-bold">×{p.qty}</td>
                      <td className="px-5 py-3 text-right text-slate-400 text-xs">₹{p.price.toFixed(2)}</td>
                      <td className="px-5 py-3 text-right text-slate-200 font-bold text-xs">₹{(p.price * p.qty).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#111520] border-t border-[#21293d]">
                    <td colSpan={3} className="px-5 py-2.5 text-right text-[10px] font-extrabold uppercase tracking-wider text-slate-600">Products Total</td>
                    <td className="px-5 py-2.5 text-right font-black text-blue-400">₹{productsTotal.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </SectionCard>
        )}

        {/* ── Services Performed ── */}
        {services.length > 0 && (
          <SectionCard title={`Services Performed (${services.length})`} icon={Hammer} accent="emerald">
            <div className="-mx-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#111520]">
                    <th className="px-5 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-600">Service</th>
                    <th className="px-5 py-2.5 text-right text-[10px] font-extrabold uppercase tracking-wider text-slate-600">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21293d]">
                  {services.map((s, i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-center justify-center flex-shrink-0">
                            <Settings2 size={10} className="text-emerald-400" />
                          </div>
                          <span className="text-slate-200 font-medium text-xs">
                            {s.service_name || `Service #${s.service_id}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-slate-200 font-bold text-xs">₹{s.price.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#111520] border-t border-[#21293d]">
                    <td className="px-5 py-2.5 text-right text-[10px] font-extrabold uppercase tracking-wider text-slate-600">Services Total</td>
                    <td className="px-5 py-2.5 text-right font-black text-emerald-400">₹{servicesTotal.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </SectionCard>
        )}

        {/* ── Bill Summary ── */}
        {(products.length > 0 || services.length > 0) && (
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-600/20 to-transparent border-b border-indigo-500/20 flex items-center gap-2">
              <IndianRupee size={15} className="text-indigo-400" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Bill Summary</h3>
            </div>
            <div className="px-5 py-3 space-y-2">
              {products.length > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Products ({products.length} items)</span>
                  <span className="text-slate-400">₹{productsTotal.toFixed(2)}</span>
                </div>
              )}
              {services.length > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Services ({services.length} items)</span>
                  <span className="text-slate-400">₹{servicesTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-[#21293d] pt-2 flex justify-between items-center">
                <span className="text-sm font-extrabold text-slate-300">Total Bill Amount</span>
                <span className="text-xl font-black text-white">₹{job.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── WhatsApp Action Card ── */}
        <div className="bg-[#161b27] border border-emerald-500/20 rounded-2xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-white">Send WhatsApp Update</h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Current status: <span className={`font-bold ${st.color}`}>{st.label}</span> — message will be sent accordingly
              </p>
            </div>
            <button onClick={sendWA}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-extrabold transition-all active:scale-95 shadow-lg shadow-emerald-500/20">
              <Send size={15} />
              Send to {client?.contact ? client.contact.slice(-10) : "Client"}
            </button>
          </div>
        </div>

        {/* ── Full Status History Note ── */}
        <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3">
          <AlertTriangle size={14} className="text-amber-500/60 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-700 leading-relaxed">
            Status change history is not tracked. Last updated: <span className="text-slate-500">{fmtDateTime(job.date_updated)}</span>
            {job.date_completed && <> · Completed: <span className="text-slate-500">{fmtDateTime(job.date_completed)}</span></>}
          </p>
        </div>

      </div>
    </div>
  );
}