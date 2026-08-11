"use client";

import { useEffect, useRef, useState } from "react";
import { Star, Quote, Phone, MessageCircle, MapPin, HeartHandshake, Trophy, ShieldCheck } from "lucide-react";
import { SITE, WHATSAPP_LINK } from "../site";

function StatChip({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e.forEach(x => x.isIntersecting && setStarted(true)), { threshold: 0.4 });
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
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, value]);

  return (
    <div ref={ref} className="text-center">
      <p className="font-display text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
        {shown.toLocaleString("en-IN")}{suffix}
      </p>
      <p className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-slate-500 mt-1">{label}</p>
    </div>
  );
}

export default function AboutPage() {
  return (
    <>
      {/* ═══ HERO ═════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.10),transparent_50%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:py-20">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] font-bold uppercase tracking-widest mb-5">
            <Trophy size={13} /> Since 2007
          </span>
          <h1 className="font-display text-3xl sm:text-5xl font-black tracking-tight leading-[1.1] max-w-3xl">
            V-<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Technologies</span> — Jabalpur ka most trusted repair hub
          </h1>
          <p className="mt-4 text-[14px] sm:text-base text-slate-400 leading-relaxed max-w-2xl">
            DJ systems, moving heads, laser lights, LED walls, processors aur SMPS — Central India ka sabse bada aur bharosemand repair center.
          </p>
          <div className="mt-7 grid grid-cols-3 gap-3 sm:gap-6 max-w-lg rounded-2xl p-5 sm:p-6 bg-white/[0.03] border border-white/[0.08]">
            <StatChip value={17} suffix="+" label="Years" />
            <StatChip value={27000} suffix="+" label="Repairs" />
            <StatChip value={5000} suffix="+" label="Clients" />
          </div>
        </div>
      </section>

      {/* ═══ STORY ════════════════════════════════════════════════════════ */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight">
                From One Table to the <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Biggest Repair Hub</span>
              </h2>
              <div className="mt-5 space-y-4 text-[14px] sm:text-[15px] text-slate-400 leading-relaxed">
                <p>
                  Hi, I&apos;m <strong className="text-blue-400">Vikram Jain</strong>. In 2007, maine yeh journey shuru ki — bas ek chhoti si table, kuch tools, aur cheezein theek karne ka junoon.
                </p>
                <p>
                  Aaj hum proudly hain — Central India ka <strong className="text-blue-400">largest aur most trusted</strong> repair center for DJ systems, moving heads, laser lights, LED walls, processors aur SMPS.
                </p>
                <p>
                  Shaadi ki emergency 2 AM par ho ya kal ka bada event — <strong className="text-blue-400">hum kabhi &quot;na&quot; nahi bolte</strong>.
                </p>
              </div>
              <div className="mt-5 rounded-2xl p-5 border-l-4 border-blue-500 bg-white/[0.03]">
                <p className="font-bold text-white text-[15px]">
                  &ldquo;Aapka bharosa hi hamari sabse badi kamai hai. Jab aapka equipment perfect chalta hai aur aap smile karte ho — wahi hamara reward hai.&rdquo;
                </p>
              </div>
            </div>

            <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-white/[0.05] to-white/[0.02] border border-white/[0.08]">
              <div className="grid grid-cols-3 gap-4 text-center mb-6">
                {[
                  { icon: <Trophy size={16} />, label: "17+ Years", cls: "text-blue-400" },
                  { icon: <HeartHandshake size={16} />, label: "5,000+ Clients", cls: "text-cyan-400" },
                  { icon: <ShieldCheck size={16} />, label: "100% Tested", cls: "text-emerald-400" },
                ].map((s, i) => (
                  <div key={i} className="flex flex-col items-center gap-2 rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06]">
                    {s.icon}
                    <span className={`text-[12px] font-bold ${s.cls}`}>{s.label}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl p-6 text-center bg-gradient-to-br from-blue-600/20 to-cyan-600/10 border border-blue-500/20">
                <p className="font-display text-3xl font-black text-white">24×7</p>
                <p className="text-[12px] font-bold text-slate-400 mt-1">Emergency Repair Service</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ WHY ═════════════════════════════════════════════════════════ */}
      <section className="py-12 sm:py-16 bg-[#0a0a18]/60 border-y border-white/[0.05]">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-center mb-8 sm:mb-12">
            Why <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">5,000+ Clients</span> Choose Us
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: <Phone size={20} />, title: "Lightning Fast", desc: "90% jobs 24 ghante mein. Emergency? 2–6 ghante mein fix!" },
              { icon: <Trophy size={20} />, title: "17 Years of Mastery", desc: "Basic SMPS se lekar high-end LED wall processor tak — sab dekha hai." },
              { icon: <ShieldCheck size={20} />, title: "100% Transparent", desc: "Original parts. Koi hidden charges nahi. Sab kuch dikhta hai." },
            ].map((f, i) => (
              <div key={i} className="rounded-3xl p-6 bg-white/[0.03] border border-white/[0.06] hover:border-blue-500/40 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/15 flex items-center justify-center text-cyan-400 mb-4">
                  {f.icon}
                </div>
                <h3 className="text-[15px] font-bold mb-1.5">{f.title}</h3>
                <p className="text-[13px] text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TEAM ════════════════════════════════════════════════════════ */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-center mb-8 sm:mb-12">
            The Faces Behind <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Your Trust</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: "Vikram Jain", role: "Founder & Master Technician", quote: "Har kharab equipment ki ek kahani hoti hai. Main bas use dobara chalana seekhata hoon." },
              { name: "Preeti Jain", role: "Customer Happiness Manager", quote: "Repair item uthate waqt aapki smile — wahi mera sabse bada reward hai." },
              { name: "Hemant Mehra", role: "Head Technician", quote: "Dead circuit se perfect beats tak — main machines ko wapas zinda karta hoon." },
            ].map((m, i) => (
              <div key={i} className="rounded-3xl overflow-hidden bg-white/[0.03] border border-white/[0.06] hover:border-blue-500/40 transition-all">
                <div className="h-24 bg-gradient-to-br from-blue-600/25 to-cyan-600/15" />
                <div className="px-6 pb-6 -mt-10 text-center">
                  <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xl font-black text-white ring-4 ring-[#070714] shadow-xl">
                    {m.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <h3 className="text-[15px] font-bold mt-4">{m.name}</h3>
                  <p className="text-[12px] font-bold text-blue-400 mt-0.5">{m.role}</p>
                  <p className="text-[13px] text-slate-400 leading-relaxed mt-3">{m.quote}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ════════════════════════════════════════════════ */}
      <section className="py-12 sm:py-16 bg-[#0a0a18]/60 border-y border-white/[0.05]">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-center mb-8 sm:mb-12">
            What Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Clients Say</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { q: "2 AM pe DJ kharab ho gaya tha — Vikram bhai 3 ghante mein fix kar ke de gaye. Life saver!", n: "Rohit DJ, Jabalpur" },
              { q: "LED wall ka processor jal gaya tha — market mein 15 din bol rahe the. Yahan 18 ghante mein ho gaya!", n: "Shubham Events" },
            ].map((t, i) => (
              <div key={i} className="rounded-3xl p-6 bg-white/[0.03] border border-white/[0.07]">
                <Quote size={20} className="text-blue-500/40 mb-3" />
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

      {/* ═══ CONTACT + CTA ═══════════════════════════════════════════════ */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-3xl p-6 sm:p-8 bg-white/[0.03] border border-white/[0.08]">
            <h2 className="font-display text-xl sm:text-2xl font-black text-center mb-6">Visit Our Workshop</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06]">
                <MapPin size={18} className="text-cyan-400 shrink-0 mt-0.5" />
                <p className="text-[13px] text-slate-400 leading-relaxed">{SITE.address}</p>
              </div>
              <a href={SITE.phoneHref} className="flex items-start gap-3 rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06] active:scale-[0.99] transition-transform">
                <Phone size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <span className="block text-[13px] font-bold text-white">{SITE.phone}</span>
                  <span className="text-[11px] text-slate-500">Call for repair / estimate</span>
                </span>
              </a>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl mt-6 p-7 sm:p-10 text-center bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-700">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_30%,white_1px,transparent_1px)] [background-size:22px_22px]" />
            <div className="relative">
              <h3 className="font-display text-2xl sm:text-3xl font-black tracking-tight">Ready to Get Your Equipment Repaired?</h3>
              <p className="mt-2 text-[14px] text-blue-100/90">Aaj hi call karo — free diagnostic assessment.</p>
              <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
                <a href={SITE.phoneHref} className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-blue-700 text-[14px] font-black shadow-xl active:scale-95 transition-transform">
                  <Phone size={16} /> Call Now
                </a>
                <a href={WHATSAPP_LINK("Hello, repair ke liye inquiry hai.")} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#25D366] text-[#04170c] text-[14px] font-black shadow-xl active:scale-95 transition-transform">
                  <MessageCircle size={16} /> WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
