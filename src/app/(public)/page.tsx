"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Phone, MessageCircle, Sparkles,
  ShieldCheck, Clock, IndianRupee, Wrench, ArrowRight, Star, BadgeCheck,
  Gauge, HandCoins,
} from "lucide-react";
import { SITE, WHATSAPP_LINK, SERVICES } from "./site";
import { EquipmentArt } from "./components/equipment-art";

/* ─── Particles (fixed positions — no random at render → no hydration mismatch) ── */
const PARTICLES = [
  { top: "12%", left: "8%", size: 3, delay: "0s", dur: "7s" },
  { top: "22%", left: "82%", size: 4, delay: "1.2s", dur: "8s" },
  { top: "40%", left: "16%", size: 2, delay: "0.6s", dur: "6s" },
  { top: "58%", left: "88%", size: 3, delay: "2s", dur: "9s" },
  { top: "68%", left: "24%", size: 4, delay: "0.3s", dur: "7.5s" },
  { top: "30%", left: "48%", size: 2, delay: "1.6s", dur: "6.5s" },
  { top: "76%", left: "62%", size: 3, delay: "0.9s", dur: "8.5s" },
  { top: "14%", left: "60%", size: 2, delay: "2.4s", dur: "7s" },
  { top: "50%", left: "6%", size: 3, delay: "1.8s", dur: "8s" },
  { top: "84%", left: "40%", size: 2, delay: "0.5s", dur: "6s" },
];

/* ─── Animated stat counter ─────────────────────────────────────────────────── */
function Stat({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) setStarted(true);
      });
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const raf = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(raf);
    }
    let raf = 0;
    const t0 = performance.now();
    const dur = 1400;
    const tick = (t: number) => {
      const p = Math.min((t - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, value]);

  return (
    <div ref={ref} className="text-center px-2 py-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
      <p className="font-display text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
        {shown.toLocaleString("en-IN")}{suffix}
      </p>
      <p className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-slate-500 mt-1.5">{label}</p>
    </div>
  );
}

