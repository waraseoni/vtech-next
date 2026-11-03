"use client";

import { useEffect, useRef, useState } from "react";

/**
 * DeferredMount — children ko tab tak mount nahi karta jab tak wrapper viewport
 * ke paas (rootMargin) na aaye. Heavy lazy chunks (Recharts etc.) ka network +
 * parse cost first paint se hat jata hai; 2.5s fallback + reserved height se
 * CLS/feature-loss nahi hota.
 */
export default function DeferredMount({
  children,
  minHeightClassName,
  fallbackMs = 2500,
  rootMargin = "200px",
  className,
}: {
  children: React.ReactNode;
  /** Reserved space while deferred (CLS guard), e.g. "min-h-[320px]". */
  minHeightClassName?: string;
  fallbackMs?: number;
  rootMargin?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted) return;
    const el = ref.current;
    if (!el) return;

    const mount = () => setMounted(true);
    let io: IntersectionObserver | null = null;

    if (typeof IntersectionObserver === "undefined") {
      mount();
    } else {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) mount();
        },
        { rootMargin }
      );
      io.observe(el);
    }

    // Fallback: agar observer kabhi fire na ho (print, odd layout), phir bhi mount.
    const timer = window.setTimeout(mount, fallbackMs);

    return () => {
      io?.disconnect();
      window.clearTimeout(timer);
    };
  }, [mounted, fallbackMs, rootMargin]);

  return (
    <div ref={ref} className={`${className ?? ""} ${mounted ? "" : (minHeightClassName ?? "")}`}>
      {mounted ? children : null}
    </div>
  );
}
