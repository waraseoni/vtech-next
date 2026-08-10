"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import { pageAll } from "@/lib/fetch-all";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";

type ClientRow = {
  id: number;
  firstname: string;
  middlename: string | null;
  lastname: string;
  contact: string;
  email: string | null;
  address: string;
  opening_balance: number | null;
  repair_billed: number;
  direct_sale_billed: number;
  total_paid: number;
  balance: number;
};

type ClientForm = {
  id: number | null;
  firstname: string;
  middlename: string;
  lastname: string;
  contact: string;
  email: string;
  address: string;
  opening_balance: string;
};

type Toast = {
  type: "success" | "error";
  msg: string;
};

const card = "bg-[#161b27] border border-[#21293d] rounded-2xl";
const input =
  "w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all placeholder:text-slate-700";
const label = "block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5";
const btn =
  "px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98]";
const btnPrimary = `${btn} bg-blue-600 hover:bg-blue-500 text-white`;
const btnGhost = `${btn} bg-white/[0.04] hover:bg-white/[0.07] dark:text-slate-300 text-slate-800 border border-[#21293d] dark:border-[#21293d]`;
const btnDanger = `${btn} bg-red-600 hover:bg-red-500 text-white`;

const blankForm: ClientForm = {
  id: null,
  firstname: "",
  middlename: "",
  lastname: "",
  contact: "",
  email: "",
  address: "",
  opening_balance: "0.00",
};

function money(value: number) {
  return `Rs.${Number(value || 0).toFixed(2)}`;
}

