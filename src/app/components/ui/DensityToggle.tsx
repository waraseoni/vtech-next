"use client";

import { Rows3 } from "lucide-react";
import type { Density } from "@/hooks/useDensity";

// Density toggle — Compact / Comfortable. ThemeToggle ke bagal me (desktop topbar).
export function DensityToggle({
  density,
  onSelect,
  size = 16,
  buttonClassName = "w-9 h-9 flex-shrink-0 flex items-center justify-center glass border hover:border-blue-500/40 rounded-xl text-muted hover:text-white transition-all",
}: {
  density: Density;
  onSelect: (d: Density) => void;
  size?: number;
  buttonClassName?: string;
}) {
  const compact = density === "compact";
  return (
    <button
      onClick={() => onSelect(compact ? "comfortable" : "compact")}
      title={compact ? "Density: Compact (click → Comfortable)" : "Density: Comfortable (click → Compact)"}
      aria-label="Toggle density"
      aria-pressed={compact}
      className={`${buttonClassName} ${compact ? "border-blue-500/50 text-blue-400" : ""}`}
    >
      <Rows3 size={size} />
    </button>
  );
}
