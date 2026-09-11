"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import AdminPage from "@/app/components/AdminPage";
import { supabase, getCachedUser } from "@/lib/supabase";
import { safeImageSrc } from "@/lib/image-utils";
import SupplierFormModal, {
  SupplierRow,
  SupplierContact,
} from "@/components/SupplierFormModal";
import Lightbox from "@/components/Lightbox";
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Truck,
  Mail,
  MapPin,
  Package,
  ClipboardList,
  Eye,
  MessageCircle,
  Star,
} from "lucide-react";

const waLink = (phone: string) => `https://wa.me/91${phone.replace(/\D/g, "")}`;

export default function SuppliersPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [contactsMap, setContactsMap] = useState<Record<number, SupplierContact[]>>({});
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const [err, setErr] = useState("");
  const [userRole, setUserRole] = useState("staff");
  const [zoomSrc, setZoomSrc] = useState("");

  useEffect(() => {
    getCachedUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
        .then(({ data }) => setUserRole(data?.role ?? "staff"));
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data, error }, { data: contactRows }] = await Promise.all([
      supabase
        .from("suppliers")
        .select("*")
        .eq("delete_flag", 0)
        .order("name"),
      supabase.from("supplier_contacts").select("id, supplier_id, label, phone, is_primary"),
    ]);
    if (error) setErr(error.message);
    setRows((data || []) as SupplierRow[]);

    const map: Record<number, SupplierContact[]> = {};
    for (const c of (contactRows || []) as (SupplierContact & { supplier_id: number })[]) {
      if (!map[c.supplier_id]) map[c.supplier_id] = [];
      map[c.supplier_id].push(c);
    }
    for (const id of Object.keys(map)) {
      map[Number(id)].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
    }
    setContactsMap(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const allPhones = (id: number) =>
    (contactsMap[id] || []).map((c) => c.phone).join(" ");

  const filtered = rows.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.contact?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      allPhones(s.id).toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditing(null);
    setShowModal(true);
  };
  const openEdit = (s: SupplierRow) => {
    setEditing(s);
    setShowModal(true);
  };

  const handleDelete = async (id: number, name: string) => {
    if (userRole !== "admin") {
      alert("Sirf Admin delete kar sakta hai!");
      return;
    }
    if (!confirm(`"${name}" ko delete karna hai?`)) return;
    await supabase.from("suppliers").update({ delete_flag: 1 }).eq("id", id);
    fetchData();
  };

  const toggleStatus = async (s: SupplierRow) => {
    if (userRole !== "admin") {
      alert("Sirf Admin status change kar sakta hai!");
      return;
    }
    await supabase
      .from("suppliers")
      .update({ status: s.status === 1 ? 0 : 1 })
      .eq("id", s.id);
    fetchData();
  };

  return (
    <AdminPage title="Suppliers" subtitle="Supplier catalog management">
      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#21293d] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search suppliers..."
                className="pl-9 pr-4 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 placeholder:text-slate-700 outline-none focus:border-blue-500 w-64"
              />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              {filtered.length} of {rows.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/products"
              className="flex items-center gap-1.5 px-3 py-2 bg-[#0d1117] border border-[#21293d] text-slate-500 hover:text-white rounded-xl text-xs font-bold transition-all"
            >
              <Package size={13} /> Products
            </Link>
            <Link
              href="/inventory/purchase-orders"
              className="flex items-center gap-1.5 px-3 py-2 bg-[#0d1117] border border-[#21293d] text-slate-500 hover:text-white rounded-xl text-xs font-bold transition-all"
            >
              <ClipboardList size={13} /> Purchase Orders
            </Link>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all"
            >
              <Plus size={14} /> Add Supplier
            </button>
          </div>
        </div>

        {err && (
          <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">
            {err}
          </div>
        )}

        {loading ? (
          <div className="px-5 py-12 text-center">
            <Loader2 size={24} className="animate-spin text-slate-600 mx-auto mb-2" />
            <p className="text-slate-600 text-xs font-extrabold uppercase tracking-widest">
              Loading...
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-600 text-sm">No suppliers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#111520]">
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  <th className="text-left px-4 py-3">Supplier Name</th>
                  <th className="text-left px-4 py-3">Contact Numbers</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Address</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-center px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2234]">
                {filtered.map((s) => {
                  const contacts =
                    contactsMap[s.id]?.length
                      ? contactsMap[s.id]
                      : s.contact
                        ? [{ label: "Mobile", phone: s.contact, is_primary: true }]
                        : [];
                  return (
                    <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          {safeImageSrc(s.photo_url) ? (
                            <button
                              type="button"
                              onClick={() => setZoomSrc(safeImageSrc(s.photo_url))}
                              title="Visiting card bada karke dekho"
                              className="flex-shrink-0 rounded-lg border border-transparent p-0.5 hover:border-blue-500/50 hover:scale-105 transition-all cursor-zoom-in"
                            >
                              <Image
                                src={safeImageSrc(s.photo_url)}
                                alt={`${s.name} visiting card`}
                                width={36}
                                height={36}
                                className="w-9 h-9 rounded-lg object-cover border border-[#21293d]"
                              />
                            </button>
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                              <Truck size={14} className="text-violet-500" />
                            </div>
                          )}
                          <span className="font-bold text-slate-200">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {contacts.length === 0 ? (
                          <span className="text-slate-700 text-xs">—</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {contacts.map((c, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-1.5 text-slate-400 text-xs"
                              >
                                {c.is_primary && (
                                  <Star
                                    size={9}
                                    className="text-amber-400 flex-shrink-0"
                                    fill="currentColor"
                                  />
                                )}
                                <span className="text-slate-600 text-[9px] font-black uppercase flex-shrink-0">
                                  {c.label}
                                </span>
                                <span className="font-mono">{c.phone}</span>
                                {c.phone.replace(/\D/g, "").length >= 10 && (
                                  <a
                                    href={waLink(c.phone)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={`WhatsApp: ${c.phone}`}
                                    className="text-emerald-400 hover:text-emerald-300 hover:scale-110 transition-transform inline-flex"
                                  >
                                    <MessageCircle size={12} />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {s.email ? (
                          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                            <Mail size={11} className="text-slate-600" /> {s.email}
                          </div>
                        ) : (
                          <span className="text-slate-700 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {s.address ? (
                          <div
                            className="flex items-center gap-1.5 text-slate-400 text-xs max-w-[200px] truncate"
                            title={s.address}
                          >
                            <MapPin size={11} className="text-slate-600 flex-shrink-0" />{" "}
                            {s.address}
                          </div>
                        ) : (
                          <span className="text-slate-700 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => toggleStatus(s)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                            s.status === 1
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                              : "bg-slate-500/10 border-slate-500/20 text-slate-500 hover:bg-slate-500/20"
                          }`}
                        >
                          {s.status === 1 ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                          {s.status === 1 ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/suppliers/${s.id}`}
                            className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition"
                          >
                            <Eye size={13} />
                          </Link>
                          <button
                            onClick={() => openEdit(s)}
                            className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition"
                          >
                            <Edit3 size={13} />
                          </button>
                          {userRole === "admin" && (
                            <button
                              onClick={() => handleDelete(s.id, s.name)}
                              className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
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

      <SupplierFormModal
        open={showModal}
        editing={editing}
        onClose={() => setShowModal(false)}
        onSaved={fetchData}
      />

      {zoomSrc && <Lightbox src={zoomSrc} alt="Visiting card" onClose={() => setZoomSrc("")} />}
    </AdminPage>
  );
}