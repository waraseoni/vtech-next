"use client";
import { Suspense, useState, useEffect, use, useRef, useCallback } from "react";
import { supabase, getCachedUser } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Save,
  ArrowLeft,
  Loader2,
  Wrench,
  Package,
  Hash,
  User,
  AlertCircle,
  CheckCircle2,
  Trash2,
  IndianRupee,
  MapPin,
  MessageSquare,
  UserCog,
  Smartphone,
  X,
  Briefcase,
} from "lucide-react";
import PageLoader from "@/components/PageLoader";
import { logActivity } from "@/lib/activity";
import { fetchClientDue, dueLabel } from "@/lib/client-due";
import { getNextJobId, bumpJobCounter } from "@/lib/jobIdCounter";
import SearchableSelect from "@/components/SearchableSelect";
import JobSpotPicker from "@/components/JobSpotPicker";
import { logger } from "@/lib/logger";

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const inputCls =
  "w-full px-3 py-2.5 bg-[#111520] border border-[#21293d] rounded-xl text-white text-sm font-medium " +
  "placeholder:text-slate-700 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 " +
  "transition-all [color-scheme:dark]";

const labelCls =
  "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 mb-1.5";

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type Client = {
  id: number;
  firstname: string;
  middlename: string;
  lastname: string;
  contact: string;
  fullname: string;
};
type Mechanic = { id: number; fullname: string; commission_percent: number };
type Service = { id: number; name: string; price: number };
type Product = { id: number; name: string; price: number; available_stock: number };

type ServiceRow = { tempId: number; service_id: number; service_name: string; price: number };
type ProductRow = {
  tempId: number;
  product_id: number;
  product_name: string;
  qty: number;
  price: number;
};

