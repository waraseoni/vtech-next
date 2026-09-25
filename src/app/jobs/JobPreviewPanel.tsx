"use client";

// ─── Sprint 4 #19: jobs master-detail preview panel (xl screens) ───────────
// `?preview=<id>` se khulta hai — list ke bagal me slide-over, navigation
// nahi. Same quick actions (status/WA) + full-view link. xl se neeche hidden.
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { X, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { JOB_STATUS } from "@/lib/status-colors";
import type { Transaction } from "./useJobList";

const NEXT_STEP: Record<number, { to: number; label: string }> = {
  0: { to: 1, label: "Progress" },
  1: { to: 2, label: "Done" },
  2: { to: 5, label: "Deliver" },
};

export function JobPreviewPanel({
  jobId,
  onClose,
  onStatusChange,
  onSendWA,
}: {
  jobId: number;
  onClose: () => void;
  onStatusChange: (id: number, s: number) => Promise<void>;
  onSendWA: (t: Transaction) => void;
}) {
  const [txn, setTxn] = useState<Transaction | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setMissing(false);
    const { data } = await supabase
      .from("transaction_list")
      .select("*")
      .eq("id", jobId)
      .eq("del_status", 0)
      .maybeSingle();
    if (!data) {
      setTxn(null);
      setMissing(true);
      return;
    }
    const cid = Number(data.client_name);
    let enriched = { ...data };
    if (cid) {
      const { data: client } = await supabase
        .from("client_list")
        .select("id, firstname, middlename, lastname, contact")
        .eq("id", cid)
        .maybeSingle();
      if (client) {
        enriched = {
          ...enriched,
          client_firstname: client.firstname || "",
          client_middlename: client.middlename || "",
          client_lastname: client.lastname || "",
          client_contact: client.contact || "",
        };
      }
    }
    setTxn(enriched as Transaction);
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  // Escape se band
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const advance = async () => {
    if (!txn) return;
    const next = NEXT_STEP[txn.status];
    if (!next) return;
    setBusy(true);
    try {
      await onStatusChange(txn.id, next.to);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const st = txn ? (JOB_STATUS[txn.status] ?? JOB_STATUS[0]) : null;
  const next = txn ? NEXT_STEP[txn.status] : null;

  return (
    <aside className="hidden xl:flex flex-col fixed top-0 right-0 h-full w-[380px] z-[60] bg-panel border-l border-app shadow-2xl shadow-black/50">
      <div className="flex items-center justify-between px-5 py-4 border-b border-app">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-2">
          Quick Preview
        </p>
        <button
          onClick={onClose}
          aria-label="Close preview"
          className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/10 transition"
        >
          <X size={16} />
        </button>
      </div>

      {!txn && !missing && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={22} className="animate-spin text-muted-2" />
        </div>
      )}
      {missing && (
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <p className="text-muted text-sm font-bold">
            Job nahi mili (delete ho gayi hogi).
          </p>
        </div>
      )}
      {txn && st && (
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <Link
              href={`/jobs/${txn.id}/view`}
              className="text-blue-400 hover:text-blue-300 font-black text-lg no-underline"
            >
              #{txn.job_id}
            </Link>
            <div className="mt-1.5">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.cls}`}
              >
                {st.label}
              </span>
            </div>
          </div>

          <div className="bg-panel-2 border border-app rounded-2xl p-4 space-y-2.5">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-2">Client</p>
              <p className="text-sm font-bold text-app-2">
                {[txn.client_firstname, txn.client_middlename, txn.client_lastname]
                  .filter(Boolean)
                  .join(" ") || "Unknown Client"}
              </p>
              {txn.client_contact && (
                <p className="text-xs text-muted">{txn.client_contact}</p>
              )}
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-2">Item</p>
              <p className="text-sm font-bold text-app-2">{txn.item}</p>
            </div>
            {txn.fault && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-2">Fault</p>
                <p className="text-xs text-muted">{txn.fault}</p>
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-2">
                Amount
              </span>
              <span className="text-lg font-black text-white">
                ₹{(txn.amount || 0).toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            {next && (
              <button
                onClick={advance}
                disabled={busy}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                {busy ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <ArrowRight size={13} />
                )}
                {next.label}
              </button>
            )}
            <button
              onClick={() => onSendWA(txn)}
              className="flex-1 py-2.5 bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/25 rounded-xl font-bold text-xs transition-all active:scale-95"
            >
              WhatsApp
            </button>
          </div>

          <Link
            href={`/jobs/${txn.id}/view`}
            className="block text-center py-2.5 bg-panel-2 border border-app text-muted hover:text-white rounded-xl font-bold text-xs transition-all no-underline"
          >
            Full View →
          </Link>
        </div>
      )}
    </aside>
  );
}
