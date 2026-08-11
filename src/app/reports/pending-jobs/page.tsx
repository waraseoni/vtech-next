"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { pageAll } from "@/lib/fetch-all";
import { 
  Clock, Search, Printer, MessageSquare, 
  ChevronRight, ArrowLeft, Loader2, Calendar, Smartphone
} from "lucide-react";
import Link from "next/link";
import { formatIST, todayIST, startOfMonthIST } from "@/lib/dateUtils";

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

type DbRow = ReturnType<typeof JSON.parse>;

const STATUS_MAP: Record<number, { label: string; class: string }> = {
  0: { label: "Just Pending", class: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  1: { label: "In Progress", class: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  2: { label: "Finished", class: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  3: { label: "Paid", class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
};

function PendingJobsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [from, setFrom] = useState(searchParams.get("from") || startOfMonthIST());
  const [to, setTo] = useState(searchParams.get("to") || todayIST());
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<DbRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const start = `${from}T00:00:00+05:30`;
      const end = `${to}T23:59:59+05:30`;

      let query = supabase
        .from("transaction_list")
        .select("*")
        .neq("status", 5) // Exclude Delivered
        .neq("status", 4) // Exclude Cancelled
        .eq("del_status", 0)
        .gte("date_created", start)
        .lte("date_created", end)
        .order("date_created", { ascending: false });

      if (status !== "all") {
        query = query.eq("status", parseInt(status));
      }

      const { data } = await pageAll(query);

      const pendingJobs = data || [];
      if (pendingJobs.length === 0) {
        setJobs([]);
        setLoading(false);
        return;
      }

      const clientIdsNum = [...new Set(pendingJobs.map((t) => Number(t.client_name)).filter(id => !isNaN(id)))];
      
      const clientMap = new Map();
      if (clientIdsNum.length > 0) {
        const { data: clients, error: clientErr } = await supabase
          .from("client_list")
          .select("id, firstname, lastname, contact")
          .in("id", clientIdsNum);
          
        if (!clientErr && clients) {
          clients.forEach(c => clientMap.set(c.id, c));
        }
      }

      const enrichedJobs = pendingJobs.map(job => ({
        ...job,
        client: clientMap.get(Number(job.client_name)) || null
      }));

      setJobs(enrichedJobs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [from, to, status]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams(searchParams.toString());
    p.set("from", from);
    p.set("to", to);
    p.set("status", status);
    router.replace("?" + p.toString(), { scroll: false });
  };

  const filteredJobs = jobs.filter(j => {
    const clientName = `${j.client?.firstname || ""} ${j.client?.lastname || ""}`.toLowerCase();
    const contact = (j.client?.contact || "").toLowerCase();
    const jobId = (j.job_id || "").toLowerCase();
    const item = (j.item || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return clientName.includes(query) || contact.includes(query) || jobId.includes(query) || item.includes(query);
  });

  const totalAmount = filteredJobs.reduce((s, j) => s + (parseFloat(j.amount) || 0), 0);

  const sendWhatsApp = (job: DbRow) => {
    const phone = (job.client?.contact || "").replace(/\D/g, "");
    if (phone.length < 10) return alert("Valid mobile number nahi mila!");

    const clientName = `${job.client?.firstname || ""} ${job.client?.lastname || ""}`.trim();
    const amount = parseFloat(job.amount).toLocaleString("en-IN");
    const businessName = "Vikram Jain, V-Technologies, Jabalpur, Mob. 9179105875";
    let msg = "";

    switch (parseInt(job.status)) {
      case 0:
        msg = `Namaste ${clientName} ji 🙏!\n\nAapka *${job.item}* (Job ID: #${job.job_id}) humare workshop mein receive ho gaya hai. 🛠️\n\nEstimated amount: *₹${amount}*.\n\nKaam shuru hote hi aapko suchit kiya jayega. Dhanyavaad! ❤️\n\n${businessName}`;
        break;
      case 1:
        msg = `Namaste ${clientName} ji 🙏!\n\nAapke *${job.item}* (Job ID: #${job.job_id}) par kaam chal raha hai. ⚙️\n\nJald hi yeh taiyar ho jayega. Dhanyavaad! ❤️\n\n${businessName}`;
        break;
      case 2:
        msg = `Namaste ${clientName} ji 🙏!\n\nKhushkhabri! Aapka *${job.item}* (Job ID: #${job.job_id}) taiyar ho gaya hai. ✅\n\nTotal Amount: *₹${amount}*.\n\nAap kisi bhi samay aakar ise le sakte hain. Dhanyavaad! ❤️\n\n${businessName}`;
        break;
      default:
        msg = `Namaste ${clientName} ji 🙏!\n\nAapka Job ID: #${job.job_id} (${job.item}) pending status par hai. Hum jald hi sampark karenge. Dhanyavaad! ❤️\n\n${businessName}`;
    }

    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-[2rem] p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
          <div className="flex items-center gap-5">
            <Link href="/reports" className="w-12 h-12 flex items-center justify-center bg-[#0d1117] border border-[#21293d] rounded-2xl text-slate-500 hover:text-white hover:bg-blue-600/10 hover:border-blue-500/40 transition-all group">
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            </Link>
            <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-700 rounded-3xl flex items-center justify-center shadow-xl shadow-amber-500/20 ring-4 ring-amber-500/10">
              <Clock size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Pending Jobs</h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.3em]">Workshop Work-In-Progress Report</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="bg-[#0d1117] border border-amber-500/20 px-6 py-3 rounded-2xl flex flex-col items-end">
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Total Pending Value</span>
                <span className="text-2xl font-black text-white">{inr(totalAmount)}</span>
             </div>
             <button onClick={() => window.print()} className="w-12 h-12 flex items-center justify-center bg-[#1e2637] border border-[#2a3550] hover:border-indigo-500/40 text-slate-400 hover:text-white rounded-2xl transition-all shadow-lg">
                <Printer size={20} />
             </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-[2rem] p-5 no-print shadow-2xl flex flex-wrap items-end gap-6">
        <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-6 flex-1">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em] ml-2">Created From</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="pl-12 pr-6 py-3 bg-[#0d1117] border border-[#21293d] rounded-2xl text-sm text-slate-200 outline-none focus:border-amber-500 transition-all [color-scheme:dark]" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em] ml-2">Created To</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="pl-12 pr-6 py-3 bg-[#0d1117] border border-[#21293d] rounded-2xl text-sm text-slate-200 outline-none focus:border-amber-500 transition-all [color-scheme:dark]" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em] ml-2">Job Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="px-6 py-3 bg-[#0d1117] border border-[#21293d] rounded-2xl text-sm text-slate-200 outline-none focus:border-amber-500 transition-all cursor-pointer">
              <option value="all">All Pending</option>
              <option value="0">Just Pending</option>
              <option value="1">In Progress</option>
              <option value="2">Finished (Unpaid)</option>
              <option value="3">Paid (Not Delivered)</option>
            </select>
          </div>
          <button type="submit" className="px-10 py-3.5 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-amber-600/20">
            Refresh Report
          </button>
        </form>

        <div className="relative w-full lg:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
          <input type="text" placeholder="Search Jobs..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-6 py-3 bg-[#0d1117] border border-[#21293d] rounded-2xl text-sm text-slate-200 outline-none focus:border-amber-500 transition-all shadow-inner" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-[2.5rem] overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#0d1117] text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">
              <tr>
                <th className="px-6 py-5">Job ID / Date</th>
                <th className="px-6 py-5">Client Details</th>
                <th className="px-6 py-5">Item & Reported Fault</th>
                <th className="px-6 py-5 text-center">Status</th>
                <th className="px-6 py-5 text-right">Est. Amount</th>
                <th className="px-6 py-5 text-center no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21293d]">
              {loading ? (
                Array(6).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-8"><div className="h-4 bg-slate-800/50 rounded-full w-full"></div></td>
                  </tr>
                ))
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-600 italic">No pending jobs found for the selected criteria.</td>
                </tr>
              ) : filteredJobs.map((job) => (
                <tr key={job.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <Link href={`/jobs/${job.id}`} className="text-white font-black hover:text-amber-500 transition-colors">#{job.job_id}</Link>
                      <span className="text-[10px] text-slate-500 mt-1 font-bold">{formatIST(job.date_created, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <Link href={`/clients/${job.client_name}`} className="text-slate-200 font-bold hover:text-blue-400 transition-colors">
                        {job.client?.firstname} {job.client?.lastname}
                      </Link>
                      <span className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                        <Smartphone size={10} className="text-slate-700" /> {job.client?.contact}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-white font-medium">{job.item}</span>
                      <span className="text-[10px] text-rose-500/80 mt-1 font-bold italic uppercase tracking-wider">Fault: {job.fault}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black border uppercase tracking-wider ${STATUS_MAP[job.status]?.class}`}>
                      {STATUS_MAP[job.status]?.label}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right font-black text-amber-500 text-base">
                    {inr(job.amount)}
                  </td>
                  <td className="px-6 py-5 no-print">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => sendWhatsApp(job)} className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm group/btn" title="WhatsApp Reminder">
                        <MessageSquare size={16} className="group-hover/btn:scale-110 transition-transform" />
                      </button>
                      <Link href={`/jobs/${job.id}`} className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-sm group/btn">
                        <ChevronRight size={16} className="group-hover/btn:translate-x-0.5 transition-transform" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function PendingJobsReport() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-48"><Loader2 size={48} className="animate-spin text-amber-500" /></div>}>
      <PendingJobsContent />
    </Suspense>
  );
}
