"use client";

import { useEffect, useState, useCallback } from "react";
import AdminPage from "@/app/components/AdminPage";
import { supabase, getCachedUser } from "@/lib/supabase";
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Package,
  MapPin,
  FileText,
  Boxes,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { openImageLightbox } from "@/components/ImageLightbox";
import { safeImageSrc } from "@/lib/image-utils";
import ProductFormModal from "@/components/ProductFormModal";

type Product = {
  id: number;
  name: string;
  description: string;
  cost_price: number;
  price: number;
  hsn: string;
  barcode: string | null;
  alert_quantity: number;
  status: number;
  delete_flag: number;
  image_path?: string | null;
};

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function ProductsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [err, setErr] = useState("");
  const [userRole, setUserRole] = useState("staff");

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const h = (e: MediaQueryList | MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // Pagination
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

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
    const { data, error } = await supabase
      .from("product_list")
      .select(
        "id, name, description, cost_price, price, hsn, barcode, alert_quantity, status, delete_flag, image_path"
      )
      .eq("delete_flag", 0)
      .order("name");
    if (error) setErr(error.message);
    setRows((data || []) as Product[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = rows.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode || "").toLowerCase().includes(search.toLowerCase())
  );

  // Reset page on search change
  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  const pageCount = Math.max(
    1,
    Math.ceil(filtered.length / (pageSize === 0 ? filtered.length : pageSize))
  );
  const safePage = Math.min(page, pageCount);
  const paginated =
    pageSize === 0 ? filtered : filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const openAdd = () => {
    setEditing(null);
    setShowModal(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    setShowModal(true);
  };

  const handleDelete = async (id: number, name: string) => {
    if (userRole !== "admin") {
      alert("Sirf Admin delete kar sakta hai!");
      return;
    }
    if (!confirm(`"${name}" ko delete karna hai?`)) return;
    await supabase.from("product_list").update({ delete_flag: 1 }).eq("id", id);
    fetchData();
  };

  const toggleStatus = async (p: Product) => {
    if (userRole !== "admin") {
      alert("Sirf Admin status change kar sakta hai!");
      return;
    }
    await supabase
      .from("product_list")
      .update({ status: p.status === 1 ? 0 : 1 })
      .eq("id", p.id);
    fetchData();
  };

  const totalValue = filtered.reduce((s, p) => s + (p.price || 0), 0);

  return (
    <AdminPage title="Products" subtitle="Product catalog management">
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
                placeholder="Search products..."
                className="pl-9 pr-4 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 placeholder:text-slate-700 outline-none focus:border-blue-500 w-full sm:w-64"
              />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              {filtered.length} of {rows.length} products
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/inventory"
              className="flex items-center gap-1.5 px-3 py-2 bg-[#0d1117] border border-[#21293d] text-slate-500 hover:text-white rounded-xl text-xs font-bold transition-all"
            >
              <Boxes size={13} /> Inventory
            </Link>
            <Link
              href="/inventory/locate"
              className="flex items-center gap-1.5 px-3 py-2 bg-[#0d1117] border border-[#21293d] text-slate-500 hover:text-white rounded-xl text-xs font-bold transition-all"
            >
              <MapPin size={13} /> Spare Finder
            </Link>
            <Link
              href="/inventory/purchase-orders"
              className="flex items-center gap-1.5 px-3 py-2 bg-[#0d1117] border border-[#21293d] text-slate-500 hover:text-white rounded-xl text-xs font-bold transition-all"
            >
              <FileText size={13} /> POs
            </Link>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all"
            >
              <Plus size={14} /> Add Product
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
          <div className="px-5 py-12 text-center text-slate-600 text-sm">No products found.</div>
        ) : (
          <>
            {!isMobile && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#111520]">
                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                      <th className="text-left px-4 py-3">Product Name</th>
                      <th className="text-left px-4 py-3">Description</th>
                      <th className="text-center px-4 py-3">HSN</th>
                      <th className="text-center px-4 py-3">Barcode</th>
                      <th className="text-right px-4 py-3">Cost Price</th>
                      <th className="text-right px-4 py-3">Selling Price</th>
                      <th className="text-right px-4 py-3">Margin</th>
                      <th className="text-center px-4 py-3">Status</th>
                      <th className="text-center px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a2234]">
                    {paginated.map((p) => {
                      const margin =
                        p.price > 0 && p.cost_price > 0
                          ? ((p.price - p.cost_price) / p.price) * 100
                          : null;
                      return (
                        <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              {safeImageSrc(p.image_path) ? (
                                <Image
                                  src={safeImageSrc(p.image_path)}
                                  alt={p.name}
                                  width={48}
                                  height={48}
                                  className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-[#21293d] cursor-zoom-in"
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    openImageLightbox(p.image_path, p.name);
                                  }}
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = "none";
                                  }}
                                />
                              ) : (
                                <Package size={14} className="text-amber-500 flex-shrink-0" />
                              )}
                              <span className="font-bold text-slate-200">{p.name}</span>
                            </div>
                          </td>
                          <td
                            className="px-4 py-3.5 text-slate-500 text-xs max-w-[180px] truncate"
                            title={p.description || ""}
                          >
                            {p.description || "—"}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {p.hsn ? (
                              <span className="inline-block px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded text-[10px] font-bold">
                                {p.hsn}
                              </span>
                            ) : (
                              <span className="text-slate-700 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {p.barcode ? (
                              <span className="inline-block px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded text-[10px] font-mono font-bold">
                                {p.barcode}
                              </span>
                            ) : (
                              <span className="text-slate-700 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right text-slate-400">
                            {inr(p.cost_price)}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className="font-black text-emerald-400">{inr(p.price)}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {margin !== null ? (
                              <span
                                className={`font-bold text-xs ${margin >= 20 ? "text-emerald-400" : margin >= 10 ? "text-amber-400" : "text-red-400"}`}
                              >
                                {margin.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-slate-700 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <button
                              onClick={() => toggleStatus(p)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                                p.status === 1
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                                  : "bg-slate-500/10 border-slate-500/20 text-slate-500 hover:bg-slate-500/20"
                              }`}
                            >
                              {p.status === 1 ? (
                                <ToggleRight size={14} />
                              ) : (
                                <ToggleLeft size={14} />
                              )}
                              {p.status === 1 ? "Active" : "Inactive"}
                            </button>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openEdit(p)}
                                className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition"
                              >
                                <Edit3 size={13} />
                              </button>
                              {userRole === "admin" && (
                                <button
                                  onClick={() => handleDelete(p.id, p.name)}
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
                  <tfoot>
                    <tr className="bg-[#111520] border-t border-[#21293d]">
                      <td
                        colSpan={4}
                        className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-600"
                      >
                        Total Value:
                      </td>
                      <td className="px-4 py-3 text-right font-black text-emerald-400">
                        {inr(totalValue)}
                      </td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {isMobile && (
              <div className="divide-y divide-[#1a2234]">
                {paginated.map((p) => {
                  const margin =
                    p.price > 0 && p.cost_price > 0
                      ? ((p.price - p.cost_price) / p.price) * 100
                      : null;
                  return (
                    <div key={p.id} className="px-4 py-4 space-y-3">
                      {/* Header: image + name + status */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {safeImageSrc(p.image_path) ? (
                            <Image
                              src={safeImageSrc(p.image_path)}
                              alt={p.name}
                              width={40}
                              height={40}
                              className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-[#21293d] cursor-zoom-in"
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                openImageLightbox(p.image_path, p.name);
                              }}
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-[#21293d] flex items-center justify-center flex-shrink-0">
                              <Package size={16} className="text-amber-500" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-slate-200 text-sm truncate">
                              {p.name}
                            </div>
                            <div className="text-xs text-slate-600 truncate">
                              {p.description || "—"}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleStatus(p)}
                          className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                            p.status === 1
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                              : "bg-slate-500/10 border-slate-500/20 text-slate-500 hover:bg-slate-500/20"
                          }`}
                        >
                          {p.status === 1 ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                          {p.status === 1 ? "Active" : "Inactive"}
                        </button>
                      </div>

                      {/* Badges: HSN + barcode */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {p.hsn && (
                          <span className="inline-block px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded text-[10px] font-bold">
                            {p.hsn}
                          </span>
                        )}
                        {p.barcode ? (
                          <span className="inline-block px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded text-[10px] font-mono font-bold">
                            {p.barcode}
                          </span>
                        ) : (
                          <span className="text-slate-700 text-[10px]">No barcode</span>
                        )}
                      </div>

                      {/* Prices row */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-[#0d1117] border border-[#1a2234] rounded-xl px-2 py-2 text-center">
                          <div className="text-[8px] font-black uppercase tracking-widest text-slate-600">
                            Cost
                          </div>
                          <div className="text-slate-400 text-xs font-bold mt-0.5">
                            {inr(p.cost_price)}
                          </div>
                        </div>
                        <div className="bg-[#0d1117] border border-[#1a2234] rounded-xl px-2 py-2 text-center">
                          <div className="text-[8px] font-black uppercase tracking-widest text-slate-600">
                            Selling
                          </div>
                          <div className="text-emerald-400 text-xs font-black mt-0.5">
                            {inr(p.price)}
                          </div>
                        </div>
                        <div className="bg-[#0d1117] border border-[#1a2234] rounded-xl px-2 py-2 text-center">
                          <div className="text-[8px] font-black uppercase tracking-widest text-slate-600">
                            Margin
                          </div>
                          <div
                            className={`text-xs font-black mt-0.5 ${margin !== null ? (margin >= 20 ? "text-emerald-400" : margin >= 10 ? "text-amber-400" : "text-red-400") : "text-slate-600"}`}
                          >
                            {margin !== null ? `${margin.toFixed(1)}%` : "—"}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition text-xs font-bold"
                        >
                          <Edit3 size={13} /> Edit
                        </button>
                        {userRole === "admin" && (
                          <button
                            onClick={() => handleDelete(p.id, p.name)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition text-xs font-bold"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="px-4 py-3 bg-[#111520] flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                    Total Value:
                  </span>
                  <span className="font-black text-emerald-400">{inr(totalValue)}</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-[#21293d]">
            <div className="flex items-center gap-2 text-[11px] text-slate-600 font-bold">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-[#0d1117] border border-[#21293d] text-slate-300 rounded-lg px-2 py-1 text-[11px] font-bold outline-none focus:border-blue-500/60"
              >
                {[10, 25, 50, 100, 0].map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "All" : n}
                  </option>
                ))}
              </select>
              <span>rows</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-3 py-1.5 bg-[#0d1117] border border-[#21293d] hover:border-blue-500/40 text-slate-400 hover:text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="px-3 py-1.5 text-[11px] font-black text-slate-400 bg-[#0d1117] border border-[#21293d] rounded-lg">
                {safePage} / {pageCount}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={safePage >= pageCount}
                className="px-3 py-1.5 bg-[#0d1117] border border-[#21293d] hover:border-blue-500/40 text-slate-400 hover:text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>


      {/* Add/Edit Modal — shared reusable component (products + inventory) */}
      <ProductFormModal
        open={showModal}
        editing={editing}
        onClose={() => setShowModal(false)}
        onSaved={() => fetchData()}
      />
    </AdminPage>
  );
}
