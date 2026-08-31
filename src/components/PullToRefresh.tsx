"use client";
import { useRef, useState, useCallback, useEffect } from "react";
import { hardReload } from "@/lib/hardRefresh";

// ─────────────────────────────────────────────────────────────────────────────
// PULL-TO-REFRESH — mobile (Android WebView) ke liye standard refresh gesture.
// ─────────────────────────────────────────────────────────────────────────────
// App me mobile par koi refresh button nahi tha (topbar refresh sirf desktop).
// Logout/timeout ke baad login redirect kabhi-kabhi hang hota hai aur user ke
// paas koi escape nahi tha. Ye wrapper kisi bhi page ko wrap karta hai —
// neeche se upar swipe karne par hard reload (PWA cache wipe ke saath) hota hai.
//
// Note: native WebView ke apne pull-to-refresh ke saath conflict se bachne ke
// liye touchmove ko preventDefault karte hain jab sirf is gesture ko trigger
// kar rahe ho. Ye sirf us container par listener lagata hai jise wrap kiya hai,
// isliye page ke rest ke scroll/list par koi asar nahi.
// ─────────────────────────────────────────────────────────────────────────────

const TRIGGER_DISTANCE = 70; // px — kitne neeche kheenchne par refresh hoga
const MAX_DISTANCE = 120; // px — indicator kitna travel karega

export default function PullToRefresh({
  children,
  className,
  enabled = true,
}: {
  children: React.ReactNode;
  className?: string;
  enabled?: boolean;
}) {
  const [pull, setPull] = useState(0); // current drag distance (0..MAX)
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const dragging = useRef(false);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || refreshing) return;
      // Sirf tab chalu karo jab page sabse upar ho (scrollTop === 0),
      // taaki internal list/scroll ko gesture na pakde.
      if (window.scrollY > 0) return;
      const t = e.touches[0];
      startY.current = t.clientY;
      dragging.current = true;
    },
    [enabled, refreshing]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!dragging.current || startY.current == null || !enabled || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      // Kheenchne par push back — resistance feel.
      const resisted = Math.min(MAX_DISTANCE, dy * 0.4);
      setPull(resisted);
      // Jab hum khud gesture handle kar rahe ho to native scroll nahi chalna chahiye.
      if (dy > 8) {
        try {
          e.preventDefault();
        } catch {
          /* passive listener — ignore */
        }
      }
    },
    [enabled, refreshing]
  );

  const finishGesture = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    startY.current = null;
    if (pull >= TRIGGER_DISTANCE) {
      setRefreshing(true);
      setPull(TRIGGER_DISTANCE);
      // Thoda delay — indicator dikhe, phir hard reload.
      setTimeout(() => {
        hardReload();
      }, 400);
    } else {
      setPull(0);
    }
  }, [pull]);

  const onTouchEnd = useCallback(() => finishGesture(), [finishGesture]);
  const onTouchCancel = useCallback(() => {
    dragging.current = false;
    startY.current = null;
    setPull(0);
  }, []);

  // Unmount / disable par reset
  useEffect(() => {
    if (!enabled) {
      setPull(0);
      setRefreshing(false);
    }
  }, [enabled]);

  const show = pull > 0 || refreshing;

  return (
    <div
      className={className}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      style={{ touchAction: show ? "none" : "auto" }}
    >
      {/* Indicator — pull ke saath translateY karta hai */}
      <div
        className={`pointer-events-none flex items-center justify-center gap-2 text-slate-400 transition-transform duration-200 ${
          refreshing ? "" : "will-change-transform"
        }`}
        style={{
          height: `${refreshing ? TRIGGER_DISTANCE : pull}px`,
          overflow: "hidden",
        }}
      >
        {refreshing ? (
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          pull > 12 && (
            <span
              className={`text-[10px] font-black uppercase tracking-widest ${
                pull >= TRIGGER_DISTANCE ? "text-blue-400" : "text-slate-600"
              }`}
            >
              {pull >= TRIGGER_DISTANCE ? "Refresh karne ke liye chhodo" : "Neeche kheecho"}
            </span>
          )
        )}
      </div>
      {children}
    </div>
  );
}
