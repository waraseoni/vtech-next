"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import { Search, Plus, Edit3, Trash2, ToggleLeft, ToggleRight, X, Loader2, Check, AlertCircle, Package, Camera, ChevronDown, ScanLine, ExternalLink } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { openImageLightbox } from "@/components/ImageLightbox";
import { compressImage } from "@/lib/imageCompression";
import BarcodeCameraScanner from "@/app/components/BarcodeCameraScanner";

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
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [userRole, setUserRole] = useState("staff");

  const [form, setForm] = useState({ name: "", description: "", cost_price: "", price: "", hsn: "", barcode: "", alert_quantity: "" });
  const [formErr, setFormErr] = useState("");
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<number[]>([]);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");
  const supplierRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const h  = (e: MediaQueryList | MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // Pagination
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [barcodeScanning, setBarcodeScanning] = useState(false);
  const [dupWarn, setDupWarn] = useState<Product | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (supplierRef.current && !supplierRef.current.contains(e.target as Node)) {
        setSupplierOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Product image
  const [imgPath,    setImgPath]    = useState("");          // saved image url
  const [imgFile,    setImgFile]    = useState<File | null>(null);
  const [imgPreview, setImgPreview] = useState("");          // displayed image (preview or saved)
  const [imgSaving,  setImgSaving]  = useState(false);
  const [imgRemoved, setImgRemoved] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);

  const handleImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setImgFile(f);
    setImgPreview(URL.createObjectURL(f));
    setImgRemoved(false);
  };

  const removeImg = () => {
    if (imgFile) {
      // Sirf naya selected file discard karo — saved image waisi hi rahe
      setImgFile(null);
      setImgPreview(imgPath);
      setImgRemoved(false);
    } else {
      // Saved image ko delete ke liye mark karo
      setImgFile(null);
      setImgPreview("");
      setImgRemoved(true);
    }
  };

  const uploadProductImage = async (productId: number) => {
    setImgSaving(true);
    try {
      const compressed = await compressImage(imgFile!);
      if (compressed.bytes > 100 * 1024) throw new Error("Image abhi bhi 100KB se bada hai — kam resolution ki photo try karein");
      const fd = new FormData();
      fd.append("file", compressed.file);
      fd.append("productId", String(productId));
      const res = await fetch("/api/product-image", { method: "POST", body: fd });
      const json = await res.json();
      if (json.status !== "success") throw new Error(json.msg || "Upload failed");
      setImgPath(json.url);
    } finally {
      setImgSaving(false);
    }
  };

  const removeProductImage = async (productId: number) => {
    const fd = new FormData();
    fd.append("productId", String(productId));
    fd.append("delete", "1");
    const res = await fetch("/api/product-image", { method: "POST", body: fd });
    const json = await res.json();
    if (json.status !== "success") throw new Error(json.msg || "Delete failed");
    setImgPath("");
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("role").eq("id", user.id).single()
        .then(({ data }) => setUserRole(data?.role ?? "staff"));
    });
  }, []);

  useEffect(() => {
    supabase.from("suppliers").select("id, name").eq("delete_flag", 0).eq("status", 1).order("name")
      .then(({ data }) => setSuppliers((data || []) as { id: number; name: string }[]));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("product_list")
      .select("id, name, description, cost_price, price, hsn, barcode, alert_quantity, status, delete_flag, image_path")
      .eq("delete_flag", 0)
      .order("name");
    if (error) setErr(error.message);
    setRows((data || []) as Product[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = rows.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode || "").toLowerCase().includes(search.toLowerCase())
  );

  // Reset page on search change
  useEffect(() => { setPage(1); }, [search, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / (pageSize === 0 ? filtered.length : pageSize)));
  const safePage = Math.min(page, pageCount);
  const paginated = pageSize === 0
    ? filtered
    : filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Duplicate barcode check: is barcode linked to a DIFFERENT product?
  const checkBarcodeDuplicate = async (value: string, currentId: number | null) => {
    const q = value.trim();
    if (!q) { setDupWarn(null); return; }
    const { data } = await supabase
      .from("product_list")
      .select("id, name, barcode")
      .eq("barcode", q)
      .eq("delete_flag", 0)
      .neq("id", currentId ?? -1)
      .limit(1)
      .single();
    setDupWarn((data as Product | null) ?? null);
  };

  const openAdd = () => { setEditing(null); setForm({ name: "", description: "", cost_price: "", price: "", hsn: "", barcode: "", alert_quantity: "" }); setSelectedSuppliers([]); setSupplierOpen(false); setSupplierSearch(""); setImgPath(""); setImgFile(null); setImgPreview(""); setImgRemoved(false); setFormErr(""); setBarcodeScanning(false); setDupWarn(null); setShowModal(true); };
  const openEdit = (p: Product) => {
    setEditing(p); setForm({ name: p.name, description: p.description || "", cost_price: String(p.cost_price || ""), price: String(p.price || ""), hsn: p.hsn || "", barcode: p.barcode || "", alert_quantity: String(p.alert_quantity || "") }); setImgPath(p.image_path || ""); setImgFile(null); setImgPreview(p.image_path || ""); setImgRemoved(false); setSupplierOpen(false); setSupplierSearch(""); setFormErr(""); setBarcodeScanning(false); setDupWarn(null); setShowModal(true);
    supabase.from("spare_supplier").select("supplier_id").eq("spare_id", p.id)
      .then(({ data }) => setSelectedSuppliers((data || []).map(d => d.supplier_id)));
  };

  const syncSuppliers = async (spareId: number) => {
    await supabase.from("spare_supplier").delete().eq("spare_id", spareId);
    if (selectedSuppliers.length > 0) {
      await supabase.from("spare_supplier").insert(selectedSuppliers.map(supplier_id => ({ spare_id: spareId, supplier_id })));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormErr("Product name zaroori hai!"); return; }
    if (!form.price || parseFloat(form.price) < 0) { setFormErr("Valid selling price daalo!"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        cost_price: parseFloat(form.cost_price) || 0,
        price: parseFloat(form.price),
        hsn: form.hsn.trim().toUpperCase(),
        barcode: form.barcode.trim() || null,
        alert_quantity: parseInt(form.alert_quantity) || 0,
        status: 1,
      };
      if (editing) {
        const { error } = await supabase.from("product_list").update(payload).eq("id", editing.id);
        if (error) throw error;
        await syncSuppliers(editing.id);
        // Image: pehle remove (agar mark kiya ho), phir naya upload
        if (imgRemoved && imgPath) await removeProductImage(editing.id);
        if (imgFile) await uploadProductImage(editing.id);
      } else {
        const { data: inserted, error } = await supabase.from("product_list").insert([{ ...payload, delete_flag: 0 }]).select("id");
        if (error) throw error;
        if (inserted && inserted[0]) {
          await syncSuppliers(inserted[0].id);
          if (imgFile) await uploadProductImage(inserted[0].id);
        }
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (userRole !== "admin") { alert("Sirf Admin delete kar sakta hai!"); return; }
    if (!confirm(`"${name}" ko delete karna hai?`)) return;
    await supabase.from("product_list").update({ delete_flag: 1 }).eq("id", id);
    fetchData();
  };

  const toggleStatus = async (p: Product) => {
    if (userRole !== "admin") { alert("Sirf Admin status change kar sakta hai!"); return; }
    await supabase.from("product_list").update({ status: p.status === 1 ? 0 : 1 }).eq("id", p.id);
    fetchData();
  };

  const totalValue = filtered.reduce((s, p) => s + (p.price || 0), 0);

  return (
    <AdminPage title="Products" subtitle="Product catalog management">
      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#21293d] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search products..."
                className="pl-9 pr-4 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 placeholder:text-slate-700 outline-none focus:border-blue-500 w-full sm:w-64"
              />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              {filtered.length} of {rows.length} products
            </span>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all">
            <Plus size={14} /> Add Product
          </button>
        </div>

        {err && <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">{err}</div>}

        {loading ? (
          <div className="px-5 py-12 text-center">
            <Loader2 size={24} className="animate-spin text-slate-600 mx-auto mb-2" />
            <p className="text-slate-600 text-xs font-extrabold uppercase tracking-widest">Loading...</p>
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
                {paginated.map(p => {
                  const margin = p.price > 0 && p.cost_price > 0 ? ((p.price - p.cost_price) / p.price * 100) : null;
                  return (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          {p.image_path ? (
                              <Image src={p.image_path} alt={p.name}
                                width={48} height={48} unoptimized
                                className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-[#21293d] cursor-zoom-in"
                                onDoubleClick={(e) => { e.stopPropagation(); openImageLightbox(p.image_path, p.name); }}
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                          ) : (
                            <Package size={14} className="text-amber-500 flex-shrink-0" />
                          )}
                          <span className="font-bold text-slate-200">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 text-xs max-w-[180px] truncate" title={p.description || ""}>
                        {p.description || "—"}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {p.hsn ? <span className="inline-block px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded text-[10px] font-bold">{p.hsn}</span> : <span className="text-slate-700 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {p.barcode ? <span className="inline-block px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded text-[10px] font-mono font-bold">{p.barcode}</span> : <span className="text-slate-700 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-400">
                        {inr(p.cost_price)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-black text-emerald-400">{inr(p.price)}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {margin !== null ? (
                          <span className={`font-bold text-xs ${margin >= 20 ? "text-emerald-400" : margin >= 10 ? "text-amber-400" : "text-red-400"}`}>
                            {margin.toFixed(1)}%
                          </span>
                        ) : <span className="text-slate-700 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button onClick={() => toggleStatus(p)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                            p.status === 1
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                              : "bg-slate-500/10 border-slate-500/20 text-slate-500 hover:bg-slate-500/20"
                          }`}>
                          {p.status === 1 ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                          {p.status === 1 ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEdit(p)}
                            className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition">
                            <Edit3 size={13} />
                          </button>
                          {userRole === "admin" && (
                            <button onClick={() => handleDelete(p.id, p.name)}
                              className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">
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
                  <td colSpan={4} className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-600">Total Value:</td>
                  <td className="px-4 py-3 text-right font-black text-emerald-400">{inr(totalValue)}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
          )}

          {isMobile && (
            <div className="divide-y divide-[#1a2234]">
              {paginated.map(p => {
                const margin = p.price > 0 && p.cost_price > 0 ? ((p.price - p.cost_price) / p.price * 100) : null;
                return (
                  <div key={p.id} className="px-4 py-4 space-y-3">
                    {/* Header: image + name + status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {p.image_path ? (
                          <Image src={p.image_path} alt={p.name}
                            width={40} height={40} unoptimized
                            className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-[#21293d] cursor-zoom-in"
                            onDoubleClick={(e) => { e.stopPropagation(); openImageLightbox(p.image_path, p.name); }}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-[#21293d] flex items-center justify-center flex-shrink-0">
                            <Package size={16} className="text-amber-500" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-slate-200 text-sm truncate">{p.name}</div>
                          <div className="text-xs text-slate-600 truncate">{p.description || "—"}</div>
                        </div>
                      </div>
                      <button onClick={() => toggleStatus(p)}
                        className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                          p.status === 1
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                            : "bg-slate-500/10 border-slate-500/20 text-slate-500 hover:bg-slate-500/20"
                        }`}>
                        {p.status === 1 ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                        {p.status === 1 ? "Active" : "Inactive"}
                      </button>
                    </div>

                    {/* Badges: HSN + barcode */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {p.hsn && (
                        <span className="inline-block px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded text-[10px] font-bold">{p.hsn}</span>
                      )}
                      {p.barcode ? (
                        <span className="inline-block px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded text-[10px] font-mono font-bold">{p.barcode}</span>
                      ) : (
                        <span className="text-slate-700 text-[10px]">No barcode</span>
                      )}
                    </div>

                    {/* Prices row */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-[#0d1117] border border-[#1a2234] rounded-xl px-2 py-2 text-center">
                        <div className="text-[8px] font-black uppercase tracking-widest text-slate-600">Cost</div>
                        <div className="text-slate-400 text-xs font-bold mt-0.5">{inr(p.cost_price)}</div>
                      </div>
                      <div className="bg-[#0d1117] border border-[#1a2234] rounded-xl px-2 py-2 text-center">
                        <div className="text-[8px] font-black uppercase tracking-widest text-slate-600">Selling</div>
                        <div className="text-emerald-400 text-xs font-black mt-0.5">{inr(p.price)}</div>
                      </div>
                      <div className="bg-[#0d1117] border border-[#1a2234] rounded-xl px-2 py-2 text-center">
                        <div className="text-[8px] font-black uppercase tracking-widest text-slate-600">Margin</div>
                        <div className={`text-xs font-black mt-0.5 ${margin !== null ? (margin >= 20 ? "text-emerald-400" : margin >= 10 ? "text-amber-400" : "text-red-400") : "text-slate-600"}`}>
                          {margin !== null ? `${margin.toFixed(1)}%` : "—"}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(p)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition text-xs font-bold">
                        <Edit3 size={13} /> Edit
                      </button>
                      {userRole === "admin" && (
                        <button onClick={() => handleDelete(p.id, p.name)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition text-xs font-bold">
                          <Trash2 size={13} /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="px-4 py-3 bg-[#111520] flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">Total Value:</span>
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
              <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
                className="bg-[#0d1117] border border-[#21293d] text-slate-300 rounded-lg px-2 py-1 text-[11px] font-bold outline-none focus:border-blue-500/60">
                {[10, 25, 50, 100, 0].map(n => (
                  <option key={n} value={n}>{n === 0 ? "All" : n}</option>
                ))}
              </select>
              <span>rows</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}
                className="px-3 py-1.5 bg-[#0d1117] border border-[#21293d] hover:border-blue-500/40 text-slate-400 hover:text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                Prev
              </button>
              <span className="px-3 py-1.5 text-[11px] font-black text-slate-400 bg-[#0d1117] border border-[#21293d] rounded-lg">
                {safePage} / {pageCount}
              </span>
              <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={safePage >= pageCount}
                className="px-3 py-1.5 bg-[#0d1117] border border-[#21293d] hover:border-blue-500/40 text-slate-400 hover:text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-[#21293d] flex-shrink-0">
              <h3 className="font-bold text-white flex items-center gap-2">
                {editing ? <><Edit3 size={16} className="text-blue-400" /> Edit Product</> : <><Plus size={16} className="text-blue-400" /> Add Product</>}
              </h3>
              <button onClick={() => { setBarcodeScanning(false); setDupWarn(null); setShowModal(false); }} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 transition">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto min-h-0">
              {formErr && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                  <AlertCircle size={14} /> {formErr}
                </div>
              )}

              {/* Product Image */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Product Image</label>
                <div className="bg-[#0d1117] rounded-xl border border-[#21293d] p-4">
                  <div className="flex items-center gap-4 flex-wrap">
                      {imgPreview ? (
                        <Image src={imgPreview} alt="Product" width={112} height={112} unoptimized className="w-28 h-28 rounded-xl object-cover border border-[#21293d]" />
                      ) : (
                        <div className="w-28 h-28 rounded-xl bg-white/5 border border-dashed border-[#2a3450] flex items-center justify-center">
                          <Package size={28} className="text-slate-600" />
                        </div>
                      )}
                    <div className="flex-1 min-w-[160px]">
                      <input ref={imgRef} type="file" accept="image/png,image/jpeg,image/webp"
                        onChange={handleImgChange} className="hidden"/>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button type="button" onClick={() => imgRef.current?.click()} disabled={imgSaving}
                          className="text-xs bg-blue-600/20 text-blue-400 border border-blue-600/30 px-3 py-1.5 rounded-lg hover:bg-blue-600/30 transition-all disabled:opacity-50">
                          <span className="inline-flex items-center gap-1.5"><Camera size={12}/> Choose Image</span>
                        </button>
                        {(imgPreview || imgPath) && (
                          <button type="button" onClick={removeImg} disabled={imgSaving}
                            className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/10 transition-all disabled:opacity-50">
                            <span className="inline-flex items-center gap-1.5"><Trash2 size={12}/> {imgFile ? "Cancel" : "Remove"}</span>
                          </button>
                        )}
                      </div>
                      {imgFile && (
                        <p className="text-[10px] text-slate-600 mt-1.5 flex items-center gap-1">
                          {imgSaving ? <><Loader2 size={10} className="animate-spin"/>Uploading...</> : "Save karne par image upload hogi"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Product Name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. SMPS Board, LED Strip"
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Cost Price (₹)</label>
                  <input type="number" step="0.01" value={form.cost_price} onChange={e => setForm(p => ({ ...p, cost_price: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Selling Price (₹) <span className="text-red-400">*</span></label>
                  <input type="number" step="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">HSN Code</label>
                  <input value={form.hsn} onChange={e => setForm(p => ({ ...p, hsn: e.target.value }))}
                    placeholder="e.g. 8504"
                    maxLength={20}
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                    Barcode <span className="normal-case font-semibold text-slate-600">(sticker scan karke link karein)</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input value={form.barcode}
                      onChange={e => { setForm(p => ({ ...p, barcode: e.target.value })); if (dupWarn) setDupWarn(null); }}
                      onBlur={() => checkBarcodeDuplicate(form.barcode, editing?.id ?? null)}
                      placeholder="Optional barcode"
                      maxLength={100}
                      className="flex-1 min-w-0 px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500" />
                    <button type="button"
                      onClick={() => setBarcodeScanning(true)}
                      className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border bg-blue-600/15 border-blue-600/30 text-blue-400 hover:bg-blue-600/25">
                      <ScanLine size={13} /> Scan
                    </button>
                  </div>

                  {dupWarn && (
                    <div className="mt-2 flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
                      <AlertCircle size={14} className="text-amber-400 flex-shrink-0" />
                      <p className="text-amber-400 text-xs font-bold flex-1">
                        Ye barcode already <span className="underline">{dupWarn.name}</span> se linked hai.
                      </p>
                      <Link href={`/inventory/${dupWarn.id}`} target="_blank"
                        className="flex-shrink-0 text-[10px] font-extrabold text-amber-400 hover:text-amber-300 border border-amber-500/30 px-2 py-1 rounded-lg transition-colors">
                        <span className="inline-flex items-center gap-1"><ExternalLink size={10} /> View</span>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Alert Quantity</label>
                  <input type="number" min="0" value={form.alert_quantity} onChange={e => setForm(p => ({ ...p, alert_quantity: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Linked Suppliers <span className="normal-case font-semibold text-slate-600">(order karne ke liye)</span></label>
                {suppliers.length === 0 ? (
                  <p className="text-xs text-slate-600 italic">Koi active supplier nahi — pehle <Link href="/suppliers" className="text-blue-400 underline">Suppliers</Link> me add karein.</p>
                ) : (
                  <div ref={supplierRef} className="relative">
                    <button type="button" onClick={() => setSupplierOpen(o => !o)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-left transition-all focus:border-blue-500">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        {selectedSuppliers.length === 0 ? (
                          <span className="text-slate-600">Suppliers select karein...</span>
                        ) : (
                          <>
                            {selectedSuppliers.slice(0, 3).map(id => {
                              const s = suppliers.find(x => x.id === id);
                              return s ? (
                                <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                                  {s.name}
                                  <span role="button" tabIndex={0}
                                    onClick={(e) => { e.stopPropagation(); setSelectedSuppliers(prev => prev.filter(x => x !== id)); }}
                                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setSelectedSuppliers(prev => prev.filter(x => x !== id)); } }}
                                    className="hover:text-emerald-200 cursor-pointer"
                                    title="Remove">
                                    <X size={10} />
                                  </span>
                                </span>
                              ) : null;
                            })}
                            {selectedSuppliers.length > 3 && (
                              <span className="text-[10px] font-bold text-slate-500">+{selectedSuppliers.length - 3} aur</span>
                            )}
                          </>
                        )}
                      </span>
                      <ChevronDown size={14} className={`text-slate-500 flex-shrink-0 transition-transform ${supplierOpen ? "rotate-180" : ""}`} />
                    </button>

                    {supplierOpen && (
                      <div className="absolute z-30 mt-2 w-full bg-[#111520] border border-[#21293d] rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
                        <div className="p-2 border-b border-[#21293d]">
                          <div className="relative">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                            <input value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)}
                              placeholder="Supplier dhoondein..."
                              autoFocus
                              className="w-full pl-8 pr-3 py-1.5 bg-[#0d1117] border border-[#21293d] rounded-lg text-xs text-white placeholder:text-slate-700 outline-none focus:border-blue-500" />
                          </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto p-1.5">
                          {(() => {
                            const list = suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase()));
                            if (list.length === 0) {
                              return <p className="px-3 py-4 text-center text-xs text-slate-600">Koi supplier nahi mila</p>;
                            }
                            return list.map(s => {
                              const checked = selectedSuppliers.includes(s.id);
                              return (
                                <button key={s.id} type="button"
                                  onClick={() => setSelectedSuppliers(prev => checked ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${checked ? "bg-emerald-500/10 text-emerald-400" : "text-slate-300 hover:bg-white/5"}`}>
                                  <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${checked ? "bg-emerald-500 border-emerald-500 text-white" : "border-[#2a3550]"}`}>
                                    {checked && <Check size={11} />}
                                  </span>
                                  {s.name}
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {selectedSuppliers.length > 0 && (
                  <p className="text-[10px] text-slate-700 mt-1.5">{selectedSuppliers.length} supplier linked</p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                  {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Check size={14} /> {editing ? "Update" : "Save"}</>}
                </button>
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 bg-[#111520] border border-[#21293d] text-slate-400 rounded-xl font-bold text-sm hover:bg-[#1a2234] transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Scan Modal (edit/add modal ke upar) */}
      {barcodeScanning && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setBarcodeScanning(false)}>
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#21293d]">
              <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                <ScanLine size={16} className="text-blue-400" /> Barcode Scan
              </h3>
              <button type="button" onClick={() => setBarcodeScanning(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 transition">
                <X size={16} />
              </button>
            </div>
            <div className="p-4">
              <BarcodeCameraScanner
                onScan={(text) => {
                  setBarcodeScanning(false);
                  setForm(p => ({ ...p, barcode: text }));
                  void checkBarcodeDuplicate(text, editing?.id ?? null);
                }} />
              <p className="text-[10px] text-slate-600 text-center mt-3">
                Barcode / QR sticker ko camera ke samne rakhein — auto detect hoke barcode fill hoga.
              </p>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
