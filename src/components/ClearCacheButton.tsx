"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { hardReload } from "@/lib/hardRefresh";
import { toast } from "@/lib/toast";

// ─────────────────────────────────────────────────────────────────────────────
// CLEAR CACHE BUTTON — mobile/PWA me browser menu se site-data clear karna
// mushkil hota hai. Ye button directly app ke cache ko saaf karke fresh reload
// karta hai (detail: src/lib/hardRefresh.ts).
//
// Do-step confirmation isliye ki ek galti se click par poora page reload + cache
// wipe na ho. Native `confirm()` WebView me kabhi-kabhi block hota hai, isliye
// inline Confirm/Cancel UI use karte hain.
//
// Auth cookies, theme, remember-email, drafts — sab preserved (hardRefresh dekho).
// ─────────────────────────────────────────────────────────────────────────────

export default function ClearCacheButton({
  compact = false,
  onBeforeClear,
}: {
  /** Sidebar sub-menu ke liye chhota style. */
  compact?: boolean;
  /** Confirm ke turant pehle chalao (drawer/dropdown band karne ke liye). */
  onBeforeClear?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const wrap = compact ? "w-full flex items-center gap-1.5" : "w-full flex items-center gap-2";
  const btn = compact
    ? "flex-1 flex items-center justify-center gap-2 px-2 py-2 rounded-lg text-xs font-bold transition-all"
    : "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-app text-xs font-bold transition-all";
  const idle = "text-muted-2 hover:text-amber-400 hover:bg-white/[0.04]";
  const yes = "text-amber-400 hover:bg-amber-500/10";
  const no = "text-muted-2 hover:text-app-2 hover:bg-white/[0.04]";

  async function run() {
    if (busy) return;
    setBusy(true);
    onBeforeClear?.();
    try {
      toast.info("Cache saaf kiya ja raha hai…", { duration: 2000 });
      await hardReload();
    } catch {
      toast.error("Cache clear nahi hua. Dobara try karein.");
      setConfirming(false);
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <div className={wrap} role="group" aria-label="Clear cache confirmation">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className={`${btn} ${yes} disabled:opacity-60`}
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          {busy ? "Clearing…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className={`${btn} ${no} disabled:opacity-60`}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className={`${wrap} ${btn} ${idle}`}
      title="Purana/stale data aur PWA cache saaf karein"
    >
      <Trash2 size={compact ? 12 : 14} className="text-amber-400" />
      Clear Cache
    </button>
  );
}
