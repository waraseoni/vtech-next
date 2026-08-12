"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, X } from "lucide-react";

export default function LicenseBanner() {
  const [state, setState] = useState<{ valid: boolean; configured: boolean } | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/license/status", { cache: "no-store" });
        if (!res.ok) return; // not logged in → silent
        setState(await res.json());
      } catch { /* ignore */ }
    })();
  }, []);

  // License valid ho ya banner hidden → kuchh nahi dikhao.
  // (RootClient ka full-screen LicenseGate hi primary gate hai — ye sirf inline fallback.)
  if (!state || state.valid || hidden) return null;

  return (
    <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 text-[12px] font-bold text-amber-200 anim-fade">
      <KeyRound size={16} className="text-amber-400 shrink-0" />
      <p className="flex-1 min-w-0">
        Ye system <span className="text-amber-300">trial mode</span> mein chal raha hai — license activate nahi hua.
        {state.configured === false && <span className="text-amber-500/80"> (license service setup nahi hai)</span>}
      </p>
      <Link href="/settings"
        className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors">
        Activate
      </Link>
      <button onClick={() => setHidden(true)} aria-label="Hide"
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-amber-500/70 hover:text-amber-300 transition-colors">
        <X size={14} />
      </button>
    </div>
  );
}
