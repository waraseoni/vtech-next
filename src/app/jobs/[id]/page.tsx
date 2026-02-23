"use client";

import React, { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Edit3,
  Printer,
  Smartphone,
  User,
  Clock,
  MapPin,
  Phone,
  IndianRupee,
  Loader2,
  Wrench,
  Cpu,
  MessageSquare,
  Calendar,
  X,
  Plus,
  Trash2,
  CheckCircle,
} from "lucide-react";

// ---------- Types ----------
type Client = {
  id: number;
  firstname: string;
  middlename: string | null;
  lastname: string;
  contact: string | null;
  address: string | null;
  email: string | null;
};

type Mechanic = {
  id: number;
  firstname: string;
  middlename: string | null;
  lastname: string;
};

type Transaction = {
  id: number;
  job_id: string;
  code: string | null;
  client_name: number;
  mechanic_id: number | null;
  item: string;
  fault: string;
  uniq_id: string | null;
  amount: number;
  status: number;
  date_created: string;
  date_updated: string;
  date_completed: string | null;
  remark: string | null;
  del_status: number;
};

type Service = {
  id: number;
  transaction_id: number;
  service_id: number;
  price: number;
  service_name?: string;
};

type Product = {
  id: number;
  transaction_id: number;
  product_id: number;
  qty: number;
  price: number;
  product_name?: string;
};

