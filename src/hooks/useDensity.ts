// ─── Sprint 4 #19: density preference ───────────────────────────────────────
// Compact/Comfortable — `data-density` attr on <html>, persisted.
// Theme system jaisa pattern (useAppTheme): default comfortable.
import { useState, useEffect, useCallback } from "react";

export type Density = "comfortable" | "compact";

const KEY = "vtech_density";

function read(): Density {
  try {
    return localStorage.getItem(KEY) === "compact" ? "compact" : "comfortable";
  } catch {
    return "comfortable";
  }
}

export function useDensity() {
  const [density, setDensityState] = useState<Density>("comfortable");

  useEffect(() => {
    setDensityState(read());
  }, []);

  const setDensity = useCallback((d: Density) => {
    setDensityState(d);
    try {
      localStorage.setItem(KEY, d);
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute("data-density", d);
  }, []);

  // Mount par persisted value apply (SSR flash nahi — default comfortable)
  useEffect(() => {
    document.documentElement.setAttribute("data-density", read());
  }, []);

  // Sprint 4 #20: multi-tab sync — doosre tab me density badle to yahan apply
  useEffect(() => {
    const h = (e: StorageEvent) => {
      if (e.key === KEY) {
        const d = e.newValue === "compact" ? "compact" : "comfortable";
        setDensityState(d);
        document.documentElement.setAttribute("data-density", d);
      }
    };
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }, []);

  return { density, setDensity };
}
