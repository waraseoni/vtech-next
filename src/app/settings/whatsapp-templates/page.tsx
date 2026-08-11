"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import AdminPage from "@/app/components/AdminPage";
import {
  Save, RotateCcw, History, ChevronDown, ChevronUp,
  Loader2, Check, AlertCircle, Eye, MessageSquare, X,
} from "lucide-react";
import { DEFAULT_TEMPLATES, TEMPLATE_LABELS, PLACEHOLDERS } from "@/lib/whatsappTemplates";

type HistoryRow = {
  id: number;
  template_key: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
};

type HistoryInsert = {
  template_key: string;
  action: "update" | "reset";
  old_value: string;
  new_value: string;
  changed_by: string;
};

export default function WhatsAppTemplatesPage() {
  const [templates, setTemplates] = useState<Record<string, string>>(DEFAULT_TEMPLATES);
  const [systemInfo, setSystemInfo] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"edit" | "history">("edit");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [historyDetail, setHistoryDetail] = useState<HistoryRow | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchData = useCallback(async () => {
    const [infoRes, histRes] = await Promise.all([
      supabase.from("system_info").select("meta_field, meta_value"),
      supabase.from("wp_template_history").select("*").order("id", { ascending: false }).limit(50),
    ]);

    const infoMap: Record<string, string> = {};
    (infoRes.data || []).forEach((r) => { infoMap[r.meta_field] = r.meta_value; });
    setSystemInfo(infoMap);
    setHistory((histRes.data || []) as HistoryRow[]);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleCard = (key: string) => {
    setOpenCards(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const copyPlaceholder = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setToast({ type: "success", msg: `Copied: ${tag}` });
  };

  const updateTemplate = (key: string, value: string) => {
    setTemplates(prev => ({ ...prev, [key]: value }));
  };

  const getCurrentValue = (key: string) =>
    systemInfo[key] || systemInfo[`wp_default_${key}`] || DEFAULT_TEMPLATES[key] || "";

  const saveTemplates = async (applyCurrent: boolean = false) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("firstname, lastname").eq("id", user!.id).single();
      const userName = [profile?.firstname, profile?.lastname].filter(Boolean).join(" ") || "Admin";

      const histInserts: HistoryInsert[] = [];

      for (const [key, newValue] of Object.entries(templates)) {
        const oldValue = getCurrentValue(key);

        // Save default
        await supabase.from("system_info")
          .upsert({ meta_field: `wp_default_${key}`, meta_value: newValue }, { onConflict: "meta_field" });

        // If applyCurrent, also update the active value (canonical field = key, no wp_ prefix)
        if (applyCurrent) {
          await supabase.from("system_info")
            .upsert({ meta_field: key, meta_value: newValue }, { onConflict: "meta_field" });

          if (oldValue !== newValue) {
            histInserts.push({
              template_key: key,
              action: "update",
              old_value: oldValue,
              new_value: newValue,
              changed_by: userName,
            });
          }
        }
      }

      if (histInserts.length > 0) {
        await supabase.from("wp_template_history").insert(histInserts);
      }

      setToast({ type: "success", msg: applyCurrent ? "Templates saved + applied!" : "Defaults saved!" });
      fetchData();
    } catch (err) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  const restoreFactory = async () => {
    if (!confirm("Restore ORIGINAL factory defaults? This will overwrite all your custom defaults.")) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("firstname, lastname").eq("id", user!.id).single();
      const userName = [profile?.firstname, profile?.lastname].filter(Boolean).join(" ") || "Admin";

      const histInserts: HistoryInsert[] = [];

      for (const [key, defaultValue] of Object.entries(DEFAULT_TEMPLATES)) {
        const oldDefault = templates[key];

        await supabase.from("system_info")
          .upsert({ meta_field: `wp_default_${key}`, meta_value: defaultValue }, { onConflict: "meta_field" });
        await supabase.from("system_info")
          .upsert({ meta_field: key, meta_value: defaultValue }, { onConflict: "meta_field" });

        if (oldDefault !== defaultValue) {
          histInserts.push({
            template_key: key,
            action: "reset",
            old_value: oldDefault,
            new_value: defaultValue,
            changed_by: userName,
          });
        }
      }

      if (histInserts.length > 0) {
        await supabase.from("wp_template_history").insert(histInserts);
      }

      setTemplates({ ...DEFAULT_TEMPLATES });
      setToast({ type: "success", msg: "Factory defaults restored!" });
      fetchData();
    } catch (err) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPage title="WhatsApp Templates" subtitle="Configure default WhatsApp message templates">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-bold ${
          toast.type === "success" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
          : "bg-red-500/15 border-red-500/30 text-red-400"
        }`}>
          {toast.type === "success" ? <Check size={16}/> : <AlertCircle size={16}/>}
          {toast.msg}
        </div>
      )}

      {/* History Detail Modal */}
      {historyDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setHistoryDetail(null)}>
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[#21293d]">
              <h3 className="font-bold text-white flex items-center gap-2"><History size={16} className="text-blue-400" /> Change Detail</h3>
              <button onClick={() => setHistoryDetail(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500"><X size={16}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div><span className="text-slate-500 font-bold">Template:</span> <span className="text-white font-bold">{TEMPLATE_LABELS[historyDetail.template_key]}</span></div>
                <div><span className="text-slate-500 font-bold">Action:</span> <span className="text-white font-bold uppercase">{historyDetail.action}</span></div>
                <div><span className="text-slate-500 font-bold">Date:</span> <span className="text-white">{new Date(historyDetail.changed_at).toLocaleString("en-IN")}</span></div>
                <div><span className="text-slate-500 font-bold">By:</span> <span className="text-white">{historyDetail.changed_by || "System"}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-red-400 mb-1.5 block">OLD Value</label>
                  <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl text-xs text-slate-400 whitespace-pre-wrap max-h-[200px] overflow-y-auto font-mono">
                    {historyDetail.old_value || "(empty)"}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-emerald-400 mb-1.5 block">NEW Value</label>
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-xs text-slate-400 whitespace-pre-wrap max-h-[200px] overflow-y-auto font-mono">
                    {historyDetail.new_value || "(empty)"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-[#21293d]">
          <button onClick={() => setActiveTab("edit")}
            className={`px-5 py-3.5 text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === "edit" ? "text-white border-b-2 border-blue-500 bg-white/[0.03]" : "text-slate-500 hover:text-slate-300"
            }`}>
            <MessageSquare size={14} /> Edit Defaults
          </button>
          <button onClick={() => setActiveTab("history")}
            className={`px-5 py-3.5 text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === "history" ? "text-white border-b-2 border-blue-500 bg-white/[0.03]" : "text-slate-500 hover:text-slate-300"
            }`}>
            <History size={14} /> Change History
            {history.length > 0 && (
              <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-[10px]">{history.length}</span>
            )}
          </button>
        </div>

        {activeTab === "edit" ? (
          <div className="p-5 space-y-4">
            {/* Info banner */}
            <div className="flex items-start gap-3 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
              <AlertCircle size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-slate-400">
                <span className="text-white font-bold">Yeh default templates hain.</span> Edit karke &quot;Save as Default&quot; dabayein।
                &quot;Save + Apply&quot; se current active templates bhi update ho jayengi।
              </p>
            </div>

            {/* Placeholders */}
            <div className="p-4 bg-[#0d1117] border border-[#21293d] rounded-xl">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2">Available Placeholders (click to copy):</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(PLACEHOLDERS).map(([tag, desc]) => (
                  <button key={tag} onClick={() => copyPlaceholder(tag)}
                    title={desc}
                    className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-md text-[10px] font-bold hover:bg-amber-500/20 transition cursor-pointer">
                    {tag} <span className="text-amber-600 ml-0.5">({desc})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Template Cards */}
            <div className="space-y-3">
              {Object.entries(DEFAULT_TEMPLATES).map(([key, defaultValue]) => {
                const isOpen = openCards[key];
                const current = getCurrentValue(key);
                const edited = templates[key];
                const isModified = edited !== defaultValue;

                return (
                  <div key={key} className="border border-[#21293d] rounded-xl overflow-hidden">
                    <div onClick={() => toggleCard(key)}
                      className="flex items-center justify-between px-4 py-3 bg-[#111520] cursor-pointer hover:bg-white/[0.02] transition">
                      <div className="flex items-center gap-2">
                        <MessageSquare size={12} className="text-green-400" />
                        <span className="text-sm font-bold text-slate-200">{TEMPLATE_LABELS[key]}</span>
                        <span className="text-[10px] text-slate-600">({key})</span>
                        {isModified && <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded text-[9px] font-bold">Modified</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-600">{edited.length} chars</span>
                        {isOpen ? <ChevronUp size={14} className="text-slate-600" /> : <ChevronDown size={14} className="text-slate-600" />}
                      </div>
                    </div>
                    {isOpen && (
                      <div className="p-4 border-t border-[#21293d] grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-wider text-red-400 mb-1.5 block">Default Template:</label>
                          <textarea value={templates[key]} onChange={e => updateTemplate(key, e.target.value)}
                            rows={8}
                            className="w-full p-3 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs text-white font-mono outline-none focus:border-blue-500 resize-none transition" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-wider text-emerald-400 mb-1.5 block">Current Active:</label>
                          <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-xs text-slate-400 whitespace-pre-wrap max-h-[200px] overflow-y-auto font-mono">
                            {current}
                          </div>
                          {current !== defaultValue ? (
                            <p className="text-[10px] text-amber-400 mt-1 font-bold">⚠ Modified from default</p>
                          ) : (
                            <p className="text-[10px] text-emerald-400 mt-1 font-bold">✓ Same as default</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button onClick={() => saveTemplates(false)} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save as Defaults
              </button>
              <button onClick={() => saveTemplates(true)} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Save Defaults + Apply to Current
              </button>
              <button onClick={restoreFactory} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded-xl font-bold text-xs transition-all">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                Restore Factory Defaults
              </button>
            </div>
          </div>
        ) : (
          /* History Tab */
          <div className="p-5">
            {history.length === 0 ? (
              <div className="text-center py-12">
                <History size={32} className="text-slate-700 mx-auto mb-3" />
                <p className="text-slate-600 text-sm">Abhi tak koi change record nahi hua।</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#111520]">
                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                      <th className="text-left px-4 py-3 w-10">#</th>
                      <th className="text-left px-4 py-3">Date & Time</th>
                      <th className="text-left px-4 py-3">Template</th>
                      <th className="text-center px-4 py-3">Action</th>
                      <th className="text-left px-4 py-3">Changed By</th>
                      <th className="text-center px-4 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a2234]">
                    {history.map((h, i) => (
                      <tr key={h.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-slate-600 font-bold">{i + 1}</td>
                        <td className="px-4 py-3 text-slate-400">{new Date(h.changed_at).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 font-bold text-white">{TEMPLATE_LABELS[h.template_key] || h.template_key}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            h.action === "update" ? "bg-blue-500/20 text-blue-400"
                            : h.action === "reset" ? "bg-red-500/20 text-red-400"
                            : "bg-slate-500/20 text-slate-400"
                          }`}>
                            {h.action.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{h.changed_by || "System"}</td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => setHistoryDetail(h)}
                            className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition">
                            <Eye size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminPage>
  );
}