// ---------- Status Helpers ----------
const statusMap: Record<number, { label: string; explanation: string; color: string }> = {
  0: { label: "Pending", explanation: "Kaam shuru nahi hua hai", color: "bg-gray-100 text-gray-800 border-gray-300" },
  1: { label: "On-Progress", explanation: "Kaam chal raha hai, Jald hi ready hoga", color: "bg-blue-100 text-blue-800 border-blue-300" },
  2: { label: "Done", explanation: "Kaam pura ho gaya hai", color: "bg-green-100 text-green-800 border-green-300" },
  3: { label: "Paid", explanation: "Bill chuka diya gaya hai", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  4: { label: "Cancelled", explanation: "Transaction radd kar diya gaya hai", color: "bg-red-100 text-red-800 border-red-300" },
  5: { label: "Delivered", explanation: "Aapko item mil chuka hai", color: "bg-purple-100 text-purple-800 border-purple-300" },
};

// ---------- Main Component ----------
export default function ViewJobPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [job, setJob] = useState<Transaction | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [mechanic, setMechanic] = useState<Mechanic | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [newStatus, setNewStatus] = useState<number>(0);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [userRole, setUserRole] = useState<string | null>(null);

  // Fetch user role
  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setUserRole(profile?.role || "staff");
      }
    };
    fetchUserRole();
  }, []);

  // Fetch all job-related data
  useEffect(() => {
    const fetchData = async () => {
      // Validate and parse ID
      const rawId = resolvedParams.id;
      const trimmedId = rawId?.trim();
      const numericId = Number(trimmedId);
      if (!trimmedId || isNaN(numericId) || !Number.isInteger(numericId) || numericId <= 0) {
        console.error("Invalid job ID:", rawId);
        setError("Invalid job ID – Job not found");
        setLoading(false);
        return;
      }
      const jobId = numericId;

      try {
        setLoading(true);
        setError(null);

        // 1. Fetch transaction (only non-deleted)
        const { data: txn, error: txnError } = await supabase
          .from("transaction_list")
          .select("*")
          .eq("id", jobId)
          .eq("del_status", 0)
          .single();

        if (txnError) {
          console.error("Transaction fetch error:", txnError);
          setError("Transaction not found");
          setLoading(false);
          return;
        }
        setJob(txn);

        // 2. Fetch client
        const { data: clientData, error: clientError } = await supabase
          .from("client_list")
          .select("*")
          .eq("id", txn.client_name)
          .single();

        if (clientError) {
          console.error("Client fetch error:", clientError);
          setError("Client not found");
          setLoading(false);
          return;
        }
        setClient(clientData);

        // 3. Fetch mechanic if assigned
        if (txn.mechanic_id) {
          const { data: mechanicData, error: mechanicError } = await supabase
            .from("mechanic_list")
            .select("*")
            .eq("id", txn.mechanic_id)
            .single();

          if (!mechanicError) setMechanic(mechanicData);
        }

        // 4. Fetch services
        const { data: servicesData, error: servicesError } = await supabase
          .from("transaction_services")
          .select("*, service_list(name)")
          .eq("transaction_id", jobId);

        if (!servicesError) {
          setServices(
            servicesData.map((s: any) => ({
              ...s,
              service_name: s.service_list?.name,
            }))
          );
        } else {
          console.error("Services fetch error:", servicesError);
        }

        // 5. Fetch products
        const { data: productsData, error: productsError } = await supabase
          .from("transaction_products")
          .select("*, product_list(name)")
          .eq("transaction_id", jobId);

        if (!productsError) {
          setProducts(
            productsData.map((p: any) => ({
              ...p,
              product_name: p.product_list?.name,
            }))
          );
        } else {
          console.error("Products fetch error:", productsError);
        }

      } catch (err) {
        console.error("Unexpected error:", err);
        setError("An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [resolvedParams.id]);

  // Helper: format date
  const formatDate = (dateStr?: string, includeTime = false) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      ...(includeTime && { hour: "2-digit", minute: "2-digit" }),
    });
  };

  // Helper: get full client name
  const getClientFullName = () => {
    if (!client) return "Unknown Client";
    const parts = [client.firstname, client.middlename, client.lastname].filter(Boolean);
    return parts.join(" ").trim();
  };

  // Helper: get full mechanic name
  const getMechanicFullName = () => {
    if (!mechanic) return null;
    const parts = [mechanic.firstname, mechanic.middlename, mechanic.lastname].filter(Boolean);
    return parts.join(" ").trim();
  };

  // Calculate total of products
  const calculateProductTotal = () => {
    return products.reduce((sum, p) => sum + p.qty * p.price, 0);
  };

  // WhatsApp message (same as PHP)
  const sendWA = () => {
    if (!job || !client) return;
    const phone = client.contact?.replace(/\D/g, "");
    if (!phone || phone.length < 10) {
      alert("Valid mobile number nahi mila!");
      return;
    }
    const clientName = getClientFullName();
    const amount = job.amount || 0;
    const formattedAmount = amount.toLocaleString("en-IN");
    const businessName = "Vikram Jain, V-Technologies, Jabalpur, Mob. 9179105875";

    let msg = "";
    switch (job.status) {
      case 0:
        msg = `Namaste ${clientName} ji 🙏!\n\nAapka *${job.item}* repair ke liye register ho gaya hai. 📝\n\n📋 *Details:*\nJob ID: #${job.job_id}\nCode: #${job.code}\nStatus: *Received/Pending*\n\nHum jald hi aapke device ko check karke update denge. Dhanyavaad! ❤️\n\n${businessName}`;
        break;
      case 1:
        msg = `Namaste ${clientName} ji 🙏!\n\nAapke *${job.item}* (Job ID: #${job.job_id}) (Code: #${job.code}) par kaam shuru kar diya gaya hai. 🛠️\n\nStatus: *In-Progress/Repairing*\n\nHamare technician isse jald se jald theek karne ki koshish kar rahe hain. ✨\n\n${businessName}`;
        break;
      case 2:
        msg = `Namaste ${clientName} ji 🙏!\n\nKhushkhabri! Aapka *${job.item}* repair complete ho gaya hai. ✅\n\n📋 *Details:*\nJob ID: #${job.job_id}\nCode: #${job.code}\nBill Amount: *₹${formattedAmount}*\n\nAap workshop par aakar apna device collect kar sakte hain. 🛍️\n\nDhanyavaad! ❤️\n\n${businessName}`;
        break;
      case 3:
      case 5:
        msg = `Namaste ${clientName} ji 🙏!\n\nAapka *${job.item}* (Job ID: #${job.job_id}) (Code: #${job.code}) deliver kar diya gaya hai. 🏁\n\nTotal Paid: *₹${formattedAmount}*\n\nV-Technologies ki seva lene ke liye dhanyavaad. ⭐\n\n${businessName}`;
        break;
      case 4:
        msg = `Namaste ${clientName} ji 🙏!\n\nAapka Job ID: #${job.job_id} (Code: #${job.code}) (*${job.item}*) cancel kar diya gaya hai. ❌\n\nKripya adhik jankari ke liye workshop par sampark karein. 🙏\n\n${businessName}`;
        break;
      default:
        msg = `Namaste ${clientName} ji 🙏!\n\nAapka Job ID: #${job.job_id} (${job.item}) ka status update kar diya gaya hai. Dhanyavaad! ❤️`;
    }
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // Update status
  const handleStatusUpdate = async () => {
    if (!job) return;
    setUpdating(true);
    const updates: any = { status: newStatus };
    if (newStatus === 5) {
      updates.date_completed = new Date().toISOString();
    }
    const { error } = await supabase
      .from("transaction_list")
      .update(updates)
      .eq("id", job.id);

    if (error) {
      alert("Status update failed!");
    } else {
      setJob({ ...job, ...updates });
      setShowStatusModal(false);
    }
    setUpdating(false);
  };

  // Add payment (simple – record in client_payments)
  const handleAddPayment = async () => {
    if (!client || !job) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Enter a valid amount");
      return;
    }
    const { error } = await supabase.from("client_payments").insert({
      client_id: client.id,
      job_id: job.job_id,
      amount: amount,
      payment_mode: paymentMode,
      payment_date: new Date().toISOString().split("T")[0],
    });
    if (error) {
      alert("Payment failed: " + error.message);
    } else {
      alert("Payment recorded successfully!");
      setShowPaymentModal(false);
      setPaymentAmount("");
      // Optionally refresh or update balance
    }
  };

  // Soft delete (admin only)
  const handleDelete = async () => {
    if (userRole !== "admin") {
      alert("Permission Denied: Sirf Admin hi delete kar sakta hai!");
      return;
    }
    if (!confirm("Kya aap pakka is job ko delete karna chahte hain?")) return;
    const { error } = await supabase
      .from("transaction_list")
      .update({ del_status: 1 })
      .eq("id", job!.id);
    if (!error) {
      router.push("/jobs");
    } else {
      alert("Delete failed: " + error.message);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <p className="text-gray-500 font-black italic uppercase tracking-widest animate-pulse">
          Loading Job Details...
        </p>
      </div>
    );
  }

  // Error state (including invalid ID)
  if (error) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <h2 className="text-2xl font-black text-red-600">{error}</h2>
        <Link href="/jobs" className="text-blue-600 font-bold underline">
          ← Back to Jobs
        </Link>
      </div>
    );
  }

  // Not found (should be covered by error, but keep as fallback)
  if (!job || !client) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <h2 className="text-2xl font-black text-gray-900">Job Not Found!</h2>
        <Link href="/jobs" className="text-blue-600 font-bold underline">
          ← Back to Jobs
        </Link>
      </div>
    );
  }

  const statusInfo = statusMap[job.status] || statusMap[0];
  const productTotal = calculateProductTotal();

  return (
    <div className="min-h-screen bg-gray-50 p-3 md:p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/jobs"
              className="p-2 bg-white hover:bg-gray-100 rounded-lg text-gray-600 border border-gray-300 transition-all"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                Transaction Details
              </p>
              <h1 className="text-lg font-bold text-gray-800">
                #{job.job_id} ({job.code})
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/clients/${client.id}`}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1"
            >
              <User size={16} /> View Client
            </Link>
            <a
              href={`/api/gst-bill?type=transaction&id=${job.id}`}
              target="_blank"
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1"
            >
              <Printer size={16} /> GST Bill
            </a>
            <a
              href={`/api/print-bill?job_id=${job.job_id}`}
              target="_blank"
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1"
            >
              <Printer size={16} /> Print Bill
            </a>
            <Link
              href="/jobs"
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1"
            >
              <ArrowLeft size={16} /> Back
            </Link>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Client Information (no avatar) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <User size={16} className="text-blue-600" /> Client Information
              </h3>
              <div className="space-y-2">
                <Link href={`/clients/${client.id}`} className="text-lg font-bold text-gray-800 hover:underline">
                  {getClientFullName()}
                </Link>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone size={14} className="text-blue-600" />
                  <a href={`tel:${client.contact}`}>{client.contact || "—"}</a>
                </div>
                <div className="flex items-start gap-2 text-sm text-gray-600">
                  <MapPin size={14} className="text-blue-600 mt-0.5" />
                  <span>{client.address || "—"}</span>
                </div>
              </div>
            </div>

            {/* Job Details */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Wrench size={16} className="text-blue-600" /> Job Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Mechanic</p>
                  <p className="font-medium">{getMechanicFullName() || "Not Assigned"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Received</p>
                  <p className="font-medium">{formatDate(job.date_created, true)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Job No.</p>
                  <p className="font-mono text-blue-600">#{job.job_id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Code</p>
                  <p className="font-mono">{job.code || "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-500">Location</p>
                  <p className="font-medium">{job.uniq_id || "—"}</p>
                </div>
              </div>
            </div>

            {/* Item Description */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Smartphone size={16} className="text-blue-600" /> Item Description
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Item/Model</p>
                  <p className="font-medium">{job.item}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Fault Reported</p>
                  <p className="text-red-600 bg-red-50 p-2 rounded-lg border border-red-200 text-sm">{job.fault}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Remarks</p>
                  <p className="bg-gray-50 p-2 rounded-lg border border-gray-200 text-sm">
                    {job.remark || "No remarks"}
                  </p>
                </div>
              </div>
            </div>

            {/* Services Table */}
            {services.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Wrench size={16} className="text-blue-600" /> Services Availed
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 border-b border-gray-300">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Service</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">Charge</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {services.map((s) => (
                        <tr key={s.id}>
                          <td className="px-3 py-2">{s.service_name || `Service #${s.service_id}`}</td>
                          <td className="px-3 py-2 text-right font-medium">₹{s.price.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Products Table */}
            {products.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Cpu size={16} className="text-blue-600" /> Products Used
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 border-b border-gray-300">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Product</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-600">Qty</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">Price</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {products.map((p) => (
                        <tr key={p.id}>
                          <td className="px-3 py-2">{p.product_name || `Product #${p.product_id}`}</td>
                          <td className="px-3 py-2 text-center">{p.qty}</td>
                          <td className="px-3 py-2 text-right">₹{p.price.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-medium">₹{(p.qty * p.price).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-300">
                      <tr>
                        <th colSpan={3} className="px-3 py-2 text-right font-bold">Products Total:</th>
                        <th className="px-3 py-2 text-right font-bold">₹{productTotal.toFixed(2)}</th>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="lg:col-span-5 space-y-6">
            {/* Status Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Clock size={16} className="text-gray-500" /> Current Job Status
              </h3>
              <div className="text-center">
                <span className={`inline-block px-6 py-3 rounded-full text-lg font-bold border-2 ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
                <p className="text-sm text-gray-600 mt-2">{statusInfo.explanation}</p>
                {job.status === 5 && job.date_completed && (
                  <div className="mt-4 text-green-600 border-t pt-3">
                    <CheckCircle size={20} className="inline mr-1" />
                    <span className="font-bold">Delivered On:</span>
                    <br />
                    <span className="text-lg">{formatDate(job.date_completed, true)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Billing Summary */}
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white rounded-xl shadow-lg border border-emerald-500 p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider opacity-90 mb-3 flex items-center gap-2">
                <IndianRupee size={16} /> Billing Summary
              </h3>
              <div className="flex justify-between items-center border-b border-white/20 pb-3 mb-3">
                <span>Total Amount:</span>
                <span className="text-2xl font-bold">₹{job.amount.toFixed(2)}</span>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black">₹{job.amount.toFixed(2)}</div>
                <p className="text-xs opacity-80 mt-1">Final Payable Amount</p>
              </div>
            </div>

            {/* WhatsApp Button */}
            <button
              onClick={sendWA}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md"
            >
              <Phone size={18} /> Send Status on WhatsApp
            </button>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setNewStatus(job.status);
                  setShowStatusModal(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <Clock size={18} /> Update Status
              </button>
              <Link
                href={`/jobs/edit/${job.id}`}
                className="bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <Edit3 size={18} /> Edit
              </Link>
              <button
                onClick={() => window.print()}
                className="bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <Printer size={18} /> Print Page
              </button>
              <button
                onClick={() => setShowPaymentModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <Plus size={18} /> Add Payment
              </button>
              {userRole === "admin" && (
                <button
                  onClick={handleDelete}
                  className="col-span-2 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} /> Delete Transaction
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Status Update Modal */}
        {showStatusModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Update Status</h3>
                <button onClick={() => setShowStatusModal(false)}>
                  <X size={24} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">New Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(parseInt(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-200 outline-none"
                  >
                    {Object.entries(statusMap).map(([value, info]) => (
                      <option key={value} value={value}>
                        {info.label} – {info.explanation}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowStatusModal(false)}
                    className="flex-1 bg-gray-200 p-3 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStatusUpdate}
                    disabled={updating}
                    className="flex-1 bg-blue-600 text-white p-3 rounded-lg font-medium disabled:opacity-50"
                  >
                    {updating ? "Updating..." : "Update"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Add Payment</h3>
                <button onClick={() => setShowPaymentModal(false)}>
                  <X size={24} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-200 outline-none"
                    placeholder="Enter amount"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-200 outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="flex-1 bg-gray-200 p-3 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddPayment}
                    className="flex-1 bg-emerald-600 text-white p-3 rounded-lg font-medium"
                  >
                    Add Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}