"use client";
import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Collapsed sidebar ke liye hover tooltip.
 *
 * Kyun ye component (pure CSS nahi):
 *   • `<nav>` par `overflow-y-auto` hai → koi bhi `position:absolute` tooltip
 *     us container ke bahar ja kar clip ho jata.
 *   • `<aside>` par `glass` (`backdrop-filter`) hai → `position:fixed` ka
 *     containing block aside ban jata hai, par nav uska DESCENDANT hai isliye
 *     nav ka overflow fixed element ko clip NAHI karta. Yahi fayda uthate hain.
 *
 * Kyun event delegation:
 *   SidebarNav me ~40 nav items bespoke JSX hain (koi menu array nahi).
 *   Ek `mouseover`/`focusin` handler nav par lagao aur hovered element ke
 *   existing `<span>` se label padh lo — items ko chhune ki zaroorat nahi.
 *
 * Label kahan se:
 *   • `<a>` (top-level link)  → pehla `<span>` = label (badge spans alag hain)
 *   • `<button>` (SubMenu)   → aakhri `<span>` = title (pehla span icon hota hai)
 */

type Tip = { text: string; x: number; y: number };

const EDGE = 10; // sidebar ke right edge se gap

function labelFrom(el: Element | null): string {
  if (!el) return "";
  const a = el.closest("a");
  if (a) {
    const s = a.querySelector("span");
    return (s?.textContent || "").trim();
  }
  const b = el.closest("button");
  if (b) {
    const spans = b.querySelectorAll("span");
    return (spans[spans.length - 1]?.textContent || "").trim();
  }
  return "";
}

export function useSidebarTooltip(collapsed: boolean | undefined) {
  const [tip, setTip] = useState<Tip | null>(null);
  const raf = useRef<number | null>(null);

  const place = useCallback((e: React.MouseEvent | React.FocusEvent) => {
    const text = labelFrom(e.target as Element);
    if (!text) {
      setTip(null);
      return;
    }
    const host = (e.target as Element).closest("a, button");
    if (!host) return;
    const r = host.getBoundingClientRect();
    // rAF: hover ke dauran layout shift ho to bhi sahi jagah rahe
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      setTip({ text, x: r.right + EDGE, y: r.top + r.height / 2 });
    });
  }, []);

  const hide = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    setTip(null);
  }, []);

  const navProps = collapsed
    ? {
        onMouseOver: place,
        onMouseOut: hide,
        onFocus: place,
        onBlur: hide,
      }
    : {};

  const tooltip = tip
    ? createPortal(
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[100] whitespace-nowrap rounded-lg border border-app bg-panel px-2.5 py-1.5 text-[11px] font-bold text-app shadow-lg shadow-black/20"
          style={{ left: tip.x, top: tip.y, transform: "translateY(-50%)" }}
        >
          {tip.text}
        </div>,
        document.body
      )
    : null;

  return { navProps, tooltip };
}
