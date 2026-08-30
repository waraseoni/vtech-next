"use client";

import { useEffect, useState } from "react";

/**
 * Reusable live IST clock pill. Shows the current India (Asia/Kolkata) time,
 * ticking every second, with an animated "live" pulse dot.
 *
 * Pass `className` to control size/visibility (e.g. `hidden sm:flex` in the
 * global topbar to hide on small screens).
 */

const timeFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  day: "2-digit",
  month: "short",
});

export default function LiveClock({
  showDate = true,
  className = "",
}: {
  showDate?: boolean;
  className?: string;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
      <span className="whitespace-nowrap">
        {showDate && <span className="hidden sm:inline">{dateFmt.format(now)} · </span>}
        {timeFmt.format(now)} IST
      </span>
    </div>
  );
}
