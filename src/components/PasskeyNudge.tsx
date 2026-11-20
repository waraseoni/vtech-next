"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Fingerprint, X } from "lucide-react";

const NUDGE_KEY = "vtech_passkey_nudge";

export default function PasskeyNudge() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(NUDGE_KEY) !== "1") return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/passkey/devices");
        if (!res.ok) return;
        const data = (await res.json()) as { devices?: unknown[] };
        if (cancelled) return;
        if ((data.devices?.length ?? 0) > 0) {
          window.localStorage.removeItem(NUDGE_KEY);
          return;
        }
        setVisible(true);
      } catch {
        /* API fail → banner mat dikhao, UI block nahi */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.removeItem(NUDGE_KEY);
    } catch {
      /* storage blocked */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="bg-blue-500/10 border border-blue-500/25 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-xs font-bold text-blue-300">
        <Fingerprint size={16} className="flex-shrink-0" />
        1-tap login chahiye? Passkey add karein.
      </p>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href="/profile"
          className="text-blue-300 hover:text-blue-200 text-xs font-black uppercase tracking-wider no-underline"
        >
          Add karein
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Passkey nudge band karein"
          className="p-1 rounded-lg text-muted hover:text-app dark:hover:text-white hover:bg-panel-2 transition"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
