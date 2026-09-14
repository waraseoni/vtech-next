"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import AdminPage from "@/app/components/AdminPage";
import { supabase, getCachedUser } from "@/lib/supabase";
import { safeImageSrc } from "@/lib/image-utils";
import SupplierFormModal, { SupplierRow, ContactPerson, ContactPhone } from "@/components/SupplierFormModal";
import Lightbox from "@/components/Lightbox";
import { fetchSupplierDues } from "@/lib/supplierPayments";
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
  Phone,
} from "lucide-react";

const waLink = (phone: string) => `https://wa.me/91${phone.replace(/\D/g, "")}`;
const telLink = (phone: string) => `tel:+91${phone.replace(/\D/g, "")}`;

function PhoneChip({ phone, big = false }: { phone: string; big?: boolean }) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 10) {
    return (
      <>
        <a
          href={telLink(phone)}
          title={`Call: ${phone}`}
          className={`font-mono text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1 flex-1 min-w-0 truncate ${big ? "font-bold" : ""}`}
        >
          <Phone size={big ? 10 : 9} className="flex-shrink-0" />
          <span className="truncate">{phone}</span>
        </a>
        <a
          href={waLink(phone)}
          target="_blank"
          rel="noopener noreferrer"
          title={`WhatsApp: ${phone}`}
          className="text-emerald-400 hover:text-emerald-300 hover:scale-110 transition-transform inline-flex flex-shrink-0"
        >
          <MessageCircle size={big ? 13 : 12} />
        </a>
      </>
    );
  }
  return <span className="font-mono truncate">{phone}</span>;
}