function fullName(client: Pick<ClientRow, "firstname" | "middlename" | "lastname">) {
  return [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ").trim();
}

export default function ClientAmtPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<ClientForm>(blankForm);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const { data: cls, error: clientError } = await supabase
        .from("client_list")
        .select("id, firstname, middlename, lastname, contact, email, address, opening_balance")
        .eq("delete_flag", 0)
        .order("firstname", { ascending: true });
      if (clientError) throw clientError;

      const clientList = cls || [];
      if (clientList.length === 0) {
        setClients([]);
        return;
      }

      const ids = clientList.map((client) => client.id);
      const [repairRes, saleRes, paymentRes] = await Promise.all([
        pageAll(supabase.from("transaction_list").select("client_name, amount").eq("status", 5)),
        pageAll(supabase.from("direct_sales").select("client_id, total_amount").in("client_id", ids)),
        pageAll(supabase.from("client_payments").select("client_id, amount, discount").in("client_id", ids)),
      ]);

      const repairMap = new Map<number, number>();
      (repairRes.data || []).forEach((row) => {
        const clientId = Number(row.client_name);
        if (!Number.isNaN(clientId)) {
          repairMap.set(clientId, (repairMap.get(clientId) || 0) + Number(row.amount || 0));
        }
      });

      const saleMap = new Map<number, number>();
      (saleRes.data || []).forEach((row) => {
        if (row.client_id) {
          saleMap.set(row.client_id, (saleMap.get(row.client_id) || 0) + Number(row.total_amount || 0));
        }
      });

      const paymentMap = new Map<number, number>();
      (paymentRes.data || []).forEach((row) => {
        paymentMap.set(
          row.client_id,
          (paymentMap.get(row.client_id) || 0) + Number(row.amount || 0) + Number(row.discount || 0)
        );
      });

      const built = clientList.map((client) => {
        const opening = Number(client.opening_balance || 0);
        const repair = repairMap.get(client.id) || 0;
        const direct = saleMap.get(client.id) || 0;
        const paid = paymentMap.get(client.id) || 0;
        return {
          ...client,
          repair_billed: repair,
          direct_sale_billed: direct,
          total_paid: paid,
          balance: opening + repair + direct - paid,
        };
      });

      built.sort((left, right) => right.balance - left.balance);
      setClients(built);
    } catch (error) {
      console.error("clients-admin fetch error:", error);
      setToast({ type: "error", msg: "Client amount list load nahi hui." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const filteredClients = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return clients;
    return clients.filter((client) => {
      const hay = [
        fullName(client),
        client.contact,
        client.email || "",
        client.address,
        String(client.id),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [clients, search]);

  const totals = useMemo(() => {
    return clients.reduce(
      (acc, client) => {
        acc.clients += 1;
        acc.opening += Number(client.opening_balance || 0);
        acc.collections += Number(client.total_paid || 0);
        if (client.balance > 0) acc.outstanding += client.balance;
        return acc;
      },
      { clients: 0, opening: 0, collections: 0, outstanding: 0 }
    );
  }, [clients]);

  const openCreate = () => {
    setForm(blankForm);
    setShowModal(true);
  };

  const openEdit = (client: ClientRow) => {
    setForm({
      id: client.id,
      firstname: client.firstname,
      middlename: client.middlename || "",
      lastname: client.lastname,
      contact: client.contact || "",
      email: client.email || "",
      address: client.address || "",
      opening_balance: Number(client.opening_balance || 0).toFixed(2),
    });
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setForm(blankForm);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstname.trim() || !form.lastname.trim() || !form.contact.trim() || !form.address.trim()) {
      setToast({ type: "error", msg: "First name, last name, contact aur address required hain." });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        firstname: form.firstname.trim(),
        middlename: form.middlename.trim() || null,
        lastname: form.lastname.trim(),
        contact: form.contact.trim(),
        email: form.email.trim() || null,
        address: form.address.trim(),
        opening_balance: Number(form.opening_balance || 0),
        date_updated: new Date().toISOString(),
      };

      if (form.id) {
        const { error } = await supabase.from("client_list").update(payload).eq("id", form.id);
        if (error) throw error;
        setToast({ type: "success", msg: "Client update ho gaya." });
      } else {
        const { error } = await supabase.from("client_list").insert({
          ...payload,
          delete_flag: 0,
          image_path: null,
        });
        if (error) throw error;
        setToast({ type: "success", msg: "New client add ho gaya." });
      }

      closeModal();
      await fetchClients();
    } catch (error) {
      console.error("client save error:", error);
      setToast({ type: "error", msg: "Client save nahi ho paya." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (client: ClientRow) => {
    const ok = window.confirm(`"${fullName(client)}" ko archive/delete karna hai?`);
    if (!ok) return;
    try {
      const { error } = await supabase
        .from("client_list")
        .update({ delete_flag: 1, date_updated: new Date().toISOString() })
        .eq("id", client.id);
      if (error) throw error;
      setToast({ type: "success", msg: "Client delete ho gaya." });
      await fetchClients();
    } catch (error) {
      console.error("client delete error:", error);
      setToast({ type: "error", msg: "Client delete nahi hua." });
    }
  };

  const sendReminder = (client: ClientRow) => {
    const phone = (client.contact || "").replace(/\D/g, "");
    if (phone.length < 10) {
      setToast({ type: "error", msg: "Valid WhatsApp number nahi mila." });
      return;
    }
    const text =
      client.balance > 0
        ? `Namaste ${fullName(client)} ji, aapka pending balance ${money(client.balance)} hai. Kripya bhugtan karein.`
        : `Namaste ${fullName(client)} ji, V-Tech me aapka account updated hai. Dhanyavaad.`;
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <AdminPage
      title="Client Amount"
      subtitle="Opening balance, total receivable aur client amount adjustments manage karo."
    >
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[100] flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold shadow-2xl ${
            toast.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
              : "border-red-500/30 bg-red-500/15 text-red-400"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="grid gap-3 mb-5 md:grid-cols-4">
        <StatCard label="Total Clients" value={String(totals.clients)} tone="blue" icon={<Users size={16} />} />
        <StatCard label="Opening Balance" value={money(totals.opening)} tone="amber" icon={<RotateCcw size={16} />} />
        <StatCard label="Outstanding Due" value={money(totals.outstanding)} tone="red" icon={<AlertCircle size={16} />} />
        <StatCard label="Collections" value={money(totals.collections)} tone="emerald" icon={<CheckCircle2 size={16} />} />
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="flex flex-col gap-3 px-4 py-4 border-b border-[#21293d] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 max-w-md">
            <label className={label}>Search Client</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, contact, email, address..."
                className={`${input} pl-9`}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={openCreate} className={btnPrimary}>
              <Plus size={13} className="inline-block mr-1" />
              Add Client
            </button>
            <button onClick={fetchClients} className={btnGhost}>
              <RotateCcw size={13} className="inline-block mr-1" />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[260px] items-center justify-center">
            <Loader2 className="animate-spin text-blue-400" size={26} />
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="px-5 py-12 text-sm text-center text-slate-500">Koi client record nahi mila.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="bg-[#111520] text-[10px] font-black uppercase tracking-widest text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left">Client</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-right">Opening</th>
                  <th className="px-4 py-3 text-right">Repair</th>
                  <th className="px-4 py-3 text-right">Sales</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2234]">
                {filteredClients.map((client) => {
                  const balanceTone =
                    client.balance > 0 ? "text-red-400" : client.balance < 0 ? "text-emerald-400" : "text-slate-300";
                  const isRisk = client.balance > 10000;
                  return (
                    <tr key={client.id} className={isRisk ? "bg-red-500/5" : "hover:bg-white/[0.03]"}>
                      <td className="px-4 py-4 align-top">
                        <div className="font-black text-white">{fullName(client)}</div>
                        <div className="mt-1 text-[11px] text-slate-600">ID #{client.id}</div>
                        <div className="mt-1 text-xs text-slate-500">{client.address}</div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="text-slate-300">{client.contact}</div>
                        <div className="mt-1 text-xs text-slate-600">{client.email || "No email"}</div>
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-slate-300">{money(Number(client.opening_balance || 0))}</td>
                      <td className="px-4 py-4 text-right text-slate-300">{money(client.repair_billed)}</td>
                      <td className="px-4 py-4 text-right text-slate-300">{money(client.direct_sale_billed)}</td>
                      <td className="px-4 py-4 text-right text-emerald-300">{money(client.total_paid)}</td>
                      <td className={`px-4 py-4 text-right font-black ${balanceTone}`}>{money(client.balance)}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Link href={`/clients/${client.id}/view`} className={btnGhost}>
                            View
                          </Link>
                          <button onClick={() => sendReminder(client)} className={btnGhost}>
                            <MessageCircle size={12} className="inline-block mr-1" />
                            WA
                          </button>
                          <button onClick={() => openEdit(client)} className={btnGhost}>
                            <Pencil size={12} className="inline-block mr-1" />
                            Edit
                          </button>
                          <button onClick={() => handleDelete(client)} className={btnDanger}>
                            <Trash2 size={12} className="inline-block mr-1" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-[#21293d] bg-[#161b27] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#21293d]">
              <div>
                <h3 className="text-base font-black text-white">
                  {form.id ? "Update Client Amount" : "Add New Client"}
                </h3>
                <p className="text-xs text-slate-600">PHP client amount manager ki tarah opening balance bhi yahin manage hoga.</p>
              </div>
              <button onClick={closeModal} className="p-2 rounded-xl text-slate-500 hover:bg-white/[0.05] hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="px-5 py-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="First Name">
                  <input
                    value={form.firstname}
                    onChange={(e) => setForm((prev) => ({ ...prev, firstname: e.target.value }))}
                    className={input}
                    placeholder="First name"
                  />
                </Field>
                <Field label="Middle Name">
                  <input
                    value={form.middlename}
                    onChange={(e) => setForm((prev) => ({ ...prev, middlename: e.target.value }))}
                    className={input}
                    placeholder="Optional"
                  />
                </Field>
                <Field label="Last Name">
                  <input
                    value={form.lastname}
                    onChange={(e) => setForm((prev) => ({ ...prev, lastname: e.target.value }))}
                    className={input}
                    placeholder="Last name"
                  />
                </Field>
                <Field label="WhatsApp / Contact">
                  <input
                    value={form.contact}
                    onChange={(e) => setForm((prev) => ({ ...prev, contact: e.target.value }))}
                    className={input}
                    placeholder="10 digit mobile"
                  />
                </Field>
                <Field label="Email">
                  <input
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    className={input}
                    placeholder="Optional email"
                  />
                </Field>
                <Field label="Opening Balance">
                  <input
                    type="number"
                    step="0.01"
                    value={form.opening_balance}
                    onChange={(e) => setForm((prev) => ({ ...prev, opening_balance: e.target.value }))}
                    className={input}
                    placeholder="Positive due, negative advance"
                  />
                </Field>
              </div>

              <Field label="Address">
                <textarea
                  value={form.address}
                  onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  rows={4}
                  className={`${input} resize-none`}
                  placeholder="Complete address"
                />
              </Field>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#21293d]">
                <button type="button" onClick={closeModal} className={btnGhost}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className={btnPrimary}>
                  {saving ? <Loader2 size={13} className="inline-block mr-1 animate-spin" /> : <Save size={13} className="inline-block mr-1" />}
                  {form.id ? "Update" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPage>
  );
}

function Field({ label: title, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={label}>{title}</span>
      {children}
    </label>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: "blue" | "amber" | "red" | "emerald";
  icon: React.ReactNode;
}) {
  const tones = {
    blue: "border-blue-500/20 bg-blue-500/8 text-blue-400",
    amber: "border-amber-500/20 bg-amber-500/8 text-amber-400",
    red: "border-red-500/20 bg-red-500/8 text-red-400",
    emerald: "border-emerald-500/20 bg-emerald-500/8 text-emerald-400",
  };

  return (
    <div className={`${card} p-4`}>
      <div className="flex items-center gap-3">
        <div className={`rounded-xl border p-2.5 ${tones[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">{label}</p>
          <p className="text-lg font-black text-white truncate">{value}</p>
        </div>
      </div>
    </div>
  );
}
