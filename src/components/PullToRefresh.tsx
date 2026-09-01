"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { hardReload } from "@/lib/hardRefresh";

// ─────────────────────────────────────────────────────────────────────────────
// PULL-TO-REFRESH — Android WebView (Capacitor) ke liye robust refresh gesture.
//
// Previous version React ke `onTouchMove` synthetic handler par depend karta tha,
// jo Android WebView me PASSIVE listener hai — isliye `e.preventDefault()` chup
// chup ke fail ho jata tha aur WebView apna native scroll/overscroll gesture
// pakad leta tha (indi indicator adhura rehta / refresh trigger nahi hota).
//
// Is robust version me:
//   1. touchstart/touchmove/touchend ko Raw DOM `addEventListener` se attach
//      karte hain jisme `touchmove` NON-PASSIVE hai → `e.preventDefault()` rely
//      se kaam karta hai aur WebView ki native scrolling us waqt block hoti hai.
//   2. Sirf tab engage karte hain jab page sabse upar ho (scrollY === 0) aur user
//      neechay ki taraf (down) swipe kar raha ho — internal list/scroll dab nahi.
//   3. `overscroll-behavior-y: contain` pull ke dauran laga kar WebView ke apne
//      bounce (rubber-band) ko daba dete hain, taaki sirf hamara indicator dikhe.
//   4. Pull distance ek REF me track hoti hai (closure-safe), state sirf render
//      ke liye. Trigger hone par hard reload (PWA cache wipe ke saath).
//
// Ye component kisi bhi page ko wrap kar leta hai aur browser me bhi kaam karta
// hai (sirf native par hi aggressive overscroll-behavior contain lagta hai).
// ─────────────────────────────────────────────────────────────────────────────

const TRIGGER_DISTANCE = 70; // px — kitna kheenchne par refresh
const MAX_DISTANCE = 130; // px — indicator kitna travel karega

export default function PullToRefresh({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const active = useRef(false); // gesture chal raha hai
  const dist = useRef(0); // current drag distance (0..MAX)
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const sync = useCallback((d: number) => {
    dist.current = d;
    setPull(d);
  }, []);

  // ── Touch handlers (non-passive via addEventListener) ──────────────────────
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onStart = (e: TouchEvent) => {
      // Sirf left-click style single touch.
      if (e.touches.length !== 1) return;
      // Page ke top par ho to hi gesture (upar scroll nahi hona chahiye).
      if (window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
      active.current = true;
      setPull(0);
      dist.current = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (!active.current || startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        sync(0);
        return;
      }
      // Resist padding — smooth feel, MAX tak capped.
      sync(Math.min(MAX_DISTANCE, dy * 0.42));
      // Jab hum gesture handle kar rahe hon to native scroll block karo.
      if (dy > 8 && e.cancelable) e.preventDefault();
    };

    const onEnd = () => {
      if (!active.current) return;
      const d = dist.current;
      active.current = false;
      startY.current = null;
      if (d >= TRIGGER_DISTANCE) {
        setRefreshing(true);
        setPull(TRIGGER_DISTANCE);
        setTimeout(() => hardReload(), 380);
      } else {
        setPull(0);
        dist.current = 0;
      }
    };

    // touchmove NON-PASSIVE — pre-ventDefault ke liye zaroori.
    root.addEventListener("touchstart", onStart, { passive: true });
    root.addEventListener("touchmove", onMove, { passive: false });
    root.addEventListener("touchend", onEnd, { passive: true });
    root.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      root.removeEventListener("touchstart", onStart);
      root.removeEventListener("touchmove", onMove);
      root.removeEventListener("touchend", onEnd);
      root.removeEventListener("touchcancel", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const show = pull > 0 || refreshing;

  return (
    <div
      ref={rootRef}
      className={className}
      style={{
        touchAction: show ? "none" : "auto",
        // Pull ke dauran WebView gum overscroll bounce ko daba do (native par).
        overscrollBehavior: show ? "contain" : undefined,
      }}
    >
      <div
        className={`pointer-events-none flex items-center justify-center gap-2 text-slate-400 will-change-transform ${
          refreshing ? "" : "transition-none"
        }`}
        style={{ height: `${refreshing ? TRIGGER_DISTANCE : pull}px`, overflow: "hidden" }}
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
