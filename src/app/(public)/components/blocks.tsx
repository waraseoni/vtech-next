import Link from "next/link";
import Image from "next/image";
import { ChevronRight, MessageCircle, Phone, BadgeCheck, Clock, CheckCircle2 } from "lucide-react";
import { SITE, WHATSAPP_LINK } from "../site";
import { EquipmentArt, type ArtKind } from "./equipment-art";

export function PageHero({
  badge, title, highlight, subtitle,
}: {
  badge: string;
  title: string;
  highlight: string;
  subtitle: string;
}) {
  return (
    <section className="relative overflow-hidden border-b border-white/[0.06]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.16),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.10),transparent_50%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:py-16">
        <nav className="flex items-center gap-1.5 text-[12px] font-bold text-slate-500 mb-4">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <ChevronRight size={13} />
          <span className="text-slate-300">{badge}</span>
        </nav>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] font-bold uppercase tracking-widest mb-4">
          <BadgeCheck size={13} /> {badge}
        </span>
        <h1 className="font-display text-3xl sm:text-5xl font-black tracking-tight leading-[1.1] max-w-3xl">
          {title} <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">{highlight}</span>
        </h1>
        <p className="mt-4 text-[14px] sm:text-base text-slate-400 leading-relaxed max-w-2xl">{subtitle}</p>
      </div>
    </section>
  );
}

export function EquipmentGrid({ items }: {
  items: { art: ArtKind; name: string; detail: string; badge?: "available" | "coming"; image?: string }[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {items.map((it, i) => (
        <div key={i} className="group rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.06] hover:border-blue-500/40 transition-all active:scale-[0.98]">
          <div className="relative h-32 sm:h-36 overflow-hidden bg-[#080a18]">
            {it.image ? (
              <Image src={it.image} alt={it.name} fill sizes="(max-width: 640px) 100vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105" />
            ) : (
              <EquipmentArt kind={it.art} className="h-full w-full transition-transform duration-500 group-hover:scale-105" />
            )}
            {it.badge && (
              <span className={`absolute top-3 right-3 z-10 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border backdrop-blur-sm ${
                it.badge === "available"
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  : "bg-amber-500/15 border-amber-500/30 text-amber-400"
              }`}>
                {it.badge === "available" ? "Available Now" : "Coming Soon"}
              </span>
            )}
          </div>
          <div className="p-4 sm:p-5">
            <h3 className="text-[15px] font-bold mb-1">{it.name}</h3>
            <p className="text-[13px] text-slate-400 leading-relaxed">{it.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProcessSteps({ steps }: { steps: { title: string; desc: string }[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {steps.map((s, i) => (
        <div key={i} className="relative rounded-2xl p-6 bg-white/[0.03] border border-white/[0.06]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-black">
              {i + 1}
            </div>
            <div className="h-px flex-1 bg-white/[0.08]" />
            <Clock size={15} className="text-slate-600" />
          </div>
          <h4 className="text-[15px] font-bold mb-1">{s.title}</h4>
          <p className="text-[13px] text-slate-400 leading-relaxed">{s.desc}</p>
        </div>
      ))}
    </div>
  );
}

export function RepairHighlights({ points }: { points: { title: string; desc: string }[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {points.map((p, i) => (
        <div key={i} className="flex gap-3 rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06]">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[14px] font-bold">{p.title}</p>
            <p className="text-[12px] text-slate-500 mt-0.5">{p.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CtaBand() {
  return (
    <section className="py-12 sm:py-16">
      <div className="mx-auto max-w-4xl px-4">
        <div className="relative overflow-hidden rounded-3xl p-7 sm:p-10 text-center bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-700">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_30%,white_1px,transparent_1px)] [background-size:22px_22px]" />
          <div className="relative">
            <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight">
              Apna equipment bhejo — diagnosis free
            </h2>
            <p className="mt-2 text-[14px] text-blue-100/90 max-w-md mx-auto">
              Photo ya direct call karo. Bina repair ke koi charge nahi.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
              <a href={SITE.phoneHref}
                className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-blue-700 text-[14px] font-black shadow-xl active:scale-95 transition-transform">
                <Phone size={16} /> {SITE.phone}
              </a>
              <a href={WHATSAPP_LINK("Hello, repair ke liye inquiry hai.")} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#25D366] text-[#04170c] text-[14px] font-black shadow-xl active:scale-95 transition-transform">
                <MessageCircle size={16} /> WhatsApp par bhejo
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
