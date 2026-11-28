"use client";

import { useEffect, useState } from "react";

/**
 * Reusable live IST clock pill. Shows the current India (Asia/Kolkata) time,
 * with an optional "live" pulse dot.
 *
 * Pass `className` to control size/visibility (e.g. `hidden sm:flex` in the
 * global topbar to hide on small screens).
 *
 * PERF (mobile Chrome flicker): jab ye pill `position: fixed` hota hai to har
 * second text badalne se compositor us layer ko dobara raster karta hai —
 * Android Chrome par isse pill ke neeche ka content flicker / stale paint
 * karta tha. Isliye:
 *   - `showSeconds={false}` → minute precision (30s par hi tick).
 *   - `pulse={false}` → koi continuous opacity animation nahi (opacity
 *     animation pill ko composited layer bana deti hai).
 */

const timeFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

const timeFmtShort = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
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
  showSeconds = true,
  pulse = true,
  className = "",
}: {
  showDate?: boolean;
  showSeconds?: boolean;
  pulse?: boolean;
  className?: string;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const interval = setInterval(update, showSeconds ? 1000 : 30_000);
    return () => clearInterval(interval);
  }, [showSeconds]);

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 ${className}`}
    >
      {pulse && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
      )}
      <span className="whitespace-nowrap">
        {showDate && <span className="hidden sm:inline">{dateFmt.format(now)} · </span>}
        {(showSeconds ? timeFmt : timeFmtShort).format(now)} IST
      </span>
    </div>
  );
}
