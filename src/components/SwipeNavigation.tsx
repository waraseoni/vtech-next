"use client";
import { useEffect, useRef } from "react";
import { isNativePlatform } from "@/lib/nativePrint";

// ─────────────────────────────────────────────────────────────────────────────
// SWIPE NAVIGATION — Android WebView me back/forward ke liye edge-swipe gesture.
//
// iOS me system level par left-edge swipe = back hota hai; Android WebView me
// aisa koi default nahi hota. Ye component screen ke left/right EDGE par
// horizontal swipe detect karta hai:
//   • Left edge se right ki taraf swipe  → Back  (in-app back, back button jaisa)
//   • Right edge se left ki taraf swipe  → Forward (history mei aage)
//
// Safety:
//   • Sirf screen ke xaam (left/right) EDGE band par start hone wale gestures
//     pakde jate hain — beech wali area normal scroll/click par untouched.
//   • Sirf HORIZONTAL-dominant swipe trigger karta hai (horiz > vert*1.5), isliye
//     pull-to-refresh (vertical) ya page scroll ke saath kabhi takrar nahi.
//   • Desktop/browser par koi touch nahi → component silent rehta hai. Native par
//     bhi sirf edge swipe hi kaam karta hai, koi content ka click nahi dabta.
//   • Pointer events ko kabhi preventDefault nahi karte — sirf dekh kar decide.
// ─────────────────────────────────────────────────────────────────────────────

const EDGE_BAND = 32; // px — screen ke dono edges ka active band
const TRIGGER = 70; // px — kitna horizontal swipe karne par nav hoga
const VERT_RATIO = 1.5; // horizontal vs vertical dominance ratio

export default function SwipeNavigation({
  onBack,
  onForward,
}: {
  onBack: () => void;
  onForward: () => void;
}) {
  const cb = useRef({ onBack, onForward });
  useEffect(() => {
    cb.current = { onBack, onForward };
  }, [onBack, onForward]);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const edge = useRef<"left" | "right" | null>(null);
  const down = useRef(false);

  useEffect(() => {
    if (!isNativePlatform()) return;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const w = window.innerWidth - (window.visualViewport?.offsetLeft ?? 0);
      startX.current = t.clientX;
      startY.current = t.clientY;
      down.current = true;
      if (t.clientX <= EDGE_BAND) edge.current = "left";
      else if (t.clientX >= w - EDGE_BAND) edge.current = "right";
      else edge.current = null;
    };

    const onEnd = (e: TouchEvent) => {
      if (!down.current || startX.current == null || startY.current == null) return;
      down.current = false;
      const changed = e.changedTouches[0];
      const dx = changed.clientX - startX.current;
      const dy = changed.clientY - startY.current;
      startX.current = null;
      startY.current = null;
      const horiz = Math.abs(dx);
      const vert = Math.abs(dy);
      if (horiz < TRIGGER || horiz <= vert * VERT_RATIO) {
        edge.current = null;
        return;
      }
      if (edge.current === "left" && dx > 0) {
        edge.current = null;
        cb.current.onBack();
      } else if (edge.current === "right" && dx < 0) {
        edge.current = null;
        cb.current.onForward();
      } else {
        edge.current = null;
      }
    };

    const onCancel = () => {
      down.current = false;
      startX.current = null;
      startY.current = null;
      edge.current = null;
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onCancel);
    };
  }, []);

  return null;
}
