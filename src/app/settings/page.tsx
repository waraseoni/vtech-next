"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Settings2, Save, Loader2, CheckCircle, AlertCircle,
  Building2, Phone, Mail, MapPin, Tag, ShieldCheck,
  Clock, Pen, Trash2, Upload, Eye, EyeOff, User, Image as ImageIcon,
  History, KeyRound,
} from "lucide-react";

const inputCls  = "w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all placeholder:text-slate-700";
const labelCls  = "block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5";
const fieldsets = "bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden";
const fHdr      = "flex items-center gap-2.5 px-5 py-3.5 bg-gradient-to-r border-b border-[#21293d]";

type SysInfo = Record<string, string>;

export default function SettingsPage() {
  const router  = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState<{ type: "success"|"error"; msg: string } | null>(null);

  // Basic info
  const [name,       setName]       = useState("");
  const [shortName,  setShortName]  = useState("");
  const [owner,      setOwner]      = useState("");
  const [email,      setEmail]      = useState("");
  const [contact,    setContact]    = useState("");
  const [address,    setAddress]    = useState("");
  const [gstin,      setGstin]      = useState("");
  const [upiId,      setUpiId]      = useState("");
  const [bizHours,   setBizHours]   = useState({ open: "09:00", close: "19:00", days: "Mon-Sat" });
  const [logRetention, setLogRetention] = useState("90");

  // Attendance Geofencing
  const [gfEnabled, setGfEnabled] = useState(false);
  const [gfLat,     setGfLat]     = useState("");
  const [gfLng,     setGfLng]     = useState("");
  const [gfRadius,  setGfRadius]  = useState("200");
  const [gfLocating, setGfLocating] = useState(false);

  // Signature
  const [signature, setSignature] = useState("");
  const [sigFile, setSigFile] = useState<File | null>(null);
  const [sigFileName, setSigFileName] = useState("");
  const [sigSaving, setSigSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);

  // Logo
  const [logo, setLogo] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoFileName, setLogoFileName] = useState("");
  const [logoSaving, setLogoSaving] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  // Website Cover
  const [cover, setCover] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverFileName, setCoverFileName] = useState("");
  const [coverSaving, setCoverSaving] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);

  // AI
  const [aiProvider, setAiProvider] = useState("gemini");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiKeyConfigured, setAiKeyConfigured] = useState(false);
  const [aiModel, setAiModel] = useState("gemini-2.5-flash");
  const [showAiKey, setShowAiKey] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState("");

  const groqModels = ["llama-3.3-70b-versatile","llama-3.3-70b-specdec","llama3-70b-8192","mixtral-8x7b-32768","llama3-8b-8192"];
  const geminiModels = ["gemini-2.5-flash","gemini-2.5-flash-lite","gemini-2.5-pro"];

  // License
  const [license, setLicense] = useState<{
    activated: boolean; configured: boolean; plan?: string; shopName?: string;
    keyMasked?: string; activatedAt?: string; expiresAt?: string | null; error?: string;
  } | null>(null);
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseBusy, setLicenseBusy] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (p?.role !== "admin") { router.push("/"); return; }

      const { data, error } = await supabase
        .from("system_info")
        .select("meta_field, meta_value");

      if (error) {
        console.error("system_info fetch:", error.message);
        setToast({ type: "error", msg: "Settings load nahi hui: " + error.message });
        setLoading(false);
        return;
      }

      const info: SysInfo = {};
      (data || []).forEach(r => { info[r.meta_field] = r.meta_value; });

      setName(info.name      || "");
      setShortName(info.short_name || "");
      setOwner(info.owner    || "");
      setEmail(info.email    || "");
      setContact(info.contact || "");
      setAddress(info.address || "");
      setGstin(info.gst_no || info.gstin || "");
      setUpiId(info.upi_id   || "");
      setBizHours({
        open: info.biz_open || "09:00",
        close: info.biz_close || "19:00",
        days: info.biz_days || "Mon-Sat",
      });
      setLogRetention(info.log_retention || "90");

      // Attendance Geofencing
      setGfEnabled(info.geofence_enabled === "true");
      setGfLat(info.geofence_lat || "");
      setGfLng(info.geofence_lng || "");
      setGfRadius(info.geofence_radius_m || "200");

      // Signature
      setSignature(info.signature || "");

      // Logo
      setLogo(info.logo || "");

      // Website Cover
      const c = info.cover || "";
      setCover(c.startsWith("uploads/") ? "" : c);

      // AI Settings (key value kabhi client par render nahi karte)
      setAiProvider(info.ai_provider || "gemini");
      setAiKeyConfigured(!!info.ai_api_key);
      setAiApiKey("");
      setAiModel(info.ai_model || "gemini-2.5-flash");

      setLoading(false);

      // License status (silent — fail par ignore)
      try {
        const licRes = await fetch("/api/license/status", { cache: "no-store" });
        if (licRes.ok) setLicense(await licRes.json());
      } catch { /* ignore */ }
    })();
  }, [router]);

  const upsertField = async (field: string, value: string) => {
    const { data: existing } = await supabase
      .from("system_info")
      .select("id")
      .eq("meta_field", field)
      .maybeSingle();
    if (existing?.id) {
      const { error } = await supabase
        .from("system_info")
        .update({ meta_value: value })
        .eq("meta_field", field);
      if (error) throw new Error(`${field} update failed: ${error.message}`);
    } else {
      const { error } = await supabase
        .from("system_info")
        .insert({ meta_field: field, meta_value: value });
      if (error) throw new Error(`${field} insert failed: ${error.message}`);
    }
  };

  // ── Save basic settings ───────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setToast({ type: "error", msg: "System name zaroori hai!" }); return; }
    setSaving(true);
    try {
      await Promise.all([
        upsertField("name",       name.trim()),
        upsertField("short_name", shortName.trim()),
        upsertField("owner",      owner.trim()),
        upsertField("email",      email.trim()),
        upsertField("contact",    contact.trim()),
        upsertField("address",    address.trim()),
        upsertField("gst_no",     gstin.trim()),
        upsertField("gstin",      gstin.trim()),
        upsertField("upi_id",     upiId.trim()),
        upsertField("biz_open",   bizHours.open),
        upsertField("biz_close",  bizHours.close),
        upsertField("biz_days",   bizHours.days),
        upsertField("log_retention", logRetention.trim() || "90"),
        upsertField("geofence_enabled", gfEnabled ? "true" : "false"),
        upsertField("geofence_lat", gfLat.trim()),
        upsertField("geofence_lng", gfLng.trim()),
        upsertField("geofence_radius_m", gfRadius.trim() || "200"),
      ]);
      setToast({ type: "success", msg: "Settings save ho gayi! ✅" });
    } catch (err: unknown) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Save failed!" });
    } finally {
      setSaving(false);
    }
  };

  // ── Save AI settings ─────────────────────────────────
  const handleSaveAi = async () => {
    setSaving(true);
    try {
      await upsertField("ai_provider", aiProvider);
      // Naya key type kiya ho to hi update karte hain (existing key kabhi read-back nahi karte)
      if (aiApiKey.trim()) {
        await upsertField("ai_api_key", aiApiKey.trim());
        setAiApiKey("");
        setAiKeyConfigured(true);
      }
      await upsertField("ai_model", aiModel);
      setToast({ type: "success", msg: "AI settings saved ✅" });
    } catch (err: unknown) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  };

  // ── Attendance Geofencing: fill current coordinates ─────────────
  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setToast({ type: "error", msg: "Is browser me geolocation support nahi hai" });
      return;
    }
    setGfLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGfLat(p.coords.latitude.toFixed(6));
        setGfLng(p.coords.longitude.toFixed(6));
        setGfLocating(false);
        setToast({ type: "success", msg: "Current location set ✅" });
      },
      () => {
        setGfLocating(false);
        setToast({ type: "error", msg: "Location fetch nahi hui. Permission/Internet/GPS check karein." });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ── Signature upload ────────────────────────────────
  const handleSigFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setSigFile(f); setSigFileName(f.name); }
  };

  const uploadSignature = async () => {
    if (!sigFile) return;
    setSigSaving(true);
    const form = new FormData();
    form.append("file", sigFile);
    try {
      const res = await fetch("/api/settings/signature", { method: "POST", body: form });
      const json = await res.json();
      if (json.status === "success") {
        setSignature(json.url);
        setToast({ type: "success", msg: "Signature uploaded ✅" });
      } else throw new Error(json.msg);
    } catch (err: unknown) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setSigSaving(false);
    }
  };

  const removeSignature = async () => {
    setSigSaving(true);
    const form = new FormData();
    form.append("delete", "1");
    try {
      const res = await fetch("/api/settings/signature", { method: "POST", body: form });
      const json = await res.json();
      if (json.status === "success") {
        setSignature("");
        setToast({ type: "success", msg: "Signature removed" });
      } else throw new Error(json.msg);
    } catch (err: unknown) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSigSaving(false);
    }
  };

  // ── Canvas signature ──────────────────────────────
  const initCanvas = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setDrawing(true);
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    const pos = "touches" in e ? { x: e.touches[0].clientX - c.getBoundingClientRect().left, y: e.touches[0].clientY - c.getBoundingClientRect().top } : { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    ctx.moveTo(pos.x, pos.y);
  };
  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const pos = "touches" in e ? { x: e.touches[0].clientX - c.getBoundingClientRect().left, y: e.touches[0].clientY - c.getBoundingClientRect().top } : { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };
  const endDraw = () => setDrawing(false);
  const clearCanvas = () => { const c = canvasRef.current; if (c) { const ctx = c.getContext("2d"); if (ctx) ctx.clearRect(0, 0, c.width, c.height); } };

  const saveCanvasSig = async () => {
    const c = canvasRef.current;
    if (!c) return;
    const dataURL = c.toDataURL("image/png");
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, c.width, c.height);
    const blank = imageData.data.every(pixel => pixel === 0);
    if (blank) {
      setToast({ type: "error", msg: "Pehle signature draw karein!" });
      return;
    }
    setSigSaving(true);
    const form = new FormData();
    form.append("canvasData", dataURL);
    try {
      const res = await fetch("/api/settings/signature", { method: "POST", body: form });
      const json = await res.json();
      if (json.status === "success") {
        setSignature(json.url);
        setShowCanvas(false);
        setToast({ type: "success", msg: "Signature saved ✅" });
      } else throw new Error(json.msg);
    } catch (err: unknown) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSigSaving(false);
    }
  };

  // ── Logo upload ──────────────────────────────────────────
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setLogoFile(f); setLogoFileName(f.name); }
  };

  const saveLogo = async () => {
    if (!logoFile) return;
    setLogoSaving(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await upsertField("logo", reader.result as string);
          setLogo(reader.result as string);
          setLogoFile(null);
          setLogoFileName("");
          setToast({ type: "success", msg: "Logo save ho gaya ✅" });
        } catch (err: unknown) {
          setToast({ type: "error", msg: err instanceof Error ? err.message : "Save failed" });
        } finally {
          setLogoSaving(false);
        }
      };
      reader.onerror = () => {
        setToast({ type: "error", msg: "Logo file read nahi hui" });
        setLogoSaving(false);
      };
      reader.readAsDataURL(logoFile);
    } catch (err: unknown) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Save failed" });
      setLogoSaving(false);
    }
  };

  const removeLogo = async () => {
    setLogoSaving(true);
    try {
      await upsertField("logo", "");
      setLogo("");
      setLogoFile(null);
      setLogoFileName("");
      setToast({ type: "success", msg: "Logo remove ho gaya" });
    } catch (err: unknown) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Failed" });
    } finally {
      setLogoSaving(false);
    }
  };

  // ── Website Cover upload ─────────────────────────────────────
  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setCoverFile(f); setCoverFileName(f.name); }
  };

  const saveCover = async () => {
    if (!coverFile) return;
    setCoverSaving(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await upsertField("cover", reader.result as string);
          setCover(reader.result as string);
          setCoverFile(null);
          setCoverFileName("");
          setToast({ type: "success", msg: "Cover save ho gaya ✅" });
        } catch (err: unknown) {
          setToast({ type: "error", msg: err instanceof Error ? err.message : "Save failed" });
        } finally {
          setCoverSaving(false);
        }
      };
      reader.onerror = () => {
        setToast({ type: "error", msg: "Cover file read nahi hui" });
        setCoverSaving(false);
      };
      reader.readAsDataURL(coverFile);
    } catch (err: unknown) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Save failed" });
      setCoverSaving(false);
    }
  };

  const removeCover = async () => {
    setCoverSaving(true);
    try {
      await upsertField("cover", "");
      setCover("");
      setCoverFile(null);
      setCoverFileName("");
      setToast({ type: "success", msg: "Cover remove ho gaya" });
    } catch (err: unknown) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Failed" });
    } finally {
      setCoverSaving(false);
    }
  };

  // ── Test AI API ──────────────────────────────────────
  const testAiApi = async () => {
    setAiTesting(true);
    setAiTestResult("Testing...");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Sirf 'OK' likho aur kuch mat likho" }],
          type: "chat",
          provider: aiProvider,
          apiKey: aiApiKey,
          model: aiModel,
        }),
      });
      const json = await res.json();
      if (json.response?.includes("OK")) {
        setAiTestResult("✅ Working!");
        setToast({ type: "success", msg: `AI API working with ${aiModel}` });
      } else {
        setAiTestResult("❌ Failed");
        setToast({ type: "error", msg: json.error || "API test failed" });
      }
    } catch {
      setAiTestResult("❌ Connection error");
      setToast({ type: "error", msg: "AI API connection failed" });
    } finally {
      setAiTesting(false);
    }
  };

  const availableModels = aiProvider === "groq" ? groqModels : geminiModels;

  // ── License activation ────────────────────────────────────
  const handleActivateLicense = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    if (!licenseKey.trim()) { setToast({ type: "error", msg: "License key daalein!" }); return; }
    setLicenseBusy(true);
    try {
      const res = await fetch("/api/license/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: licenseKey.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Activation failed");
      setToast({ type: "success", msg: "License activate ho gaya ✅" });
      setLicenseKey("");
      setLicense({
        activated: true, configured: true, plan: json.plan, shopName: json.shopName,
        expiresAt: json.expiresAt, activatedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Activation failed" });
    } finally {
      setLicenseBusy(false);
    }
  };

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 bg-[#0d1117]">
      <Loader2 className="animate-spin text-blue-500" size={36}/>
      <p className="text-slate-600 text-xs font-black uppercase tracking-widest">Loading Settings...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0d1117] font-sans pb-12">
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-bold ${
          toast.type === "success"
            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
            : "bg-red-500/15 border-red-500/30 text-red-400"
        }`}>
          {toast.type === "success" ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
          {toast.msg}
        </div>
      )}

      <form onSubmit={handleSave}>
        <div className="max-w-2xl mx-auto px-4 pt-6 space-y-4">

          {/* Header */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-slate-500 to-slate-700 rounded-xl flex items-center justify-center">
                <Settings2 size={18} className="text-white"/>
              </div>
              <div>
                <h1 className="text-lg font-black text-white">System Information</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Admin Panel · Settings</p>
              </div>
            </div>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-black transition-all disabled:opacity-50 shadow-lg shadow-blue-900/30">
              {saving ? <><Loader2 size={14} className="animate-spin"/>Saving...</> : <><Save size={14}/> Update</>}
            </button>
          </div>

          {/* System Name */}
          <div className={fieldsets}>
            <div className={`${fHdr} from-blue-600/20 to-transparent`}>
              <Tag size={14} className="text-blue-400"/>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">System Identity</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className={labelCls}>System Name *</label>
                <div className="relative">
                  <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"/>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="V-Technologies Repair Shop" required className={`${inputCls} pl-9`}/>
                </div>
              </div>
              <div>
                <label className={labelCls}>Short Name</label>
                <input type="text" value={shortName} onChange={e => setShortName(e.target.value)}
                  placeholder="V-Tech" className={inputCls}/>
              </div>
              <div>
                <label className={labelCls}>Firm Owner Name</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"/>
                  <input type="text" value={owner} onChange={e => setOwner(e.target.value)}
                    placeholder="Vikram Jain" className={`${inputCls} pl-9`}/>
                </div>
                <p className="text-[10px] text-slate-700 mt-1">
                  WhatsApp messages ke {`{firm_owner}`} placeholder mein yeh naam use hoga.
                </p>
              </div>
              <div>
                <label className={labelCls}>System Logo</label>
                <div className="bg-[#0d1117] rounded-xl border border-[#21293d] p-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    {logo ? (
                      <Image src={logo} alt="Logo" width={200} height={64} unoptimized className="max-h-16 max-w-[200px] object-contain bg-white rounded-lg p-1" />
                    ) : (
                      <div className="w-24 h-16 rounded-lg bg-white/5 border border-dashed border-[#2a3450] flex items-center justify-center">
                        <ImageIcon size={20} className="text-slate-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-[180px]">
                      <p className="text-xs font-bold text-slate-400 mb-2">
                        Bills &amp; invoices ke header mein yeh logo dikhega.
                      </p>
                      <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleLogoFileChange} className="hidden"/>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button type="button" onClick={() => logoRef.current?.click()}
                          className="text-xs bg-blue-600/20 text-blue-400 border border-blue-600/30 px-3 py-1.5 rounded-lg hover:bg-blue-600/30 transition-all">
                          <span className="inline-flex items-center gap-1.5"><Upload size={12}/> Choose Logo</span>
                        </button>
                        {logoFile && (
                          <button type="button" onClick={saveLogo} disabled={logoSaving}
                            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                            {logoSaving ? "Saving..." : "Save Logo"}
                          </button>
                        )}
                        {logo && (
                          <button type="button" onClick={removeLogo} disabled={logoSaving}
                            className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/10 transition-all">
                            <span className="inline-flex items-center gap-1.5"><Trash2 size={12}/> Remove</span>
                          </button>
                        )}
                      </div>
                      {logoFileName && <p className="text-[10px] text-slate-600 mt-1.5">{logoFileName}</p>}
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <label className={labelCls}>Website Cover</label>
                <div className="bg-[#0d1117] rounded-xl border border-[#21293d] p-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    {cover ? (
                      <Image src={cover} alt="Cover" width={260} height={112} unoptimized className="max-h-28 max-w-[260px] object-cover rounded-lg border border-[#21293d]" />
                    ) : (
                      <div className="w-36 h-24 rounded-lg bg-white/5 border border-dashed border-[#2a3450] flex items-center justify-center">
                        <ImageIcon size={20} className="text-slate-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-[180px]">
                      <p className="text-xs font-bold text-slate-400 mb-2">
                        Public website ke home page par yeh cover dikhega.
                      </p>
                      <input ref={coverRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleCoverFileChange} className="hidden"/>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button type="button" onClick={() => coverRef.current?.click()}
                          className="text-xs bg-blue-600/20 text-blue-400 border border-blue-600/30 px-3 py-1.5 rounded-lg hover:bg-blue-600/30 transition-all">
                          <span className="inline-flex items-center gap-1.5"><Upload size={12}/> Choose Cover</span>
                        </button>
                        {coverFile && (
                          <button type="button" onClick={saveCover} disabled={coverSaving}
                            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                            {coverSaving ? "Saving..." : "Save Cover"}
                          </button>
                        )}
                        {cover && (
                          <button type="button" onClick={removeCover} disabled={coverSaving}
                            className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/10 transition-all">
                            <span className="inline-flex items-center gap-1.5"><Trash2 size={12}/> Remove</span>
                          </button>
                        )}
                      </div>
                      {coverFileName && <p className="text-[10px] text-slate-600 mt-1.5">{coverFileName}</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className={fieldsets}>
            <div className={`${fHdr} from-emerald-600/20 to-transparent`}>
              <Phone size={14} className="text-emerald-400"/>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Contact Information</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className={labelCls}>Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"/>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="vtech.jbp@gmail.com" className={`${inputCls} pl-9`}/>
                </div>
              </div>
              <div>
                <label className={labelCls}>Contact No.</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"/>
                  <input type="text" value={contact} onChange={e => setContact(e.target.value)}
                    placeholder="9179105875" className={`${inputCls} pl-9`}/>
                </div>
              </div>
              <div>
                <label className={labelCls}>Office Address</label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-3.5 text-slate-600 pointer-events-none"/>
                  <textarea value={address} onChange={e => setAddress(e.target.value)}
                    placeholder="F4, Hotel Plaza, Marhatal, Jabalpur - 482002"
                    rows={3} className={`${inputCls} pl-9 resize-none`}/>
                </div>
              </div>
            </div>
          </div>

          {/* GST Info */}
          <div className={fieldsets}>
            <div className={`${fHdr} from-amber-600/20 to-transparent`}>
              <ShieldCheck size={14} className="text-amber-400"/>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">GST Information</h3>
            </div>
            <div className="p-5">
              <div>
                <label className={labelCls}>GSTIN</label>
                <input type="text" value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())}
                  placeholder="22AAAAA0000A1Z5" maxLength={15}
                  className={`${inputCls} font-mono tracking-widest`}/>
                <p className="text-[10px] text-slate-700 mt-1">
                  GST Invoice par yeh number dikhega.
                </p>
              </div>
            </div>
          </div>

          {/* UPI Payment */}
          <div className={fieldsets}>
            <div className={`${fHdr} from-purple-600/20 to-transparent`}>
              <svg className="w-3.5 h-3.5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">UPI Payment</h3>
            </div>
            <div className="p-5">
              <div>
                <label className={labelCls}>UPI ID</label>
                <input type="text" value={upiId} onChange={e => setUpiId(e.target.value)}
                  placeholder="9179105875@ybl" className={`${inputCls} font-mono`}/>
                <p className="text-[10px] text-slate-700 mt-1">
                  Invoice/Receipt par scan-to-pay QR code mein yeh UPI ID dikhegi.
                </p>
              </div>
            </div>
          </div>

          {/* Business Hours */}
          <div className={fieldsets}>
            <div className={`${fHdr} from-teal-600/20 to-transparent`}>
              <Clock size={14} className="text-teal-400"/>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Business Hours</h3>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Working Days</label>
                <input type="text" value={bizHours.days} onChange={e => setBizHours(b => ({ ...b, days: e.target.value }))}
                  placeholder="Mon-Sat" className={inputCls}/>
              </div>
              <div>
                <label className={labelCls}>Open Time</label>
                <input type="time" value={bizHours.open} onChange={e => setBizHours(b => ({ ...b, open: e.target.value }))} className={inputCls}/>
              </div>
              <div>
                <label className={labelCls}>Close Time</label>
                <input type="time" value={bizHours.close} onChange={e => setBizHours(b => ({ ...b, close: e.target.value }))} className={inputCls}/>
              </div>
            </div>
          </div>

          {/* Activity Log Retention */}
          <div className={fieldsets}>
            <div className={`${fHdr} from-slate-600/20 to-transparent`}>
              <History size={14} className="text-slate-400"/>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Activity Log Retention</h3>
            </div>
            <div className="p-5">
              <label className={labelCls}>Retention (Days)</label>
              <input type="number" min="1" value={logRetention} onChange={e => setLogRetention(e.target.value)}
                className={inputCls}/>
              <p className="text-[10px] text-slate-700 mt-1">
                Clean old logs action sirf isse zyada din purane logs delete karega. Default: 90 days.
              </p>
            </div>
          </div>

          {/* Attendance Geofencing */}
          <div className={fieldsets}>
            <div className={`${fHdr} from-blue-600/20 to-transparent`}>
              <MapPin size={14} className="text-blue-400"/>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Attendance Geofencing</h3>
            </div>
            <div className="p-5 space-y-4">
              <label className="flex items-center gap-2.5 text-xs font-bold text-slate-400 cursor-pointer">
                <input type="checkbox" checked={gfEnabled} onChange={e => setGfEnabled(e.target.checked)}
                  className="accent-blue-500 w-4 h-4"/>
                Self check-in / check-out ke liye GPS location verify karein
              </label>
              <p className="text-[10px] text-slate-700">
                Enable hone par staff office radius ke bahar se attendance mark nahi kar payenge.
                Check-in/out ki coordinates record par audit ke liye save hoti hain.
                (Admin ka manual time-editing geofence se exempt rehta hai.)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Office Latitude</label>
                  <input type="text" value={gfLat} onChange={e => setGfLat(e.target.value)}
                    placeholder="23.1545" className={inputCls}/>
                </div>
                <div>
                  <label className={labelCls}>Office Longitude</label>
                  <input type="text" value={gfLng} onChange={e => setGfLng(e.target.value)}
                    placeholder="79.9426" className={inputCls}/>
                </div>
                <div>
                  <label className={labelCls}>Radius (meters)</label>
                  <input type="number" min="50" value={gfRadius} onChange={e => setGfRadius(e.target.value)}
                    className={inputCls}/>
                </div>
              </div>
              <button type="button" onClick={useMyLocation} disabled={gfLocating}
                className="text-xs bg-blue-600/20 text-blue-400 border border-blue-600/30 px-3 py-1.5 rounded-lg hover:bg-blue-600/30 transition-all inline-flex items-center gap-1.5 disabled:opacity-50">
                {gfLocating ? "Locating..." : "Use My Current Location"}
              </button>
            </div>
          </div>

          {/* Digital Signature */}
          <div className={fieldsets}>
            <div className={`${fHdr} from-violet-600/20 to-transparent`}>
              <Pen size={14} className="text-violet-400"/>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Digital Signature</h3>
            </div>
            <div className="p-5 space-y-4">
              {/* Current signature preview */}
              {signature && (
                <div className="flex items-center gap-4 p-4 bg-[#0d1117] rounded-xl border border-[#21293d]">
                  <Image src={signature} alt="Signature" width={200} height={64} unoptimized className="max-h-16 object-contain" />
                  <button type="button" onClick={removeSignature} disabled={sigSaving}
                    className="ml-auto text-red-400 hover:text-red-300 text-xs flex items-center gap-1">
                    <Trash2 size={14}/> Remove
                  </button>
                </div>
              )}

              {/* Upload */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#0d1117] rounded-xl border border-[#21293d] p-4 text-center">
                  <Upload size={24} className="mx-auto text-slate-500 mb-2"/>
                  <p className="text-xs font-bold text-slate-400 mb-2">Upload Image</p>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp"
                    onChange={handleSigFileChange} className="hidden"/>
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="text-xs text-blue-400 hover:underline">Choose File</button>
                  {sigFileName && <p className="text-[10px] text-slate-600 mt-1">{sigFileName}</p>}
                  {sigFile && (
                    <button type="button" onClick={uploadSignature} disabled={sigSaving}
                      className="mt-2 text-xs bg-blue-600 text-white px-3 py-1 rounded-lg">
                      {sigSaving ? "Uploading..." : "Upload"}
                    </button>
                  )}
                </div>
                <div className="bg-[#0d1117] rounded-xl border border-[#21293d] p-4 text-center">
                  <Pen size={24} className="mx-auto text-slate-500 mb-2"/>
                  <p className="text-xs font-bold text-slate-400 mb-2">Draw Signature</p>
                  <button type="button" onClick={() => { setShowCanvas(!showCanvas); setTimeout(initCanvas, 100); }}
                    className="text-xs text-violet-400 hover:underline">
                    {showCanvas ? "Close" : "Draw Now"}
                  </button>
                </div>
              </div>

              {/* Canvas */}
              {showCanvas && (
                <div className="bg-[#0d1117] rounded-xl border border-[#21293d] p-4">
                  <p className="text-[10px] text-slate-600 mb-2 text-center">Mouse ya finger se draw karein</p>
                  <div className="flex justify-center">
                    <canvas ref={canvasRef} width={450} height={150}
                      className="border-2 border-[#21293d] rounded-lg bg-white cursor-crosshair touch-none"
                      onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                      onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}/>
                  </div>
                  <div className="flex justify-center gap-3 mt-3">
                    <button type="button" onClick={clearCanvas}
                      className="text-xs bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg">Clear</button>
                    <button type="button" onClick={saveCanvasSig} disabled={sigSaving}
                      className="text-xs bg-violet-600 text-white px-3 py-1.5 rounded-lg">
                      {sigSaving ? "Saving..." : "Save Signature"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* AI Settings */}
          <div className={fieldsets}>
            <div className={`${fHdr} from-fuchsia-600/20 to-transparent`}>
              <svg className="w-3.5 h-3.5 text-fuchsia-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 0110 10c0 5-4 8-10 10C6 20 2 17 2 12A10 10 0 0112 2z"/><circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/><path d="M10 16c.5.5 1.5 1 3 1s2.5-.5 3-1"/></svg>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">AI Settings</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-xs text-slate-500">
                <p><strong>Groq</strong> (recommended — free, no billing) ya <strong>Google Gemini</strong> select karein.</p>
                <p className="mt-1">🔹 Groq API key: <a href="https://console.groq.com/keys" target="_blank" className="text-blue-400">console.groq.com/keys</a> (free)</p>
                <p>🔹 Gemini API key: <a href="https://aistudio.google.com/apikey" target="_blank" className="text-blue-400">aistudio.google.com/apikey</a></p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Provider</label>
                  <select value={aiProvider} onChange={e => { setAiProvider(e.target.value); setAiModel(e.target.value === "groq" ? "llama-3.3-70b-versatile" : "gemini-2.5-flash"); }}
                    className={inputCls}>
                    <option value="groq">Groq (Free)</option>
                    <option value="gemini">Gemini</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>API Key</label>
                  <div className="relative">
                    <input type={showAiKey ? "text" : "password"} value={aiApiKey} onChange={e => setAiApiKey(e.target.value)}
                      className={`${inputCls} pr-9`} placeholder={aiKeyConfigured ? "•••••••••• (key set hai — naya daalne ke liye type karein)" : "Enter API key"}/>
                    <button type="button" onClick={() => setShowAiKey(!showAiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showAiKey ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Model</label>
                  <select value={aiModel} onChange={e => setAiModel(e.target.value)} className={inputCls}>
                    {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button type="button" onClick={testAiApi} disabled={aiTesting}
                  className="text-xs bg-fuchsia-600/20 text-fuchsia-400 border border-fuchsia-600/30 px-3 py-1.5 rounded-lg hover:bg-fuchsia-600/30">
                  {aiTesting ? "Testing..." : "Test API"}
                </button>
                {aiTestResult && <span className="text-xs text-slate-500">{aiTestResult}</span>}
                <button type="button" onClick={handleSaveAi} disabled={saving}
                  className="ml-auto text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg">
                  Save AI Settings
                </button>
              </div>
            </div>
          </div>

          {/* License Activation */}
          <div className={fieldsets}>
            <div className={`${fHdr} from-emerald-600/20 to-transparent`}>
              <KeyRound size={14} className="text-emerald-400"/>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">License Activation</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className={`rounded-xl border p-4 flex items-start gap-3 ${
                license?.activated
                  ? "border-emerald-500/25 bg-emerald-500/5"
                  : "border-amber-500/25 bg-amber-500/5"
              }`}>
                {license?.activated ? (
                  <CheckCircle size={18} className="text-emerald-400 mt-0.5 shrink-0"/>
                ) : (
                  <AlertCircle size={18} className="text-amber-400 mt-0.5 shrink-0"/>
                )}
                <div>
                  <p className="text-xs font-black text-slate-300">
                    {license?.activated
                      ? "Active ✅"
                      : license === null
                        ? "Checking..."
                        : "Trial / Not activated"}
                  </p>
                  {license?.activated ? (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Plan: <span className="text-emerald-400 font-bold uppercase">{license.plan}</span>
                      {license.shopName && <> · {license.shopName}</>}
                      {license.keyMasked && <span className="font-mono"> · {license.keyMasked}</span>}
                      {license.expiresAt && <> · Expires: {new Date(license.expiresAt).toLocaleDateString()}</>}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500 mt-1">
                      License key daalein aur Activate dabaein. Key seller se milegi.
                    </p>
                  )}
                </div>
              </div>

              {!license?.activated && (
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>License Key</label>
                    <input
                      type="text"
                      value={licenseKey}
                      onChange={e => setLicenseKey(e.target.value.toUpperCase())}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleActivateLicense(); } }}
                      placeholder="VTC-XXXX-XXXX-XXXX-XXXX"
                      className={`${inputCls} font-mono tracking-widest uppercase`}
                    />
                  </div>
                  <button type="button" onClick={handleActivateLicense} disabled={licenseBusy || license?.configured === false}
                    className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5 transition-all">
                    {licenseBusy ? <><Loader2 size={12} className="animate-spin"/> Activating...</> : <><KeyRound size={12}/> Activate License</>}
                  </button>
                  {license && !license.configured && (
                    <p className="text-[10px] text-amber-400">
                      License service setup nahi hai — LICENSE_SERVICE_URL / LICENSE_SERVICE_ANON_KEY env add karein.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Preview card */}
          <div className="bg-[#0d1f35] border border-blue-500/20 rounded-2xl p-5">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-600 mb-3">Preview — Bills & Reports mein aise dikhega</p>
            <div className="space-y-1">
              {logo && <Image src={logo} alt="Logo" width={160} height={48} unoptimized className="max-h-12 max-w-[160px] object-contain bg-white rounded-lg p-0.5" />}
              <p className="text-white font-black text-base">{name || "System Name"}</p>
              {shortName && <p className="text-blue-400 text-xs font-bold">{shortName}</p>}
              <p className="text-slate-400 text-xs">{address || "Address"}</p>
              <p className="text-slate-400 text-xs">
                {contact && <span>📞 {contact}</span>}
                {contact && email && <span className="mx-2">|</span>}
                {email && <span>✉ {email}</span>}
              </p>
              {gstin && <p className="text-amber-400 text-xs font-mono">GSTIN: {gstin}</p>}
            </div>
          </div>

          {/* Bottom save */}
          <button type="submit" disabled={saving}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/30">
            {saving ? <><Loader2 size={16} className="animate-spin"/>Saving...</> : <><Save size={16}/> Update Settings</>}
          </button>

        </div>
      </form>
    </div>
  );
}