export default function PublicHome() {
  return (
    <>
      {/* ═══ HERO ═════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[100dvh] flex items-center overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.14),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.10),transparent_50%)]" />
        <div className="absolute inset-0 opacity-[0.35] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.08)_1px,transparent_0)] [background-size:28px_28px]" />
        {PARTICLES.map((p, i) => (
          <div key={i} className="absolute rounded-full bg-blue-400/40 anim-float"
            style={{ top: p.top, left: p.left, width: p.size, height: p.size, animationDelay: p.delay, animationDuration: p.dur }} />
        ))}

        <div className="relative mx-auto max-w-7xl px-4 w-full py-16">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] font-bold uppercase tracking-widest mb-5">
              <Sparkles size={13} /> Jabalpur&apos;s Repair Experts · Since 2007
            </span>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.08] tracking-tight">
              Expert Repair for{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400">
                Stage Lighting
              </span>{" "}
              &amp;{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                Power Supply
              </span>
            </h1>

            <p className="mt-5 text-[15px] sm:text-lg text-slate-400 leading-relaxed max-w-xl">
              SMPS · Sharpy · Moving Head · Par · DMX · Laser · LED Wall · Fog Machine · PLC · HMI · VFD · EV Charger
              — <span className="text-slate-200 font-semibold">component-level repair</span>, genuine parts, same-day service.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a href={WHATSAPP_LINK("Hello, mujhe repair service chahiye.")} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-[#25D366] hover:bg-[#1fb959] text-[#04170c] text-[15px] font-black shadow-lg shadow-[#25D366]/25 transition-all active:scale-95">
                <MessageCircle size={18} /> WhatsApp karein
              </a>
              <a href={SITE.phoneHref}
                className="flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-white/[0.06] border border-white/12 hover:bg-white/[0.1] text-white text-[15px] font-bold transition-all active:scale-95">
                <Phone size={18} className="text-emerald-400" /> {SITE.phone}
              </a>
            </div>

            <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-bold text-slate-500">
              <span className="text-slate-300">17+ Years</span>·
              <span className="text-slate-300">27,000+ Repairs</span>·
              <span className="text-slate-300">5,000+ Clients</span>·
              <span className="flex items-center gap-1 text-emerald-400"><BadgeCheck size={13} /> Genuine Parts</span>
            </p>
          </div>
        </div>
      </section>

      {/* ═══ 3 PILLARS ════════════════════════════════════════════════════ */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
            <p className="text-[11px] font-black uppercase tracking-widest text-cyan-400 mb-2">What We Repair</p>
            <h2 className="font-display text-2xl sm:text-4xl font-black tracking-tight">
              Three Specialities. <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">One Trusted Shop.</span>
            </h2>
          </div>

          <div className="flex lg:grid lg:grid-cols-3 gap-4 overflow-x-auto snap-x snap-mandatory pb-2 lg:pb-0 lg:overflow-visible -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-hide">
            {SERVICES.map(s => (
              <Link key={s.href} href={s.href}
                className="snap-center shrink-0 w-[82%] sm:w-[55%] lg:w-auto group rounded-3xl overflow-hidden bg-gradient-to-b from-white/[0.05] to-white/[0.02] border border-white/[0.08] hover:border-blue-500/40 transition-all hover:-translate-y-1">
                <div className="relative h-28 sm:h-32 overflow-hidden border-b border-white/[0.06]">
                  <EquipmentArt kind={s.art} className="h-full w-full transition-transform duration-500 group-hover:scale-105" />
                </div>
                <div className="p-5 sm:p-6">
                  <h3 className="font-display text-lg font-bold mb-1.5">{s.label}</h3>
                  <p className="text-[13px] text-slate-400 leading-relaxed mb-4 line-clamp-2">{s.desc}</p>
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-blue-400 group-hover:gap-2.5 transition-all">
                    Explore <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ STATS ════════════════════════════════════════════════════════ */}
      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Stat value={27000} suffix="+" label="Repairs Completed" />
            <Stat value={17} suffix="+" label="Years of Trust" />
            <Stat value={5000} suffix="+" label="Happy Clients" />
            <Stat value={100} suffix="%" label="Load Tested Repairs" />
          </div>
        </div>
      </section>

      {/* ═══ FEATURED SERVICES ═══════════════════════════════════════════ */}
      <section className="py-14 sm:py-20 bg-[#0a0a18]/60 border-y border-white/[0.05]">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
            <p className="text-[11px] font-black uppercase tracking-widest text-cyan-400 mb-2">Featured Expertise</p>
            <h2 className="font-display text-2xl sm:text-4xl font-black tracking-tight">
              Popular Repair Services
            </h2>
            <p className="text-[13px] sm:text-sm text-slate-500 mt-3">
              Don&apos;t see yours? Call karo — agar bana banaya hai to hum fix kar denge.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              { art: "moving-head" as const, title: "Sharpy / Moving Head", desc: "16 / 20 ch · Gobo, motor, color" },
              { art: "par" as const, title: "Par & DMX Lights", desc: "RGBW · COB · DMX 512 control" },
              { art: "laser" as const, title: "Laser Lights", desc: "Galvo, driver, diode repair" },
              { art: "led-wall" as const, title: "LED Wall / Processor", desc: "Module, receiving card, PSU" },
              { art: "fog" as const, title: "Fog / Smoke Machine", desc: "Pump, heater, PCB" },
              { art: "smps" as const, title: "SMPS / Power Supply", desc: "All types, component-level" },
              { art: "ev-charger" as const, title: "EV Charger", desc: "2-wheeler charger repair" },
              { art: "pcb" as const, title: "PCB / Control Card", desc: "Industrial electronics repair" },
            ].map((f, i) => (
              <div key={i} className="group rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.06] hover:border-blue-500/40 hover:bg-white/[0.05] transition-all active:scale-[0.98]">
                <div className="relative h-20 sm:h-24 overflow-hidden bg-[#080a18]">
                  <EquipmentArt kind={f.art} className="h-full w-full transition-transform duration-500 group-hover:scale-110" />
                </div>
                <div className="p-3.5 sm:p-4">
                  <h4 className="text-[13px] sm:text-sm font-bold leading-snug">{f.title}</h4>
                  <p className="text-[11px] sm:text-[12px] text-slate-500 mt-1">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ WHY CHOOSE US ═══════════════════════════════════════════════ */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
            <p className="text-[11px] font-black uppercase tracking-widest text-cyan-400 mb-2">Why Us</p>
            <h2 className="font-display text-2xl sm:text-4xl font-black tracking-tight">
              Repairs People Actually <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Trust</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: <Clock size={20} />, title: "Fast Turnaround", desc: "90% jobs same day ya 24 ghante mein. Emergency repair bhi karte hain." },
              { icon: <Wrench size={20} />, title: "Component-Level Fix", desc: "Board replace nahi karte — actual faulty component change karte hain." },
              { icon: <ShieldCheck size={20} />, title: "Genuine Parts + Warranty", desc: "100% original spares. Har repair par service warranty." },
              { icon: <Gauge size={20} />, title: "Load Tested", desc: "Har repaired item full load par test karke hi return karte hain." },
              { icon: <HandCoins size={20} />, title: "Fair, Transparent Pricing", desc: "Pehle batao, phir repair. Koi hidden charges nahi." },
              { icon: <IndianRupee size={20} />, title: "Best Rates", desc: "17 saal ka experience — quality aur price dono me best." },
            ].map((f, i) => (
              <div key={i} className="rounded-2xl p-6 bg-white/[0.03] border border-white/[0.06] hover:border-cyan-500/30 transition-all">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/15 flex items-center justify-center text-cyan-400 mb-4">
                  {f.icon}
                </div>
                <h4 className="text-[15px] font-bold mb-1.5">{f.title}</h4>
                <p className="text-[13px] text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ════════════════════════════════════════════════ */}
      <section className="py-14 sm:py-20 bg-[#0a0a18]/60 border-y border-white/[0.05]">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
            <p className="text-[11px] font-black uppercase tracking-widest text-cyan-400 mb-2">Testimonials</p>
            <h2 className="font-display text-2xl sm:text-4xl font-black tracking-tight">Our Clients Say</h2>
          </div>

          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 scrollbar-hide">
            {[
              { q: "2 AM pe DJ kharab ho gaya tha — Vikram bhai 3 ghante mein fix kar ke de gaye. Life saver!", n: "Rohit DJ, Jabalpur" },
              { q: "LED wall ka processor jal gaya tha — market me 15 din bol rahe the. Yahan 18 ghante mein ho gaya!", n: "Shubham Events" },
              { q: "SMPS 5 alag shop dikha ke laaya. Aakhir me yahi se 1 din mein theek hua. Genuine parts, kam rate.", n: "Anil Electricals" },
              { q: "EV charger ka PCB fix kiya jo kisi ne nahi kiya. Ab 6 mahine se ekdum perfect chal raha hai.", n: "Sanjay, Bike Rider" },
            ].map((t, i) => (
              <div key={i} className="snap-center shrink-0 w-[85%] sm:w-[46%] lg:w-[31%] rounded-3xl p-6 bg-white/[0.03] border border-white/[0.07]">
                <div className="flex gap-0.5 text-amber-400 mb-3">
                  {Array.from({ length: 5 }).map((_, s) => <Star key={s} size={14} fill="currentColor" />)}
                </div>
                <p className="text-[14px] text-slate-300 leading-relaxed mb-4">&ldquo;{t.q}&rdquo;</p>
                <p className="text-[13px] font-bold text-white">- {t.n}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═════════════════════════════════════════════════════════ */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-4xl px-4">
          <div className="relative overflow-hidden rounded-3xl p-7 sm:p-12 text-center bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-700">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_30%,white_1px,transparent_1px)] [background-size:22px_22px]" />
            <div className="relative">
              <h2 className="font-display text-2xl sm:text-4xl font-black tracking-tight">
                Need Urgent Repair?
              </h2>
              <p className="mt-3 text-[14px] sm:text-base text-blue-100/90 max-w-lg mx-auto">
                Call karo ya WhatsApp par photo bhejo — free estimate. Same-day service available.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row justify-center gap-3">
                <a href={SITE.phoneHref}
                  className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-white text-blue-700 text-[15px] font-black shadow-xl active:scale-95 transition-transform">
                  <Phone size={17} /> Call Now
                </a>
                <a href={WHATSAPP_LINK("Hello, repair ke liye inquiry hai.")} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-[#25D366] text-[#04170c] text-[15px] font-black shadow-xl active:scale-95 transition-transform">
                  <MessageCircle size={17} /> WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FLOATING WhatsApp ════════════════════════════════════════════ */}
      <a href={SITE.whatsapp} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"
        className="fixed bottom-5 right-4 z-40 w-14 h-14 rounded-full bg-[#25D366] flex items-center justify-center shadow-2xl shadow-black/40 active:scale-90 transition-transform">
        <MessageCircle size={26} className="text-[#04170c]" />
      </a>
    </>
  );
}
