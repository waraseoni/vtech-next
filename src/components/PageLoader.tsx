import type { LucideIcon } from "lucide-react";

/**
 * Reusable page-level loader — the branded icon + animate-ping ring animation
 * (same pattern as /direct-sales). Consistent mechanism across every route;
 * only the icon and accent color change per page's nature.
 *
 * - icon : lucide icon representing the page (e.g. Wrench, ShoppingBag, Package)
 * - label: loading text, e.g. "Loading Sales..."
 * - tone : accent color preset controlling the tinted box + icon + ping ring
 */

type Tone = "blue" | "emerald" | "amber" | "purple" | "rose" | "cyan";

const TONES: Record<
  Tone,
  { box: string; icon: string; ring: string }
> = {
  blue: {
    box: "bg-blue-500/10 border-blue-500/20",
    icon: "text-blue-500/60",
    ring: "border-blue-500/40",
  },
  emerald: {
    box: "bg-emerald-500/10 border-emerald-500/20",
    icon: "text-emerald-500/60",
    ring: "border-emerald-500/40",
  },
  amber: {
    box: "bg-amber-500/10 border-amber-500/20",
    icon: "text-amber-500/60",
    ring: "border-amber-500/40",
  },
  purple: {
    box: "bg-purple-500/10 border-purple-500/20",
    icon: "text-purple-500/60",
    ring: "border-purple-500/40",
  },
  rose: {
    box: "bg-rose-500/10 border-rose-500/20",
    icon: "text-rose-500/60",
    ring: "border-rose-500/40",
  },
  cyan: {
    box: "bg-cyan-500/10 border-cyan-500/20",
    icon: "text-cyan-500/60",
    ring: "border-cyan-500/40",
  },
};

type PageLoaderProps = {
  icon: LucideIcon;
  label: string;
  tone?: Tone;
};

export default function PageLoader({ icon: Icon, label, tone = "blue" }: PageLoaderProps) {
  const c = TONES[tone];
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className={`w-16 h-16 rounded-2xl ${c.box} flex items-center justify-center`}>
          <Icon size={28} className={c.icon} />
        </div>
        <div className={`absolute inset-0 rounded-2xl border ${c.ring} animate-ping`} />
      </div>
      <p className="text-slate-600 text-xs font-bold uppercase tracking-[0.3em]">{label}</p>
    </div>
  );
}