function ContactBlock({ persons }: { persons: ContactPerson[] }) {
  if (persons.length === 0) return <span className="text-slate-700 text-xs">—</span>;
  return (
    <div className="flex flex-col gap-2">
      {persons.map((p, i) => (
        <div key={i} className="flex flex-col gap-1 min-w-0">
          {(p.name.trim() !== "" || p.role.trim() !== "") && (
            <div className="flex items-center gap-1">
              {p.is_primary && (
                <Star size={9} className="text-amber-400 flex-shrink-0" fill="currentColor" />
              )}
              <span className="text-slate-500 text-[10px] font-black uppercase tracking-wide truncate">
                {p.name || "Person"}
              </span>
              {p.role && (
                <span className="text-slate-700 text-[10px] normal-case tracking-normal truncate">
                  · {p.role}
                </span>
              )}
            </div>
          )}
          {p.phones.length === 0 ? (
            <span className="text-xs text-slate-700">—</span>
          ) : (
            <div className="flex flex-col gap-1">
              {p.phones.map((ph, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 text-slate-400 text-xs min-w-0"
                >
                  {ph.is_primary && (
                    <Star
                      size={9}
                      className="text-amber-400 flex-shrink-0"
                      fill="currentColor"
                    />
                  )}
                  <span className="text-slate-600 text-[9px] font-black uppercase flex-shrink-0">
                    {ph.label}
                  </span>
                  <span className="flex items-center gap-1.5 min-w-0 flex-1">
                    <PhoneChip phone={ph.phone} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function SuppliersPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [personsMap, setPersonsMap] = useState<Record<number, ContactPerson[]>>({});
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const [err, setErr] = useState("");
  const [userRole, setUserRole] = useState("staff");
  const [zoomSrc, setZoomSrc] = useState("");
  const [duesMap, setDuesMap] = useState<Record<number, number>>({});
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const h = (e: MediaQueryList | MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

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
    const [{ data, error }, { data: personRows }, { data: phoneRows }] = await Promise.all([
      supabase.from("suppliers").select("*").eq("delete_flag", 0).order("name"),
      supabase
        .from("supplier_contact_persons")
        .select("id, supplier_id, name, role, is_primary"),
      supabase
        .from("supplier_contact_phones")
        .select("id, person_id, label, phone, is_primary"),
    ]);
    if (error) setErr(error.message);
    setRows((data || []) as SupplierRow[]);

    const phoneMap: Record<number, ContactPhone[]> = {};
    for (const ph of (phoneRows || []) as Array<ContactPhone & { person_id: number }>) {
      if (!phoneMap[ph.person_id]) phoneMap[ph.person_id] = [];
      phoneMap[ph.person_id].push(ph);
    }
    for (const pid of Object.keys(phoneMap))
      phoneMap[Number(pid)].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));

    const map: Record<number, ContactPerson[]> = {};
    for (const per of (personRows || []) as Array<{
      id: number;
      supplier_id: number;
      name: string;
      role: string | null;
      is_primary: boolean;
    }>) {
      if (!map[per.supplier_id]) map[per.supplier_id] = [];
      map[per.supplier_id].push({
        id: per.id,
        name: per.name,
        role: per.role || "",
        notes: "",
        is_primary: per.is_primary,
        phones: phoneMap[per.id] || [],
      });
    }
    for (const id of Object.keys(map)) {
      map[Number(id)].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
    }
    setPersonsMap(map);
    const dues = await fetchSupplierDues();
    setDuesMap(Object.fromEntries(dues.map((d) => [d.supplierId, d.outstanding])));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const allPhones = (id: number) =>
  (personsMap[id] || []).flatMap((p) => p.phones.map((ph) => ph.phone)).join(" ");

  const personsOf = (s: SupplierRow): ContactPerson[] => {
    const list = personsMap[s.id];
    if (list && list.length) return list;
    if (s.contact)
      return [
        {
          id: undefined,
          name: "",
          role: "",
          notes: "",
          is_primary: true,
          phones: [{ label: "Mobile", phone: s.contact, is_primary: true }],
        },
      ];
    return [];
  };

  const allPersonNames = (id: number) =>
  (personsMap[id] || []).map((p) => p.name).join(" ");

  const filtered = rows.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      allPersonNames(s.id).toLowerCase().includes(search.toLowerCase()) ||
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
        <div className="px-5 py-3.5 border-b border-[#21293d] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search suppliers..."
                className="pl-9 pr-4 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 placeholder:text-slate-700 outline-none focus:border-blue-500 w-full sm:w-64"
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
          <>
            {!isMobile && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#111520]">
                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                      <th className="text-left px-4 py-3">Supplier Name</th>
                      <th className="text-left px-4 py-3">Contact Numbers</th>
                      <th className="text-left px-4 py-3">Email</th>
                      <th className="text-left px-4 py-3">Address</th>
                      <th className="text-center px-4 py-3">Status</th>
                      <th className="text-center px-4 py-3">Due</th>
                      <th className="text-center px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a2234]">
                    {filtered.map((s) => {
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
                                    width={48}
                                    height={48}
                                    className="w-12 h-12 rounded-xl object-cover border border-[#21293d]"
                                  />
                                </button>
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                                  <Truck size={16} className="text-violet-500" />
                                </div>
                              )}
                              <Link
                                href={`/suppliers/${s.id}`}
                                className="font-bold text-slate-200 hover:text-emerald-400 hover:underline transition-colors"
                              >
                                {s.name}
                              </Link>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <ContactBlock persons={personsOf(s)} />
                          </td>
                          <td className="px-4 py-3.5">
                            {s.email ? (
                              <a
                                href={`mailto:${s.email}`}
                                title={`Email: ${s.email}`}
                                className="flex items-center gap-1.5 text-slate-400 hover:text-blue-400 text-xs hover:underline transition-colors"
                              >
                                <Mail size={11} className="text-slate-600" /> {s.email}
                              </a>
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
                              {s.status === 1 ? (
                                <ToggleRight size={14} />
                              ) : (
                                <ToggleLeft size={14} />
                              )}
                              {s.status === 1 ? "Active" : "Inactive"}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {(() => {
                              const due = duesMap[s.id] ?? 0;
                              return (
                                <span
                                  className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                    due > 0
                                      ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                      : due < 0
                                        ? "bg-red-500/10 border-red-500/20 text-red-400"
                                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                  }`}
                                >
                                  ₹{due.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3.5 text-center">
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

            {isMobile && (
              <div className="divide-y divide-[#1a2234]">
                {filtered.map((s) => {
                  const due = duesMap[s.id] ?? 0;
                  const place = [s.city, s.state].filter(Boolean).join(", ");
                  return (
                    <div key={s.id} className="px-4 py-4 space-y-3">
                      {/* Header: visiting card + name + status */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {safeImageSrc(s.photo_url) ? (
                            <button
                              type="button"
                              onClick={() => setZoomSrc(safeImageSrc(s.photo_url))}
                              title="Visiting card bada karke dekho"
                              className="flex-shrink-0 rounded-lg border border-transparent p-0.5 hover:border-blue-500/50 transition-all cursor-zoom-in"
                            >
                              <Image
                                src={safeImageSrc(s.photo_url)}
                                alt={`${s.name} visiting card`}
                                width={40}
                                height={40}
                                className="w-10 h-10 rounded-xl object-cover border border-[#21293d]"
                              />
                            </button>
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                              <Truck size={15} className="text-violet-500" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <Link
                              href={`/suppliers/${s.id}`}
                              className="font-bold text-slate-200 text-sm truncate hover:text-emerald-400 hover:underline transition-colors"
                            >
                              {s.name}
                            </Link>
                            {s.email ? (
                              <a
                                href={`mailto:${s.email}`}
                                title={`Email: ${s.email}`}
                                className="flex items-center gap-1 text-[10px] text-slate-600 truncate hover:text-blue-400 hover:underline transition-colors"
                              >
                                <Mail size={9} className="text-slate-600 flex-shrink-0" />
                                <span className="truncate">{s.email}</span>
                              </a>
                            ) : (
                              <div className="text-[10px] text-slate-700 truncate">
                                {place || "No email"}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => toggleStatus(s)}
                          className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                            s.status === 1
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                              : "bg-slate-500/10 border-slate-500/20 text-slate-500 hover:bg-slate-500/20"
                          }`}
                        >
                          {s.status === 1 ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                          {s.status === 1 ? "Active" : "Inactive"}
                        </button>
                      </div>

                      {/* Due + city */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            due > 0
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                              : due < 0
                                ? "bg-red-500/10 border-red-500/20 text-red-400"
                                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          }`}
                        >
                          {due > 0 ? "Due " : due < 0 ? "Credit " : "Clear "}₹
                          {Math.abs(due).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                        </span>
                        {place && (
                          <span className="flex items-center gap-1 text-[11px] text-slate-500">
                            <MapPin size={10} className="text-slate-600" />
                            {place}
                          </span>
                        )}
                      </div>

                      {/* Contacts */}
                      {personsOf(s).length > 0 && (
                        <div className="bg-[#111520] border border-[#21293d] rounded-xl px-3 py-2.5">
                          <ContactBlock persons={personsOf(s)} />
                        </div>
                      )}

                      {/* Address */}
                      {s.address && (
                        <div className="flex items-start gap-1.5 text-xs text-slate-500">
                          <MapPin size={11} className="text-slate-600 flex-shrink-0 mt-0.5" />
                          <span className="flex-1 min-w-0 truncate" title={s.address}>
                            {s.address}
                          </span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-3 border-t border-[#21293d]">
                        <Link
                          href={`/suppliers/${s.id}`}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#111520] border border-[#21293d] text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition text-xs font-bold"
                        >
                          <Eye size={12} /> View
                        </Link>
                        <button
                          onClick={() => openEdit(s)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#111520] border border-[#21293d] text-slate-400 hover:text-blue-400 hover:border-blue-500/30 transition text-xs font-bold"
                        >
                          <Edit3 size={12} /> Edit
                        </button>
                        {userRole === "admin" && (
                          <button
                            onClick={() => handleDelete(s.id, s.name)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#111520] border border-[#21293d] text-slate-400 hover:text-red-400 hover:border-red-500/30 transition text-xs font-bold"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
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
