"use client";

import { useEffect, useRef, useState } from "react";
import {
  Star,
  Quote,
  Phone,
  MessageCircle,
  MapPin,
  HeartHandshake,
  Trophy,
  ShieldCheck,
  Mail,
  Clock,
} from "lucide-react";
import { buildWhatsAppLink, type PublicSiteContent } from "@/lib/public-site-defaults";
import { HighlightText } from "../components/highlight-text";
import { PUBLIC_ICON_NODES } from "../components/public-icons";
import { usePublicSiteContent } from "../components/public-content-provider";

function StatChip({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (e) => e.forEach((x) => x.isIntersecting && setStarted(true)),
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
        {shown.toLocaleString("en-IN")}
        {suffix}
      </p>
      <p className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-muted mt-1">
        {label}
      </p>
    </div>
  );
}

function AboutHero({
  content,
  badgeIcon,
  stats,
}: {
  content: PublicSiteContent;
  badgeIcon: React.ReactNode;
  stats: PublicSiteContent["about"]["stats"];
}) {
  const about = content.about;
  return (
    <section className="relative overflow-hidden border-b border-white/[0.06]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.10),transparent_50%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:py-20">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] font-bold uppercase tracking-widest mb-5">
          {badgeIcon} {about.badge}
        </span>
        <h1 className="font-display text-3xl sm:text-5xl font-black tracking-tight leading-[1.1] max-w-3xl">
          <HighlightText text={about.title} highlight={about.highlight} />
        </h1>
        <p className="mt-4 text-[14px] sm:text-base text-muted leading-relaxed max-w-2xl">
          {about.subtitle}
        </p>
        {stats.length > 0 && (
          <div className="mt-7 grid grid-cols-3 gap-3 sm:gap-6 max-w-lg rounded-2xl p-5 sm:p-6 bg-white/[0.03] border border-white/[0.08]">
            {stats.slice(0, 3).map((s, i) => (
              <StatChip key={`${s.label}-${i}`} value={s.value} suffix={s.suffix} label={s.label} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ContactCard({ content }: { content: PublicSiteContent }) {
  const { contact } = content;
  return (
    <div className="rounded-3xl p-6 sm:p-8 bg-white/[0.03] border border-white/[0.08]">
      <h2 className="font-display text-xl sm:text-2xl font-black text-center mb-6">
        {content.about.visitTitle}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <a
          href={contact.phoneHref}
          className="flex items-start gap-3 rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06] active:scale-[0.99] transition-transform"
        >
          <Phone size={18} className="text-emerald-400 shrink-0 mt-0.5" />
          <span>
            <span className="block text-[13px] font-bold text-white">{contact.phone}</span>
            <span className="text-[11px] text-muted">Call for repair / estimate</span>
          </span>
        </a>
        <a
          href={`mailto:${contact.email}`}
          className="flex items-start gap-3 rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06] active:scale-[0.99] transition-transform"
        >
          <Mail size={18} className="text-blue-400 shrink-0 mt-0.5" />
          <span>
            <span className="block text-[13px] font-bold text-white break-all">
              {contact.email}
            </span>
            <span className="text-[11px] text-muted">Email</span>
          </span>
        </a>
        <div className="flex items-start gap-3 rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06]">
          <MapPin size={18} className="text-cyan-400 shrink-0 mt-0.5" />
          <p className="text-[13px] text-muted leading-relaxed">{contact.address}</p>
        </div>
        <div className="flex items-start gap-3 rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06]">
          <Clock size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[13px] font-bold text-white">{contact.businessHours}</p>
        </div>
      </div>
      <a
        href={buildWhatsAppLink(content)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 flex items-center justify-center gap-2 px-4 py-4 rounded-2xl bg-[#25D366]/15 border border-[#25D366]/25 text-[#4ade80] text-[14px] font-black active:scale-[0.99] transition-transform"
      >
        <MessageCircle size={17} /> WhatsApp par turant baat karein
      </a>
    </div>
  );
}

function CtaBlock({ content }: { content: PublicSiteContent }) {
  return (
    <div className="relative overflow-hidden rounded-3xl p-7 sm:p-10 text-center bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-700">
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_30%,white_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="relative">
        <h3 className="font-display text-2xl sm:text-3xl font-black tracking-tight">
          Ready to Get Your Equipment Repaired?
        </h3>
        <p className="mt-2 text-[14px] text-blue-100/90">
          Aaj hi call karo — free diagnostic assessment.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
          <a
            href={content.contact.phoneHref}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-blue-700 text-[14px] font-black shadow-xl active:scale-95 transition-transform"
          >
            <Phone size={16} /> Call Now
          </a>
          <a
            href={buildWhatsAppLink(content, "Hello, repair ke liye inquiry hai.")}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#25D366] text-app text-[14px] font-black shadow-xl active:scale-95 transition-transform"
          >
            <MessageCircle size={16} /> WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

function BrandedAbout({ content }: { content: PublicSiteContent }) {
  return (
    <>
      <AboutHero content={content} badgeIcon={<HeartHandshake size={13} />} stats={[]} />
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4">
          <ContactCard content={content} />
        </div>
      </section>
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4">
          <CtaBlock content={content} />
        </div>
      </section>
    </>
  );
}

const BADGE_ICONS = [Trophy, HeartHandshake, ShieldCheck];

export default function AboutPage() {
  const content = usePublicSiteContent();
  const about = content.about;

  if (content.mode === "minimal") return <BrandedAbout content={content} />;

  const hasStory = about.story.length > 0 || !!about.storyHeading;
  const hasSidePanel = about.badges.length > 0 || !!about.emergency;
  const hasWhy = about.why.length > 0;
  const hasTeam = about.team.length > 0;
  const hasTestimonials = about.testimonials.length > 0;

  return (
    <>
      <AboutHero content={content} badgeIcon={<Trophy size={13} />} stats={about.stats} />

      {(hasStory || hasSidePanel) && (
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {hasStory && (
                <div>
                  <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight">
                    <HighlightText
                      text={about.storyHeading}
                      highlight={about.storyHighlight}
                      className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400"
                    />
                  </h2>
                  {about.story.length > 0 && (
                    <div className="mt-5 space-y-4 text-[14px] sm:text-[15px] text-muted leading-relaxed">
                      {about.story.map((paragraph, i) => (
                        <p key={i}>{paragraph}</p>
                      ))}
                    </div>
                  )}
                  {about.quote && (
                    <div className="mt-5 rounded-2xl p-5 border-l-4 border-blue-500 bg-white/[0.03]">
                      <p className="font-bold text-white text-[15px]">
                        &ldquo;{about.quote}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              )}

              {hasSidePanel && (
                <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-white/[0.05] to-white/[0.02] border border-white/[0.08]">
                  {about.badges.length > 0 && (
                    <div className="grid grid-cols-3 gap-4 text-center mb-6">
                      {about.badges.slice(0, 3).map((label, i) => {
                        const Icon = BADGE_ICONS[i % BADGE_ICONS.length];
                        return (
                          <div
                            key={`${label}-${i}`}
                            className="flex flex-col items-center gap-2 rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06]"
                          >
                            <Icon size={16} />
                            <span className="text-[12px] font-bold text-app-2">{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {about.emergency && (
                    <div className="rounded-2xl p-6 text-center bg-gradient-to-br from-blue-600/20 to-cyan-600/10 border border-blue-500/20">
                      <p className="font-display text-3xl font-black text-white">
                        {about.emergency.value}
                      </p>
                      <p className="text-[12px] font-bold text-muted mt-1">
                        {about.emergency.label}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {hasWhy && (
        <section className="py-12 sm:py-16 bg-app/60 border-y border-white/[0.05]">
          <div className="mx-auto max-w-7xl px-4">
            <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-center mb-8 sm:mb-12">
              Why <HighlightText text="Clients" />
              {" Choose Us"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {about.why.map((f, i) => (
                <div
                  key={`${f.title}-${i}`}
                  className="rounded-3xl p-6 bg-white/[0.03] border border-white/[0.06] hover:border-blue-500/40 transition-all"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/15 flex items-center justify-center text-cyan-400 mb-4">
                    {PUBLIC_ICON_NODES[f.icon]}
                  </div>
                  <h3 className="text-[15px] font-bold mb-1.5">{f.title}</h3>
                  <p className="text-[13px] text-muted leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {hasTeam && (
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4">
            <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-center mb-8 sm:mb-12">
              The Faces Behind <HighlightText text="Your Trust" />
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {about.team.map((m, i) => (
                <div
                  key={`${m.name}-${i}`}
                  className="rounded-3xl overflow-hidden bg-white/[0.03] border border-white/[0.06] hover:border-blue-500/40 transition-all"
                >
                  <div className="h-24 bg-gradient-to-br from-blue-600/25 to-cyan-600/15" />
                  <div className="px-6 pb-6 -mt-10 text-center">
                    <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xl font-black text-white ring-4 ring-[#070714] shadow-xl">
                      {m.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <h3 className="text-[15px] font-bold mt-4">{m.name}</h3>
                    <p className="text-[12px] font-bold text-blue-400 mt-0.5">{m.role}</p>
                    <p className="text-[13px] text-muted leading-relaxed mt-3">{m.quote}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {hasTestimonials && (
        <section className="py-12 sm:py-16 bg-app/60 border-y border-white/[0.05]">
          <div className="mx-auto max-w-7xl px-4">
            <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-center mb-8 sm:mb-12">
              What Our <HighlightText text="Clients Say" />
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {about.testimonials.map((t, i) => (
                <div
                  key={`${t.name}-${i}`}
                  className="rounded-3xl p-6 bg-white/[0.03] border border-white/[0.07]"
                >
                  <Quote size={20} className="text-blue-500/40 mb-3" />
                  <div className="flex gap-0.5 text-amber-400 mb-3">
                    {Array.from({ length: t.rating ?? 5 }).map((_, s) => (
                      <Star key={s} size={14} fill="currentColor" />
                    ))}
                  </div>
                  <p className="text-[14px] text-app-2 leading-relaxed mb-4">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <p className="text-[13px] font-bold text-white">- {t.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4">
          <ContactCard content={content} />
          <div className="mt-6">
            <CtaBlock content={content} />
          </div>
        </div>
      </section>
    </>
  );
}
