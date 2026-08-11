"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Phone, Menu, X, ChevronDown, Zap, MessageCircle, MapPin, Mail, Clock, LogIn, QrCode,
} from "lucide-react";
import { SITE, SERVICES } from "./site";
import { QrShareModal } from "./components/qr-share";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/job-status", label: "Track Repair" },
  { href: "/contact", label: "Contact" },
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 8);
    h();
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  // Route change → close menu (rAF callback ke andar setState; see react-hooks/set-state-in-effect)
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setMenuOpen(false);
      setServicesOpen(false);
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  // Mobile menu open → lock body scroll
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const linkCls = (href: string, exact = false) => {
    const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
    return `relative text-[13px] font-semibold transition-colors ${
      active ? "text-white" : "text-slate-400 hover:text-white"
    }`;
  };

  return (
    <div className="min-h-screen bg-[#070714] text-white overflow-x-hidden">
      {/* ─── NAVBAR ─────────────────────────────────────────────────────── */}
      <header className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ${
        scrolled || menuOpen
          ? "bg-[#070714]/90 backdrop-blur-xl border-white/[0.06]"
          : "bg-[#070714]/40 backdrop-blur-md border-transparent"
      }`}>
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between gap-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 min-w-0" onClick={() => setMenuOpen(false)}>
            <div className="w-9 h-9 shrink-0 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Zap size={18} className="text-white" fill="currentColor" />
            </div>
            <span className="font-display text-[15px] font-bold tracking-tight leading-none truncate">
              V-<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Technologies</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className={linkCls("/", true)}>Home</Link>

            {/* Services dropdown */}
            <div className="relative group">
              <button className={`flex items-center gap-1 text-[13px] font-semibold transition-colors ${
                pathname.startsWith("/stage-lighting") || pathname.startsWith("/industrial") || pathname.startsWith("/power-supply")
                  ? "text-white" : "text-slate-400 group-hover:text-white"
              }`}>
                Services
                <ChevronDown size={13} className="mt-0.5 transition-transform group-hover:rotate-180" />
              </button>
              <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-200">
                <div className="w-72 rounded-2xl border border-white/10 bg-[#0b0b1a]/95 backdrop-blur-xl p-2 shadow-2xl shadow-black/60">
                  {SERVICES.map((s) => (
                    <Link key={s.href} href={s.href}
                      className={`flex items-start gap-3 px-3 py-3 rounded-xl transition-colors ${
                        pathname.startsWith(s.href) ? "bg-blue-500/10" : "hover:bg-white/[0.05]"
                      }`}>
                      <div className="w-8 h-8 shrink-0 bg-blue-500/15 rounded-lg flex items-center justify-center">
                        <Zap size={14} className="text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white">{s.label}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{s.desc}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <Link href="/job-status" className={linkCls("/job-status")}>Track Repair</Link>
            <Link href="/about" className={linkCls("/about")}>About</Link>
            <Link href="/contact" className={linkCls("/contact")}>Contact</Link>
          </nav>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-2">
            <button onClick={() => setQrOpen(true)} aria-label="Scan &amp; share website QR"
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-[13px] font-bold hover:bg-white/[0.1] transition-colors">
              <QrCode size={15} className="text-cyan-400" />
              <span className="hidden lg:inline">QR</span>
            </button>
            <a href={SITE.phoneHref}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-[13px] font-bold hover:bg-white/[0.1] transition-colors">
              <Phone size={14} className="text-emerald-400" />
              Call Now
            </a>
            <Link href="/login"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-[13px] font-bold shadow-lg shadow-blue-600/25 transition-all active:scale-95">
              <LogIn size={14} />
              Login
            </Link>
          </div>

          {/* Mobile actions */}
          <div className="flex md:hidden items-center gap-1.5">
            <button onClick={() => setQrOpen(true)} aria-label="Scan &amp; share website QR"
              className="tap-target w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.06] border border-white/10 text-cyan-400 active:scale-95 transition-transform">
              <QrCode size={18} />
            </button>
            <a href={SITE.phoneHref} aria-label="Call us"
              className="tap-target w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 active:scale-95 transition-transform">
              <Phone size={18} />
            </a>
            <button onClick={() => setMenuOpen(v => !v)} aria-label="Toggle menu"
              className="tap-target w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.06] border border-white/10 active:scale-95 transition-transform">
              {menuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>
      </header>

      {/* ─── MOBILE MENU (full-screen sheet) ────────────────────────────── */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 top-14 z-40 bg-[#070714]/98 backdrop-blur-xl overflow-y-auto anim-fade">
          <nav className="px-4 pt-3 pb-8 flex flex-col gap-1">
            <Link href="/" className="flex items-center gap-3 px-4 py-4 rounded-xl bg-white/[0.04] text-[15px] font-bold active:bg-white/[0.08]">
              <Zap size={17} className="text-blue-400" /> Home
            </Link>

            {/* Services accordion */}
            <div className="rounded-xl bg-white/[0.04]">
              <button onClick={() => setServicesOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-4 text-[15px] font-bold active:bg-white/[0.08] rounded-xl">
                <span className="flex items-center gap-3"><Zap size={17} className="text-cyan-400" /> Services</span>
                <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${servicesOpen ? "rotate-180" : ""}`} />
              </button>
              {servicesOpen && (
                <div className="px-3 pb-3 space-y-1">
                  {SERVICES.map((s) => (
                    <Link key={s.href} href={s.href}
                      className={`flex items-start gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                        pathname.startsWith(s.href) ? "bg-blue-500/15 text-blue-300" : "text-slate-300 active:bg-white/[0.06]"
                      }`}>
                      <div className="w-7 h-7 shrink-0 bg-blue-500/15 rounded-lg flex items-center justify-center mt-0.5">
                        <Zap size={13} className="text-blue-400" />
                      </div>
                      <div>
                        <p className="font-bold text-[14px]">{s.label}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{s.desc}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {NAV_LINKS.filter(l => l.href !== "/").map((l) => (
              <Link key={l.href} href={l.href}
                className="flex items-center gap-3 px-4 py-4 rounded-xl bg-white/[0.04] text-[15px] font-bold active:bg-white/[0.08]">
                {l.label}
              </Link>
            ))}

            <button onClick={() => { setMenuOpen(false); setQrOpen(true); }}
              className="flex items-center gap-3 px-4 py-4 rounded-xl bg-white/[0.04] text-[15px] font-bold active:bg-white/[0.08]">
              <QrCode size={17} className="text-cyan-400" /> Website QR — Scan &amp; Share
            </button>

            {/* Actions */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <a href={SITE.phoneHref}
                className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-sm font-bold active:scale-95 transition-transform">
                <Phone size={16} /> Call Now
              </a>
              <a href={SITE.whatsapp} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-[#25D366]/15 border border-[#25D366]/25 text-[#4ade80] text-sm font-bold active:scale-95 transition-transform">
                <MessageCircle size={16} /> WhatsApp
              </a>
            </div>
            <Link href="/login"
              className="mt-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-sm font-bold shadow-lg shadow-blue-600/25 active:scale-95 transition-transform">
              <LogIn size={16} /> Staff / Client Login
            </Link>
          </nav>
        </div>
      )}

      {/* Content */}
      <main className="pt-14">{children}</main>

      {/* ─── FOOTER ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06] bg-[#05050f]">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                  <Zap size={18} className="text-white" fill="currentColor" />
                </div>
                <span className="font-display text-[15px] font-bold">
                  V-<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Technologies</span>
                </span>
              </div>
              <p className="text-[13px] text-slate-500 leading-relaxed">
                {SITE.tagline} — Jabalpur&apos;s trusted repair center since 2007. Fast repairs, genuine parts, fair rates.
              </p>
            </div>

            {/* Quick links */}
            <div>
              <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">Quick Links</h4>
              <ul className="space-y-2.5">
                <li><Link href="/" className="text-[13px] text-slate-400 hover:text-white transition-colors">Home</Link></li>
                <li><Link href="/job-status" className="text-[13px] text-slate-400 hover:text-white transition-colors">Track Your Repair</Link></li>
                <li><Link href="/about" className="text-[13px] text-slate-400 hover:text-white transition-colors">About Us</Link></li>
                <li><Link href="/contact" className="text-[13px] text-slate-400 hover:text-white transition-colors">Contact / Inquiry</Link></li>
              </ul>
            </div>

            {/* Services */}
            <div>
              <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">Our Services</h4>
              <ul className="space-y-2.5">
                {SERVICES.map((s) => (
                  <li key={s.href}><Link href={s.href} className="text-[13px] text-slate-400 hover:text-white transition-colors">{s.label}</Link></li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">Contact Us</h4>
              <ul className="space-y-3">
                <li>
                  <a href={SITE.phoneHref} className="flex items-start gap-2.5 text-[13px] text-slate-400 hover:text-white transition-colors">
                    <Phone size={15} className="mt-0.5 shrink-0 text-emerald-400" /> {SITE.phone}
                  </a>
                </li>
                <li>
                  <a href={`mailto:${SITE.email}`} className="flex items-start gap-2.5 text-[13px] text-slate-400 hover:text-white transition-colors">
                    <Mail size={15} className="mt-0.5 shrink-0 text-blue-400" /> {SITE.email}
                  </a>
                </li>
                <li className="flex items-start gap-2.5 text-[13px] text-slate-400">
                  <MapPin size={15} className="mt-0.5 shrink-0 text-cyan-400" /> {SITE.address}
                </li>
                <li className="flex items-start gap-2.5 text-[13px] text-slate-400">
                  <Clock size={15} className="mt-0.5 shrink-0 text-amber-400" /> Mon–Sat · 9:00 AM – 8:00 PM
                </li>
              </ul>
            </div>
          </div>

          {/* WhatsApp CTA */}
          <a href={SITE.whatsapp} target="_blank" rel="noopener noreferrer"
            className="mt-8 flex items-center justify-center gap-2.5 px-4 py-4 rounded-2xl bg-gradient-to-r from-[#25D366]/20 to-[#128C7E]/20 border border-[#25D366]/30 text-[14px] font-bold text-[#4ade80] active:scale-[0.99] transition-transform">
            <MessageCircle size={18} /> WhatsApp par repair book karein — bhejo, hum check karein
          </a>

          {/* Bottom bar */}
          <div className="mt-8 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[12px] text-slate-600">© {new Date().getFullYear()} {SITE.name} · Made in Jabalpur</p>
            <div className="flex items-center gap-4">
              <button onClick={() => setQrOpen(true)} className="flex items-center gap-1.5 text-[12px] font-bold text-slate-500 hover:text-cyan-400 transition-colors">
                <QrCode size={13} /> Scan / Share
              </button>
              <Link href="/login" className="text-[12px] font-bold text-slate-500 hover:text-blue-400 transition-colors">
                Staff Login →
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Scan & Share QR modal */}
      <QrShareModal open={qrOpen} onClose={() => setQrOpen(false)} />
    </div>
  );
}