type Toast = { type: "success" | "error"; msg: string };

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ManageJobPage({ params }: { params: Promise<{ id?: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <ManageJobPageInner params={params} />
    </Suspense>
  );
}

function ManageJobPageInner({ params }: { params: Promise<{ id?: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  // jobId present → edit mode; else → new mode
  const jobId = resolvedParams.id ? parseInt(resolvedParams.id) : null;
  const isEdit = !!jobId && !isNaN(jobId);

  // ?client_id=123 → auto-select client (from view client page)
  const presetClientId = searchParams.get("client_id")
    ? parseInt(searchParams.get("client_id")!)
    : null;

  // ── STATE ─────────────────────────────────────────────────────────────
  const [fetchLoading, setFetchLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number>(0); // numeric user id from profiles

  // Master data
  const [clients, setClients] = useState<Client[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Form fields
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientBalance, setClientBalance] = useState<{
    amount: number;
    label: string;
    type: "due" | "advance" | "settled";
  } | null>(null);
  const [selectedMechanic, setSelectedMechanic] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("staff");
  const [jobCode, setJobCode] = useState<string>(""); // job_id column
  const [txnCode, setTxnCode] = useState<string>(""); // code column (YYYYMMDD+seq)
  const [item, setItem] = useState("");
  const [fault, setFault] = useState("");
  const [uniqId, setUniqId] = useState(""); // legacy free-text (bina location_id wale rows ka fallback)
  const [locId, setLocId] = useState<number | null>(null); // locations.id (kind='job')
  const [locName, setLocName] = useState(""); // selected spot ka naam (dual-write -> uniq_id)
  const [remark, setRemark] = useState("");
  const [serviceRows, setServiceRows] = useState<ServiceRow[]>([]);
  const [productRows, setProductRows] = useState<ProductRow[]>([]);
  const [commissionAmt, setCommissionAmt] = useState<string>("0");
  const tempIdRef = useRef(0);

  // Add New Client Modal
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    firstname: "",
    middlename: "",
    lastname: "",
    contact: "",
    email: "",
    address: "",
  });
  const [savingClient, setSavingClient] = useState(false);

  // ── TOAST auto-dismiss ─────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── CLIENT BALANCE ────────────────────────────────────────────────────
  // Canonical PHP formula (SalesTrait::get_client_balance): opening + delivered
  // repairs + direct sales − service payments + active loans − loan repayments.
  const fetchClientBalance = useCallback(async (cid: number) => {
    const d = await fetchClientDue(supabase, cid);
    setClientBalance(dueLabel(d.netBalance));
  }, []);

  // ── FETCH MASTER DATA ─────────────────────────────────────────────────
  useEffect(() => {
    const loadMaster = async () => {
      // Current logged-in user's numeric ID (from profiles → maps to transaction_list.user_id)
      try {
        const {
          data: { user },
        } = await getCachedUser();
        if (user) {
          // profiles.mechanic_id is the numeric id used in transaction_list.user_id
          // Fall back to 0 if profile not found (will still error if DB enforces NOT NULL)
          const { data: profile } = await supabase
            .from("profiles")
            .select("mechanic_id, role")
            .eq("id", user.id)
            .single();
          setCurrentUserId(profile?.mechanic_id ?? 0);
          setUserRole(profile?.role ?? "staff");
        }
      } catch {
        /* silently ignore — user_id will be 0 */
      }

      // Clients
      const { data: cData } = await supabase
        .from("client_list")
        .select("id, firstname, middlename, lastname, contact")
        .eq("delete_flag", 0)
        .order("firstname");
      const mapped: Client[] = (cData || []).map((c) => ({
        ...c,
        fullname: [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" "),
      }));
      setClients(mapped);

      // Auto-select client from ?client_id param
      if (presetClientId && !isEdit) {
        const found = mapped.find((c) => c.id === presetClientId);
        if (found) {
          setSelectedClient(found);
          fetchClientBalance(found.id);
        }
      }

      // Mechanics
      const { data: mData } = await supabase
        .from("mechanic_list")
        .select("id, firstname, middlename, lastname, commission_percent")
        .eq("delete_flag", 0)
        .eq("status", 1)
        .order("firstname");
      setMechanics(
        (mData || []).map((m) => ({
          id: m.id,
          fullname: [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" "),
          commission_percent: m.commission_percent || 0,
        }))
      );

      // Services
      const { data: sData } = await supabase
        .from("service_list")
        .select("id, name, price")
        .eq("delete_flag", 0)
        .eq("status", 1)
        .order("name");
      setServices(sData || []);

      // Products with available stock — 3 separate queries.
      // Nested join product_list→transaction_products→transaction_list fails in PostgREST
      // because transaction_products has no single-column PK (composite key only).
      const [{ data: pData }, { data: invData }, { data: tpData }, { data: dsiData }] =
        await Promise.all([
          // 1. All active products
          supabase
            .from("product_list")
            .select("id, name, price")
            .eq("delete_flag", 0)
            .eq("status", 1)
            .order("name"),

          // 2. Total stock in (sum per product from inventory)
          supabase.from("inventory_list").select("product_id, quantity"),

          // 3. Qty sold in non-cancelled jobs only
          supabase.from("transaction_products").select("product_id, qty, transaction_id"),

          // 4. Qty sold in direct sales
          supabase.from("direct_sale_items").select("product_id, qty"),
        ]);

      // Get cancelled job IDs to exclude from sold count
      const { data: cancelledJobs } = await supabase
        .from("transaction_list")
        .select("id")
        .eq("status", 4);
      const cancelledIds = new Set((cancelledJobs || []).map((j) => j.id));

      // Build lookup maps
      const invMap: Record<number, number> = {};
      (invData || []).forEach((r) => {
        invMap[r.product_id] = (invMap[r.product_id] || 0) + (r.quantity || 0);
      });

      const jobSoldMap: Record<number, number> = {};
      (tpData || []).forEach((r) => {
        if (!cancelledIds.has(r.transaction_id))
          jobSoldMap[r.product_id] = (jobSoldMap[r.product_id] || 0) + (r.qty || 0);
      });

      const saleSoldMap: Record<number, number> = {};
      (dsiData || []).forEach((r) => {
        saleSoldMap[r.product_id] = (saleSoldMap[r.product_id] || 0) + (r.qty || 0);
      });

      const withStock: Product[] = (pData || []).map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        available_stock: (invMap[p.id] || 0) - (jobSoldMap[p.id] || 0) - (saleSoldMap[p.id] || 0),
      }));
      setProducts(withStock);
    };
    loadMaster();
  }, [presetClientId, isEdit, fetchClientBalance]);

  // ── FETCH JOB (edit mode) ─────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit || !jobId) return;
    const loadJob = async () => {
      try {
        const { data, error } = await supabase
          .from("transaction_list")
          .select("*")
          .eq("id", jobId)
          .single();
        if (error) throw error;

        setJobCode(data.job_id || "");
        setTxnCode(data.code || "");
        setItem(data.item || "");
        setFault(data.fault || "");
        setUniqId(data.uniq_id || "");
        setLocId(data.location_id ?? null);
        setLocName(data.location_id ? data.uniq_id || "" : ""); // dual-write: naam = uniq_id
        setRemark(data.remark || "");
        setCommissionAmt(String(data.mechanic_commission_amount || 0));
        setSelectedMechanic(String(data.mechanic_id || ""));

        // Load client
        if (data.client_name) {
          const { data: cData } = await supabase
            .from("client_list")
            .select("id, firstname, middlename, lastname, contact")
            .eq("id", parseInt(data.client_name))
            .single();
          if (cData) {
            const cl: Client = {
              ...cData,
              fullname: [cData.firstname, cData.middlename, cData.lastname]
                .filter(Boolean)
                .join(" "),
            };
            setSelectedClient(cl);
            fetchClientBalance(cl.id);
          }
        }

        // Load services
        const { data: svcs } = await supabase
          .from("transaction_services")
          .select("service_id, service_name, price")
          .eq("transaction_id", jobId);
        setServiceRows(
          (svcs || []).map((s) => ({
            tempId: ++tempIdRef.current,
            service_id: s.service_id,
            service_name: s.service_name,
            price: s.price,
          }))
        );

        // Load products
        const { data: prods } = await supabase
          .from("transaction_products")
          .select("product_id, product_name, qty, price")
          .eq("transaction_id", jobId);
        setProductRows(
          (prods || []).map((p) => ({
            tempId: ++tempIdRef.current,
            product_id: p.product_id,
            product_name: p.product_name,
            qty: p.qty,
            price: p.price,
          }))
        );
      } catch (e) {
        logger.error("load job:", e instanceof Error ? e.message : JSON.stringify(e));
        setToast({ type: "error", msg: "Job load karne mein galti!" });
        router.push("/jobs");
      } finally {
        setFetchLoading(false);
      }
    };
    loadJob();
  }, [jobId, isEdit, fetchClientBalance, router]);

  // ── ADD NEW CLIENT ─────────────────────────────────────────────────────
  const handleSaveNewClient = async () => {
    const { firstname, lastname, contact, address } = newClientForm;
    if (!firstname.trim()) {
      setToast({ type: "error", msg: "First name zaroori hai!" });
      return;
    }
    if (!lastname.trim()) {
      setToast({ type: "error", msg: "Last name zaroori hai!" });
      return;
    }
    if (!contact.trim()) {
      setToast({ type: "error", msg: "Contact number zaroori hai!" });
      return;
    }

    setSavingClient(true);
    try {
      const { data, error } = await supabase
        .from("client_list")
        .insert({
          firstname: firstname.trim(),
          middlename: newClientForm.middlename.trim() || null,
          lastname: lastname.trim(),
          contact: contact.trim(),
          email: newClientForm.email.trim() || null,
          address: address.trim() || "",
          opening_balance: 0,
          delete_flag: 0,
        })
        .select("id, firstname, middlename, lastname, contact")
        .single();

      if (error) throw error;

      const newClient: Client = {
        ...data,
        fullname: [data.firstname, data.middlename, data.lastname].filter(Boolean).join(" "),
      };

      setClients((prev) => [...prev, newClient]);
      setSelectedClient(newClient);
      fetchClientBalance(newClient.id);
      setShowAddClientModal(false);
      await logActivity(
        "Created Client (from Job)",
        "Clients",
        newClient.id,
        `Name: ${newClient.fullname}`
      );
      setNewClientForm({
        firstname: "",
        middlename: "",
        lastname: "",
        contact: "",
        email: "",
        address: "",
      });
      setToast({ type: "success", msg: "Naya client add ho gaya! ✅" });
    } catch (e) {
      logger.error("save client error:", e instanceof Error ? e.message : e);
      setToast({
        type: "error",
        msg: "Client save nahi hua: " + (e instanceof Error ? e.message : "Unknown error"),
      });
    } finally {
      setSavingClient(false);
    }
  };

  // ── AUTO JOB CODE (new mode) ──────────────────────────────────────────
  // PHP format: code = YYYYMMDD + 2-digit daily sequence (e.g. "2025102401")
  //             job_id = sequential number across all jobs (e.g. "27270")
  useEffect(() => {
    if (isEdit) return;
    const genCode = async () => {
      // IST today string
      const istParts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());
      const p: Record<string, string> = {};
      istParts.forEach((x) => {
        p[x.type] = x.value;
      });
      const todayIST = `${p.year}-${p.month}-${p.day}`;
      const datePrefix = todayIST.replace(/-/g, ""); // "20251024"

      // Count today's jobs for daily sequence
      const { count: todayCount } = await supabase
        .from("transaction_list")
        .select("id", { count: "exact", head: true })
        .gte("date_created", `${todayIST}T00:00:00+05:30`)
        .lte("date_created", `${todayIST}T23:59:59+05:30`);
      const dailySeq = String((todayCount || 0) + 1).padStart(2, "0");
      setTxnCode(`${datePrefix}${dailySeq}`); // e.g. "2025102401"

      // job_id = job_id_counter table se last_job_id + 1
      const nextJobId = await getNextJobId();
      setJobCode(String(nextJobId));
    };
    genCode();
  }, [isEdit]);

  // ── ADD SERVICE ROW ───────────────────────────────────────────────────
  const addService = (svcId: number) => {
    const svc = services.find((s) => s.id === svcId);
    if (!svc) return;
    if (serviceRows.some((r) => r.service_id === svc.id)) {
      setToast({ type: "error", msg: "Yeh service already add hai!" });
      return;
    }
    setServiceRows((prev) => [
      ...prev,
      {
        tempId: ++tempIdRef.current,
        service_id: svc.id,
        service_name: svc.name,
        price: svc.price,
      },
    ]);
  };

  const removeService = (tempId: number) =>
    setServiceRows((prev) => prev.filter((r) => r.tempId !== tempId));

  const updateServicePrice = (tempId: number, val: string) =>
    setServiceRows((prev) =>
      prev.map((r) => (r.tempId === tempId ? { ...r, price: parseFloat(val) || 0 } : r))
    );

  const updateServiceName = (tempId: number, val: string) =>
    setServiceRows((prev) =>
      prev.map((r) => (r.tempId === tempId ? { ...r, service_name: val } : r))
    );

  // ── ADD PRODUCT ROW ───────────────────────────────────────────────────
  const addProduct = (prdId: number) => {
    const prd = products.find((p) => p.id === prdId);
    if (!prd) return;
    if (productRows.some((r) => r.product_id === prd.id)) {
      setToast({ type: "error", msg: "Yeh product already add hai!" });
      return;
    }
    setProductRows((prev) => [
      ...prev,
      {
        tempId: ++tempIdRef.current,
        product_id: prd.id,
        product_name: prd.name,
        qty: 1,
        price: prd.price,
      },
    ]);
  };

  const removeProduct = (tempId: number) =>
    setProductRows((prev) => prev.filter((r) => r.tempId !== tempId));

  const updateProductQty = (tempId: number, val: string) => {
    // No stock cap — overselling allowed by design (negative inventory)
    const newQty = Math.max(1, parseInt(val) || 1);
    setProductRows((prev) => prev.map((r) => (r.tempId === tempId ? { ...r, qty: newQty } : r)));
  };

  const updateProductPrice = (tempId: number, val: string) =>
    setProductRows((prev) =>
      prev.map((r) => (r.tempId === tempId ? { ...r, price: parseFloat(val) || 0 } : r))
    );

  const handleSave = async () => {
    if (!selectedClient) {
      setToast({ type: "error", msg: "Client select karo!" });
      return;
    }
    if (!fault.trim()) {
      setToast({ type: "error", msg: "Fault description zaroori hai!" });
      return;
    }
    if (!selectedMechanic) {
      setToast({ type: "error", msg: "Mechanic select karo!" });
      return;
    }

    // NOTE: No hard stock validation — out-of-stock products can still be sold.
    // Shortfall is shown as an amber warning in the product rows.

    setSaving(true);
    try {
      // Auto-calculate commission for staff (they can't see the input)
      let finalCommission = parseFloat(commissionAmt) || 0;
      if (userRole !== "admin" && userRole !== "developer" && selectedMechanic) {
        const svcTotal = serviceRows.reduce((sum, r) => sum + (r.price || 0), 0);
        const mech = mechanics.find((m) => m.id === parseInt(selectedMechanic));
        if (mech && mech.commission_percent > 0) {
          finalCommission = Math.round((svcTotal * mech.commission_percent) / 100);
        }
      }

      const payload = {
        // user_id = logged-in user's numeric id (profiles.mechanic_id → old PHP users.id)
        user_id: currentUserId,
        client_name: String(selectedClient.id),
        mechanic_id: parseInt(selectedMechanic),
        code: txnCode, // YYYYMMDD+seq e.g. "2025102401"
        job_id: jobCode, // global seq e.g. "27270
        item: item.trim(),
        fault: fault.trim(),
        uniq_id: (locId ? locName : uniqId).trim() || "", // dual-write: location ho to spot naam, warna legacy text
        location_id: locId,
        remark: remark.trim() || "", // NOT NULL in DB — empty string safe
        amount: grandTotal,
        mechanic_commission_amount: finalCommission,
        status: 0, // Pending
        date_updated: (() => {
          const p = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }).formatToParts(new Date());
          const g = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
          return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:${g("second")}+05:30`;
        })(),
      };

      let txnId = jobId;

      if (isEdit) {
        const { error } = await supabase.from("transaction_list").update(payload).eq("id", jobId);
        if (error) throw error;

        // Delete existing services & products, re-insert
        await Promise.all([
          supabase.from("transaction_services").delete().eq("transaction_id", jobId),
          supabase.from("transaction_products").delete().eq("transaction_id", jobId),
        ]);
      } else {
        const { data, error } = await supabase
          .from("transaction_list")
          .insert([
            {
              ...payload,
              del_status: 0,
              date_created: (() => {
                const p = new Intl.DateTimeFormat("en-CA", {
                  timeZone: "Asia/Kolkata",
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                }).formatToParts(new Date());
                const g = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
                return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:${g("second")}+05:30`;
              })(),
            },
          ])
          .select("id")
          .single();
        if (error) throw error;
        txnId = data.id;
      }

      // Insert services
      if (serviceRows.length > 0) {
        const { error } = await supabase.from("transaction_services").insert(
          serviceRows.map((r) => ({
            transaction_id: txnId,
            service_id: r.service_id,
            service_name: r.service_name,
            price: r.price,
          }))
        );
        if (error) throw error;
      }

      // Insert products
      if (productRows.length > 0) {
        const { error } = await supabase.from("transaction_products").insert(
          productRows.map((r) => ({
            transaction_id: txnId,
            product_id: r.product_id,
            product_name: r.product_name,
            qty: r.qty,
            price: r.price,
          }))
        );
        if (error) throw error;
      }

      // Increment job_id_counter after successful save (new job only)
      if (!isEdit) {
        await bumpJobCounter(parseInt(jobCode));
        await logActivity(
          "Created New Job",
          "Jobs",
          txnId ?? undefined,
          `Job #${jobCode} for ${selectedClient.fullname} — Amount: ₹${grandTotal.toLocaleString("en-IN")}`
        );
      } else {
        await logActivity(
          "Updated Job Details",
          "Jobs",
          jobId,
          `Job #${jobCode} — ${item || "No item"} | ${serviceRows.length} service(s), ${productRows.length} product(s)`
        );
      }

      setToast({
        type: "success",
        msg: isEdit ? "Job update ho gaya! ✅" : "Naya job create ho gaya! ✅",
      });
      setTimeout(() => router.replace(`/jobs/${txnId}/view`), 1000);
    } catch (e) {
      logger.error("save error:", e instanceof Error ? e.message : JSON.stringify(e));
      setToast({ type: "error", msg: e instanceof Error ? e.message : "Save karne mein galti!" });
    } finally {
      setSaving(false);
    }
  };

  // ── COMPUTED TOTALS ───────────────────────────────────────────────────
  const serviceTotal = serviceRows.reduce((sum, r) => sum + (r.price || 0), 0);
  const productTotal = productRows.reduce((sum, r) => sum + (r.price || 0) * r.qty, 0);
  const grandTotal = serviceTotal + productTotal;

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────────────────────────────────────
  if (fetchLoading)
    return <PageLoader icon={Briefcase} label="loading job..." tone="blue" />;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d1117] text-white font-sans">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-bold transition-all ${
            toast.type === "success"
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              : "bg-red-500/15 border-red-500/30 text-red-400"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Add New Client Modal */}
      {showAddClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-md shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-[#21293d]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center">
                  <User size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Add New Client</h3>
                  <p className="text-xs text-slate-500">Create a new client for this job</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddClientModal(false)}
                className="w-8 h-8 flex items-center justify-center bg-[#111520] hover:bg-[#21293d] rounded-lg text-slate-500 hover:text-white transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>
                    First Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newClientForm.firstname}
                    onChange={(e) => setNewClientForm((p) => ({ ...p, firstname: e.target.value }))}
                    placeholder="Vikram"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Middle Name</label>
                  <input
                    type="text"
                    value={newClientForm.middlename}
                    onChange={(e) =>
                      setNewClientForm((p) => ({ ...p, middlename: e.target.value }))
                    }
                    placeholder="Jain"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>
                  Last Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newClientForm.lastname}
                  onChange={(e) => setNewClientForm((p) => ({ ...p, lastname: e.target.value }))}
                  placeholder="Jain"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  Contact Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  value={newClientForm.contact}
                  onChange={(e) => setNewClientForm((p) => ({ ...p, contact: e.target.value }))}
                  placeholder="9876543210"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input
                  type="email"
                  value={newClientForm.email}
                  onChange={(e) => setNewClientForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="client@email.com"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Address</label>
                <textarea
                  value={newClientForm.address}
                  onChange={(e) => setNewClientForm((p) => ({ ...p, address: e.target.value }))}
                  placeholder="Customer address..."
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center gap-3 p-5 border-t border-[#21293d]">
              <button
                onClick={handleSaveNewClient}
                disabled={savingClient}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
              >
                {savingClient ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    Save Client
                  </>
                )}
              </button>
              <button
                onClick={() => setShowAddClientModal(false)}
                className="px-6 py-2.5 bg-[#111520] hover:bg-[#21293d] border border-[#21293d] text-slate-400 hover:text-white rounded-xl font-bold text-sm transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
        {/* ── PAGE HEADER ─────────────────────────────────────────────── */}
        <div className="relative overflow-hidden bg-[#161b27] rounded-3xl border border-[#21293d] p-5">
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-600/8 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex items-center gap-4">
            <Link
              href={isEdit ? `/jobs/${jobId}/view` : "/jobs"}
              className="w-10 h-10 flex items-center justify-center bg-[#111520] border border-[#21293d] hover:border-slate-500 rounded-xl text-slate-500 hover:text-white transition-all flex-shrink-0"
            >
              <ArrowLeft size={17} />
            </Link>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 ${
                  isEdit
                    ? "bg-gradient-to-br from-amber-500 to-amber-700 shadow-amber-900/40"
                    : "bg-gradient-to-br from-blue-500 to-blue-700 shadow-blue-900/40"
                }`}
              >
                <Wrench className="text-white" size={20} />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-black tracking-tight text-white leading-none">
                  {isEdit ? `Edit Job — ${jobCode}` : "New Job"}
                </h1>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">
                  {isEdit ? "Update existing job details" : "Create a new repair job"}
                </p>
              </div>
            </div>
            {/* Job Code badge */}
            {jobCode && (
              <div className="hidden sm:block text-right flex-shrink-0">
                <p className="text-[9px] text-slate-600 uppercase tracking-wider">Job No.</p>
                <p className="text-sm font-black text-blue-400 font-mono">{jobCode}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── SECTION 1: CLIENT + JOB NO + MECHANIC ─────────────────── */}
        <div className="bg-[#161b27] rounded-2xl border border-[#21293d] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 mb-4">
            1. Client & Assignment
          </p>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Client dropdown — col 6 */}
            <div className="md:col-span-6">
              <div className="flex items-center gap-2 mb-1.5">
                <label className={labelCls}>
                  <User size={13} className="text-blue-400" />
                  Client <span className="text-red-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddClientModal(true)}
                  className="text-[10px] font-bold text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
                >
                  + Add New Client
                </button>
              </div>
              <SearchableSelect
                value={selectedClient?.id ?? null}
                options={clients.map((c) => ({ id: c.id, label: c.fullname, sub: c.contact }))}
                onSelect={(id) => {
                  const c = clients.find((x) => String(x.id) === id);
                  if (c) {
                    setSelectedClient(c);
                    fetchClientBalance(c.id);
                  }
                }}
                placeholder="Search client (name/contact)…"
                searchPlaceholder="Name ya contact se search karo…"
                emptyText="Koi client nahi mila"
                renderSelected={(opt) => (
                  <div>
                    <div className="font-bold text-white text-sm">{opt.label}</div>
                    <div className="text-blue-400 text-xs">{opt.sub}</div>
                  </div>
                )}
              />

              {/* Client balance chip */}
              {clientBalance && (
                <div
                  className={`mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black border ${
                    clientBalance.type === "due"
                      ? "bg-red-500/10 border-red-500/20 text-red-400"
                      : clientBalance.type === "advance"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-slate-500/10 border-slate-500/20 text-slate-500"
                  }`}
                >
                  <IndianRupee size={10} />
                  {clientBalance.label}: {inr(clientBalance.amount)}
                </div>
              )}
            </div>

            {/* Job Code — col 2 */}
            <div className="md:col-span-2">
              <label className={labelCls}>
                <Hash size={13} className="text-slate-600" />
                Job No.
              </label>
              <input
                value={jobCode}
                readOnly
                className={`${inputCls} opacity-60 cursor-not-allowed font-mono text-xs`}
              />
            </div>

            {/* Mechanic — col 4 */}
            <div className="md:col-span-4">
              <label className={labelCls}>
                <UserCog size={13} className="text-purple-400" />
                Mechanic <span className="text-red-400">*</span>
              </label>
              <SearchableSelect
                value={selectedMechanic || null}
                options={mechanics.map((m) => ({
                  id: m.id,
                  label: m.fullname,
                  sub:
                    (userRole === "admin" || userRole === "developer") && m.commission_percent > 0
                      ? `${m.commission_percent}% commission`
                      : undefined,
                }))}
                onSelect={(id) => setSelectedMechanic(id)}
                placeholder="— Select Mechanic —"
                searchPlaceholder="Mechanic ka naam type karo…"
                emptyText="Koi mechanic nahi mila"
              />
            </div>
          </div>
        </div>

        {/* ── SECTION 2: DEVICE INFO ────────────────────────────────── */}
        <div className="bg-[#161b27] rounded-2xl border border-[#21293d] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 mb-4">
            2. Device Information
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                <Smartphone size={13} className="text-blue-400" />
                Item / Model <span className="text-red-400">*</span>
              </label>
              <input
                value={item}
                onChange={(e) => setItem(e.target.value)}
                placeholder="e.g. iPhone 15 Pro, Samsung S24"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>
                <AlertCircle size={13} className="text-red-400" />
                Fault Reported <span className="text-red-400">*</span>
              </label>
              <input
                value={fault}
                onChange={(e) => setFault(e.target.value)}
                placeholder="e.g. Screen broken, Not charging"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>
                <MapPin size={13} className="text-amber-400" />
                Location / Spot
              </label>
              <JobSpotPicker
                value={locId}
                onSelect={(id, spot) => {
                  setLocId(id);
                  setLocName(spot?.name || "");
                }}
              />
            </div>
            <div>
              <label className={labelCls}>
                <MessageSquare size={13} className="text-slate-600" />
                Remarks
              </label>
              <input
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Any additional notes…"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* ── SECTION 3: SERVICES + PRODUCTS ───────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* SERVICES */}
          <div className="bg-[#161b27] rounded-2xl border border-[#21293d] p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Wrench size={15} className="text-blue-400" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Services
                </p>
              </div>
              <span className="text-[10px] font-black text-blue-400">
                Total: {inr(serviceTotal)}
              </span>
            </div>

            {/* Add service — searchable, add on pick */}
            <div className="mb-3">
              <SearchableSelect
                value={null}
                options={services.map((s) => ({ id: s.id, label: s.name, sub: inr(s.price) }))}
                onSelect={(id) => addService(parseInt(id))}
                placeholder="— Service search karke select karo —"
                searchPlaceholder="Service ka naam type karo…"
                emptyText="Koi service nahi mili"
              />
            </div>

            {/* Service table */}
            <div className="space-y-0 border border-[#21293d] rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1fr_90px_36px] bg-[#111520] px-3 py-2">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-600">
                  Service
                </span>
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-600 text-right">
                  Amount
                </span>
                <span />
              </div>
              {serviceRows.length === 0 ? (
                <div className="px-3 py-6 text-center text-slate-700 text-xs">
                  Koi service add nahi ki
                </div>
              ) : (
                serviceRows.map((r) => (
                  <div
                    key={r.tempId}
                    className="grid grid-cols-[1fr_90px_36px] items-center px-3 py-2 border-t border-[#21293d] hover:bg-white/[0.02]"
                  >
                    <input
                      value={r.service_name}
                      onChange={(e) => updateServiceName(r.tempId, e.target.value)}
                      className="bg-transparent text-white text-sm font-medium outline-none focus:text-blue-300 transition-colors w-full"
                    />
                    <input
                      type="number"
                      value={r.price}
                      onChange={(e) => updateServicePrice(r.tempId, e.target.value)}
                      className="bg-transparent text-emerald-400 text-sm font-black text-right outline-none focus:text-emerald-300 transition-colors w-full"
                    />
                    <button
                      onClick={() => removeService(r.tempId)}
                      className="flex justify-end text-slate-700 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* PRODUCTS */}
          <div className="bg-[#161b27] rounded-2xl border border-[#21293d] p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package size={15} className="text-emerald-400" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Products
                </p>
              </div>
              <span className="text-[10px] font-black text-emerald-400">
                Total: {inr(productTotal)}
              </span>
            </div>

            {/* Add product — searchable, add on pick */}
            <div className="mb-3">
              <SearchableSelect
                value={null}
                options={products.map((p) => ({
                  id: p.id,
                  label: p.name,
                  sub: `${inr(p.price)} — ${p.available_stock > 0 ? `Stock: ${p.available_stock}` : "Stock khatam"}`,
                }))}
                onSelect={(id) => addProduct(parseInt(id))}
                placeholder="— Product search karke select karo —"
                searchPlaceholder="Product ka naam type karo…"
                emptyText="Koi product nahi mila"
              />
            </div>

            {/* Product table */}
            <div className="space-y-0 border border-[#21293d] rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1fr_50px_80px_80px_36px] bg-[#111520] px-3 py-2">
                {["Product", "Qty", "Price", "Total", ""].map((h) => (
                  <span
                    key={h}
                    className="text-[9px] font-black uppercase tracking-wider text-slate-600 last:col-span-1"
                  >
                    {h}
                  </span>
                ))}
              </div>
              {productRows.length === 0 ? (
                <div className="px-3 py-6 text-center text-slate-700 text-xs">
                  Koi product add nahi kiya
                </div>
              ) : (
                productRows.map((r) => {
                  const stock = products.find((p) => p.id === r.product_id)?.available_stock ?? 0;
                  const overStock = !isEdit && r.qty > stock;
                  return (
                    <div
                      key={r.tempId}
                      className={`grid grid-cols-[1fr_50px_80px_80px_36px] items-center px-3 py-2 border-t border-[#21293d] hover:bg-white/[0.02] ${overStock ? "bg-amber-500/5" : ""}`}
                    >
                      <span
                        className="text-white text-xs font-medium truncate"
                        title={r.product_name}
                      >
                        {r.product_name}
                      </span>
                      <input
                        type="number"
                        min={1}
                        value={r.qty}
                        onChange={(e) => updateProductQty(r.tempId, e.target.value)}
                        className={`bg-transparent text-center text-sm font-black outline-none w-full transition-colors ${overStock ? "text-amber-400" : "text-white"}`}
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={r.price}
                        onChange={(e) => updateProductPrice(r.tempId, e.target.value)}
                        className="bg-transparent text-right text-sm font-medium text-slate-300 outline-none w-full"
                      />
                      <span className="text-emerald-400 text-xs font-black text-right pr-1">
                        {inr(r.qty * r.price)}
                      </span>
                      <button
                        onClick={() => removeProduct(r.tempId)}
                        className="flex justify-end text-slate-700 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── SECTION 4: TOTALS + COMMISSION ────────────────────────── */}
        <div className="bg-[#161b27] rounded-2xl border border-[#21293d] p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Grand Total */}
            <div className="bg-gradient-to-br from-blue-600/15 to-blue-800/10 border border-blue-500/20 rounded-2xl px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Total Payable
                </p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-slate-500 text-sm">₹</span>
                  <span className="text-3xl font-black text-white">
                    {grandTotal.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex gap-3 mt-1">
                  <span className="text-[10px] text-blue-400">Services: {inr(serviceTotal)}</span>
                  <span className="text-[10px] text-emerald-400">
                    Products: {inr(productTotal)}
                  </span>
                </div>
              </div>
              <IndianRupee className="text-blue-500/30" size={48} strokeWidth={1.5} />
            </div>

            {/* Mechanic Commission — admin/developer only */}
            {(userRole === "admin" || userRole === "developer") && (
              <div>
                <label className={labelCls}>Mechanic Commission (₹)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={commissionAmt}
                    onChange={(e) => setCommissionAmt(e.target.value)}
                    className={inputCls}
                    placeholder="0.00"
                  />
                  {(() => {
                    const mech = mechanics.find((m) => m.id === parseInt(selectedMechanic));
                    return selectedMechanic && mech && mech.commission_percent > 0 ? (
                      <p className="text-[9px] text-slate-600 mt-1">
                        Auto: {mech.commission_percent}% of services total
                      </p>
                    ) : null;
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── SAVE BUTTON ───────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pb-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex-1 md:flex-none md:px-16 py-3.5 text-white rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-lg text-sm uppercase tracking-wide active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
              isEdit
                ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/20"
                : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/20"
            }`}
          >
            {saving ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save size={17} strokeWidth={2.5} />
                {isEdit ? "Update Job" : "Create Job"}
              </>
            )}
          </button>
          <Link
            href={isEdit ? `/jobs/${jobId}/view` : "/jobs"}
            className="px-6 py-3.5 bg-[#111520] border border-[#21293d] hover:border-slate-500 text-slate-400 hover:text-white rounded-2xl font-bold text-sm transition-all no-underline"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
