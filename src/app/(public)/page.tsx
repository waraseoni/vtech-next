"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Phone,
  MessageCircle,
  Sparkles,
  Mail,
  MapPin,
  ArrowRight,
  Star,
  BadgeCheck,
} from "lucide-react";
import {
  buildWhatsAppLink,
  getCityLabel,
  getServiceList,
  type PublicSiteContent,
} from "@/lib/public-site-defaults";
import { EquipmentArt } from "./components/equipment-art";
import { FaqSection } from "./components/faq-section";
import { HighlightText } from "./components/highlight-text";
import { PUBLIC_ICON_NODES } from "./components/public-icons";
import { usePublicSiteContent } from "./components/public-content-provider";

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
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setStarted(true);
        });
      },
      { threshold: 0.4 }
    );
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
    const tick = (time: number) => {
      const progress = Math.min((time - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(value * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, value]);

  return (
    <div
      ref={ref}
      className="text-center px-2 py-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]"
    >
      <p className="font-display text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
        {shown.toLocaleString("en-IN")}
        {suffix}
      </p>
      <p className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-muted mt-1.5">
        {label}
      </p>
    </div>
  );
}

/* ─── Client-branded minimal home ───────────────────────────────────────────── */
function BrandedHome({ content }: { content: PublicSiteContent }) {
  const { home, contact } = content;
  const services = getServiceList(content);
  const city = getCityLabel(contact.address);
  const showCity =
    city && !`${home.heroTitle} ${home.heroHighlight}`.toLowerCase().includes(city.toLowerCase());

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.16),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.10),transparent_50%)]" />
        <div className="absolute inset-0 opacity-[0.35] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.08)_1px,transparent_0)] [background-size:28px_28px]" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:py-28">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] font-bold uppercase tracking-widest mb-5">
              <Sparkles size={13} /> {home.heroBadge}
            </span>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.08] tracking-tight">
              <HighlightText text={home.heroTitle} highlight={home.heroHighlight} />
              {showCity && <> — {city}</>}
            </h1>
            <p className="mt-5 text-[15px] sm:text-lg text-muted leading-relaxed max-w-xl">
              {home.heroSubtitle}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a
                href={buildWhatsAppLink(
                  content,
                  "Hello, mujhe repair service chahiye. Photo bhej raha hoon."
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-[#25D366] hover:bg-[#1fb959] text-app text-[15px] font-black shadow-lg shadow-[#25D366]/25 transition-all active:scale-95"
              >
                <MessageCircle size={18} /> WhatsApp par photo bhejo
              </a>
              <a
                href={contact.phoneHref}
                className="flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-white/[0.06] border border-white/12 hover:bg-white/[0.1] text-white text-[15px] font-bold transition-all active:scale-95"
              >
                <Phone size={18} className="text-emerald-400" /> Call Now
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      {services.length > 0 && (
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4">
            <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
              <p className="text-[11px] font-black uppercase tracking-widest text-cyan-400 mb-2">
                Our Services
              </p>
              <h2 className="font-display text-2xl sm:text-4xl font-black tracking-tight">
                What We Repair
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <Link
                  key={service.href}
                  href={service.href}
                  className="group rounded-3xl overflow-hidden bg-white/[0.03] border border-white/[0.08] hover:border-blue-500/40 transition-all hover:-translate-y-1"
                >
                  <div className="relative h-28 sm:h-32 overflow-hidden border-b border-white/[0.06]">
                    <EquipmentArt
                      kind={service.art}
                      className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-5 sm:p-6">
                    <h3 className="font-display text-lg font-bold mb-1.5">{service.label}</h3>
                    <p className="text-[13px] text-muted leading-relaxed mb-4 line-clamp-2">
                      {service.desc}
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-blue-400 group-hover:gap-2.5 transition-all">
                      Explore <ArrowRight size={14} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CONTACT STRIP */}
      <section className="py-12 sm:py-16 bg-app/60 border-y border-white/[0.05]">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <p className="text-[11px] font-black uppercase tracking-widest text-cyan-400 mb-2">
              Contact
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight">
              Repair book karein
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <a
              href={contact.phoneHref}
              className="rounded-2xl p-6 bg-white/[0.03] border border-white/[0.06] hover:border-emerald-500/30 transition-all text-center"
            >
              <Phone size={20} className="text-emerald-400 mx-auto mb-3" />
              <h4 className="text-[13px] font-bold text-white">{contact.phone}</h4>
              <p className="text-[11px] text-muted mt-1">Call / WhatsApp</p>
            </a>
            <a
              href={`mailto:${contact.email}`}
              className="rounded-2xl p-6 bg-white/[0.03] border border-white/[0.06] hover:border-blue-500/30 transition-all text-center"
            >
              <Mail size={20} className="text-blue-400 mx-auto mb-3" />
              <h4 className="text-[13px] font-bold text-white break-all">{contact.email}</h4>
              <p className="text-[11px] text-muted mt-1">Email</p>
            </a>
            <div className="rounded-2xl p-6 bg-white/[0.03] border border-white/[0.06] text-center">
              <MapPin size={20} className="text-cyan-400 mx-auto mb-3" />
              <h4 className="text-[13px] font-bold text-white leading-snug">{contact.address}</h4>
              <p className="text-[11px] text-muted mt-1">Location</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FaqSection faq={content.faq} content={content} />

      {/* CTA */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="relative overflow-hidden rounded-3xl p-7 sm:p-12 text-center bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-700">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_30%,white_1px,transparent_1px)] [background-size:22px_22px]" />
            <div className="relative">
              <h2 className="font-display text-2xl sm:text-4xl font-black tracking-tight">
                {home.ctaTitle}
              </h2>
              <p className="mt-3 text-[14px] sm:text-base text-blue-100/90 max-w-lg mx-auto">
                {home.ctaSubtitle}
              </p>
              <div className="mt-7 flex flex-col sm:flex-row justify-center gap-3">
                <a
                  href={contact.phoneHref}
                  className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-white text-blue-700 text-[15px] font-black shadow-xl active:scale-95 transition-transform"
                >
                  <Phone size={17} /> Call Now
                </a>
                <a
                  href={buildWhatsAppLink(content, "Hello, repair ke liye inquiry hai.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-[#25D366] text-app text-[15px] font-black shadow-xl active:scale-95 transition-transform"
                >
                  <MessageCircle size={17} /> WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default function PublicHome() {
  const content = usePublicSiteContent();

  if (content.mode === "minimal") return <BrandedHome content={content} />;

  const { home, contact } = content;
  const services = getServiceList(content);
  const city = getCityLabel(contact.address);
  const showCity =
    city && !`${home.heroTitle} ${home.heroHighlight}`.toLowerCase().includes(city.toLowerCase());
  const whyCards = home.why.slice(0, 4);

  return (
    <>
      {/* ═══ HERO ═════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[75dvh] flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.14),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.10),transparent_50%)]" />
        <div className="absolute inset-0 opacity-[0.35] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.08)_1px,transparent_0)] [background-size:28px_28px]" />
        {PARTICLES.map((particle, index) => (
          <div
            key={index}
            className="absolute rounded-full bg-blue-400/40 anim-float"
            style={{
              top: particle.top,
              left: particle.left,
              width: particle.size,
              height: particle.size,
              animationDelay: particle.delay,
              animationDuration: particle.dur,
            }}
          />
        ))}

        <div className="relative mx-auto max-w-7xl px-4 w-full py-16">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] font-bold uppercase tracking-widest mb-5">
              <Sparkles size={13} /> {home.heroBadge}
            </span>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.08] tracking-tight">
              <HighlightText text={home.heroTitle} highlight={home.heroHighlight} />
              {showCity && <> — {city}</>}
            </h1>

            <p className="mt-5 text-[15px] sm:text-lg text-muted leading-relaxed max-w-xl">
              {home.heroSubtitle}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a
                href={buildWhatsAppLink(
                  content,
                  "Hello, mujhe repair service chahiye. Photo bhej raha hoon."
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-[#25D366] hover:bg-[#1fb959] text-app text-[15px] font-black shadow-lg shadow-[#25D366]/25 transition-all active:scale-95"
              >
                <MessageCircle size={18} /> WhatsApp par photo bhejo
              </a>
              <a
                href={contact.phoneHref}
                className="flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-white/[0.06] border border-white/12 hover:bg-white/[0.1] text-white text-[15px] font-bold transition-all active:scale-95"
              >
                <Phone size={18} className="text-emerald-400" /> Call Now
              </a>
            </div>

            {home.trustChips.length > 0 && (
              <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-bold text-muted">
                {home.trustChips.map((chip) => (
                  <span key={chip} className="flex items-center gap-1 text-app-2">
                    <BadgeCheck size={13} className="text-emerald-400" /> {chip}
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ═══ 3 PILLARS ════════════════════════════════════════════════════ */}
      {services.length > 0 && (
        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-7xl px-4">
            <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
              <p className="text-[11px] font-black uppercase tracking-widest text-cyan-400 mb-2">
                What We Repair
              </p>
              <h2 className="font-display text-2xl sm:text-4xl font-black tracking-tight">
                Three Specialities.{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                  One Trusted Shop.
                </span>
              </h2>
            </div>

            <div className="flex lg:grid lg:grid-cols-3 gap-4 overflow-x-auto snap-x snap-mandatory pb-2 lg:pb-0 lg:overflow-visible -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-hide">
              {services.map((service) => (
                <Link
                  key={service.href}
                  href={service.href}
                  className="snap-center shrink-0 w-[82%] sm:w-[55%] lg:w-auto group rounded-3xl overflow-hidden bg-gradient-to-b from-white/[0.05] to-white/[0.02] border border-white/[0.08] hover:border-blue-500/40 transition-all hover:-translate-y-1"
                >
                  <div className="relative h-28 sm:h-32 overflow-hidden border-b border-white/[0.06]">
                    <EquipmentArt
                      kind={service.art}
                      className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-5 sm:p-6">
                    <h3 className="font-display text-lg font-bold mb-1.5">{service.label}</h3>
                    <p className="text-[13px] text-muted leading-relaxed mb-4 line-clamp-2">
                      {service.desc}
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-blue-400 group-hover:gap-2.5 transition-all">
                      Explore <ArrowRight size={14} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ STATS ════════════════════════════════════════════════════════ */}
      {home.stats.length > 0 && (
        <section className="py-10 sm:py-14">
          <div className="mx-auto max-w-7xl px-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {home.stats.map((stat) => (
                <Stat key={stat.label} value={stat.value} suffix={stat.suffix} label={stat.label} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ FEATURED SERVICES ═══════════════════════════════════════════ */}
      {home.featured.length > 0 && (
        <section className="py-14 sm:py-20 bg-app/60 border-y border-white/[0.05]">
          <div className="mx-auto max-w-7xl px-4">
            <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
              <p className="text-[11px] font-black uppercase tracking-widest text-cyan-400 mb-2">
                Featured Expertise
              </p>
              <h2 className="font-display text-2xl sm:text-4xl font-black tracking-tight">
                Popular Repair Services
              </h2>
              <p className="text-[13px] sm:text-sm text-muted mt-3">
                Don&apos;t see yours? Call karo — agar bana banaya hai to hum fix kar denge.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {home.featured.map((featured) => (
                <div
                  key={`${featured.art}-${featured.title}`}
                  className="group rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.06] hover:border-blue-500/40 hover:bg-white/[0.05] transition-all active:scale-[0.98]"
                >
                  <div className="relative h-20 sm:h-24 overflow-hidden bg-app">
                    <EquipmentArt
                      kind={featured.art}
                      className="h-full w-full transition-transform duration-500 group-hover:scale-110"
                    />
                  </div>
                  <div className="p-3.5 sm:p-4">
                    <h4 className="text-[13px] sm:text-sm font-bold leading-snug">
                      {featured.title}
                    </h4>
                    <p className="text-[11px] sm:text-[12px] text-muted mt-1">{featured.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ WHY CHOOSE US ═══════════════════════════════════════════════ */}
      {home.why.length > 0 && (
        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-7xl px-4">
            <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
              <p className="text-[11px] font-black uppercase tracking-widest text-cyan-400 mb-2">
                Why Us
              </p>
              <h2 className="font-display text-2xl sm:text-4xl font-black tracking-tight">
                Repairs People Actually{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                  Trust
                </span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {whyCards.map((reason) => (
                <div
                  key={reason.title}
                  className="rounded-2xl p-6 bg-white/[0.03] border border-white/[0.06] hover:border-cyan-500/30 transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/15 flex items-center justify-center text-cyan-400 mb-4">
                    {PUBLIC_ICON_NODES[reason.icon]}
                  </div>
                  <h4 className="text-[15px] font-bold mb-1.5">{reason.title}</h4>
                  <p className="text-[13px] text-muted leading-relaxed">{reason.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ TESTIMONIALS ════════════════════════════════════════════════ */}
      {home.testimonials.length > 0 && (
        <section className="py-14 sm:py-20 bg-app/60 border-y border-white/[0.05]">
          <div className="mx-auto max-w-7xl px-4">
            <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
              <p className="text-[11px] font-black uppercase tracking-widest text-cyan-400 mb-2">
                Testimonials
              </p>
              <h2 className="font-display text-2xl sm:text-4xl font-black tracking-tight">
                Our Clients Say
              </h2>
            </div>

            <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 scrollbar-hide">
              {home.testimonials.map((testimonial) => (
                <div
                  key={`${testimonial.name}-${testimonial.quote.slice(0, 24)}`}
                  className="snap-center shrink-0 w-[85%] sm:w-[46%] lg:w-[31%] rounded-3xl p-6 bg-white/[0.03] border border-white/[0.07]"
                >
                  <div className="flex gap-0.5 text-amber-400 mb-3">
                    {Array.from({ length: testimonial.rating ?? 5 }).map((_, star) => (
                      <Star key={star} size={14} fill="currentColor" />
                    ))}
                  </div>
                  <p className="text-[14px] text-app-2 leading-relaxed mb-4">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                  <p className="text-[13px] font-bold text-white">- {testimonial.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ FAQ ═════════════════════════════════════════════════════════ */}
      <FaqSection faq={content.faq} content={content} />

      {/* ═══ CTA ═════════════════════════════════════════════════════════ */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-4xl px-4">
          <div className="relative overflow-hidden rounded-3xl p-7 sm:p-12 text-center bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-700">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_30%,white_1px,transparent_1px)] [background-size:22px_22px]" />
            <div className="relative">
              <h2 className="font-display text-2xl sm:text-4xl font-black tracking-tight">
                {home.ctaTitle}
              </h2>
              <p className="mt-3 text-[14px] sm:text-base text-blue-100/90 max-w-lg mx-auto">
                {home.ctaSubtitle}
              </p>
              <div className="mt-7 flex flex-col sm:flex-row justify-center gap-3">
                <a
                  href={contact.phoneHref}
                  className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-white text-blue-700 text-[15px] font-black shadow-xl active:scale-95 transition-transform"
                >
                  <Phone size={17} /> Call Now
                </a>
                <a
                  href={buildWhatsAppLink(content, "Hello, repair ke liye inquiry hai.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-[#25D366] text-app text-[15px] font-black shadow-xl active:scale-95 transition-transform"
                >
                  <MessageCircle size={17} /> WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
