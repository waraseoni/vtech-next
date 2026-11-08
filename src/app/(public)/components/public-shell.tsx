"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Phone,
  Menu,
  X,
  ChevronDown,
  Zap,
  MessageCircle,
  MapPin,
  Mail,
  Clock,
  LogIn,
  QrCode,
  LayoutDashboard,
  Megaphone,
  Navigation,
} from "lucide-react";
import { getCachedUser } from "@/lib/supabase";
import dynamic from "next/dynamic";
import {
  buildDirectionsLink,
  buildLocationShareText,
  buildMapLink,
  buildWhatsAppLink,
  getBusinessOpenState,
  getServiceList,
  type BusinessOpenState,
  type PublicSiteContent,
} from "@/lib/public-site-defaults";
import { LocationShare } from "./location-share";
import { PublicContentProvider } from "./public-content-provider";

// PERF (lightning A1): qrcode lib (~110KB gz) sirf QR button click par chahiye —
// static import se har public route (/, /about, /contact, /job-status) wo load
// karta tha. Dynamic chunk = initial JS se bahar.
const QrShareModal = dynamic(() => import("./qr-share").then((m) => m.QrShareModal), {
  ssr: false,
  loading: () => null,
});

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/job-status", label: "Track Repair" },
  { href: "/contact", label: "Contact" },
];

function AuthAwareAction({ mobile = false }: { mobile?: boolean }) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCachedUser()
      .then(({ data }) => {
        if (!cancelled) setLoggedIn(!!data.user);
      })
      .catch(() => {
        if (!cancelled) setLoggedIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const is = loggedIn === true;
  const href = is ? "/dashboard" : "/login";
  const label = is ? "Dashboard" : "Login";
  const Icon = is ? LayoutDashboard : LogIn;

  if (mobile) {
    return (
      <Link
        href={href}
        className={`mt-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-bold active:scale-95 transition-transform ${
          is
            ? "bg-emerald-500/15 border border-emerald-500/25 text-emerald-300"
            : "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-600/25"
        }`}
      >
        <Icon size={16} /> {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold transition-all active:scale-95 ${
        is
          ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25"
          : "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-600/25"
      }`}
    >
      <Icon size={14} /> {label}
    </Link>
  );
}

export function PublicShell({
  content,
  children,
}: {
  content: PublicSiteContent;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const [openState, setOpenState] = useState<BusinessOpenState | null>(null);

  const services = getServiceList(content);
  const { brand, contact, footer } = content;
  const whatsappHref = buildWhatsAppLink(content);
  const mapHref = buildMapLink(content);
  const directionsHref = buildDirectionsLink(content);
  const locationShareText = buildLocationShareText(content);
  const routeHref = directionsHref || mapHref;
  const announcement = contact.announcement.trim();

  // First-run auto-redirect: naya client deployment (abhi koi admin nahi bana)
  // → /setup par bhej do. Admin bante hi needsSetup=false ho jata hai.
  useEffect(() => {
    if (pathname === "/setup") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/setup/status", { cache: "no-store" });
        const data = await res.json();
        if (cancelled || !res.ok) return;
        if (data.needsSetup && !data.loggedIn) router.replace("/setup");
      } catch {
        /* network fail — redirect skip (site phir bhi render ho jayegi) */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Dismiss session tak yaad rehta hai; text badle to banner dobara dikhta hai.
  useEffect(() => {
    if (!announcement) return;
    try {
      setAnnouncementDismissed(
        sessionStorage.getItem("vtech_announcement_dismissed") === announcement
      );
    } catch {
      /* private mode — banner dismiss memory ke bharose */
    }
  }, [announcement]);

  const dismissAnnouncement = () => {
    setAnnouncementDismissed(true);
    try {
      sessionStorage.setItem("vtech_announcement_dismissed", announcement);
    } catch {
      /* ignore */
    }
  };

  // Open/closed badge visitor ke local time se — mount ke baad hi render,
  // warna server/client time mismatch se hydration warn aata hai.
  useEffect(() => {
    const update = () => setOpenState(getBusinessOpenState(content));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [content]);

  // Route change → close menu (rAF callback ke andar setState).
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
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const linkCls = (href: string, exact = false) => {
    const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
    return `relative text-[13px] font-semibold transition-colors ${
      active ? "text-white" : "text-muted hover:text-white"
    }`;
  };

  return (
    <PublicContentProvider content={content}>
      <div className="min-h-screen bg-app text-white overflow-x-hidden">
        <a href="#main-content" className="skip-to-content">
          Skip to content
        </a>
        {/* ─── NAVBAR ─────────────────────────────────────────────────────── */}
        <header
          className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ${
            scrolled || menuOpen
              ? "bg-app/90 backdrop-blur-xl border-white/[0.06]"
              : "bg-app/40 backdrop-blur-md border-transparent"
          }`}
        >
          <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between gap-3">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2.5 min-w-0"
              onClick={() => setMenuOpen(false)}
            >
              <div className="w-9 h-9 shrink-0 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Zap size={18} className="text-white" fill="currentColor" />
              </div>
              <span className="font-display text-[15px] font-bold tracking-tight leading-none truncate">
                {brand.name}
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/" className={linkCls("/", true)}>
                Home
              </Link>

              {services.length > 0 && (
                <div className="relative group">
                  <button
                    className={`flex items-center gap-1 text-[13px] font-semibold transition-colors ${
                      services.some((service) => pathname.startsWith(service.href))
                        ? "text-white"
                        : "text-muted group-hover:text-white"
                    }`}
                  >
                    Services
                    <ChevronDown
                      size={13}
                      className="mt-0.5 transition-transform group-hover:rotate-180"
                    />
                  </button>
                  <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-200">
                    <div className="w-72 rounded-2xl border border-white/10 bg-[#0b0b1a]/95 backdrop-blur-xl p-2 shadow-2xl shadow-black/60">
                      {services.map((service) => (
                        <Link
                          key={service.href}
                          href={service.href}
                          className={`flex items-start gap-3 px-3 py-3 rounded-xl transition-colors ${
                            pathname.startsWith(service.href)
                              ? "bg-blue-500/10"
                              : "hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className="w-8 h-8 shrink-0 bg-blue-500/15 rounded-lg flex items-center justify-center">
                            <Zap size={14} className="text-blue-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white">{service.label}</p>
                            <p className="text-[11px] text-muted mt-0.5 line-clamp-1">
                              {service.desc}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <Link href="/job-status" className={linkCls("/job-status")}>
                Track Repair
              </Link>
              <Link href="/about" className={linkCls("/about")}>
                About
              </Link>
              <Link href="/contact" className={linkCls("/contact")}>
                Contact
              </Link>
            </nav>

            {/* Desktop actions */}
            <div className="hidden md:flex items-center gap-2">
              {openState?.known && (
                <span
                  className={`hidden lg:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                    openState.open
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-white/10 bg-white/[0.04] text-muted"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${
                      openState.open ? "bg-emerald-400" : "bg-muted-2"
                    }`}
                  />
                  {openState.label}
                </span>
              )}
              <button
                onClick={() => setQrOpen(true)}
                aria-label="Scan and share website QR"
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-[13px] font-bold hover:bg-white/[0.1] transition-colors"
              >
                <QrCode size={15} className="text-cyan-400" />
                <span className="hidden lg:inline">QR</span>
              </button>
              <a
                href={contact.phoneHref}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-[13px] font-bold hover:bg-white/[0.1] transition-colors"
              >
                <Phone size={14} className="text-emerald-400" />
                Call Now
              </a>
              <AuthAwareAction />
            </div>

            {/* Mobile actions */}
            <div className="flex md:hidden items-center gap-1.5">
              <button
                onClick={() => setQrOpen(true)}
                aria-label="Scan and share website QR"
                className="tap-target w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.06] border border-white/10 text-cyan-400 active:scale-95 transition-transform"
              >
                <QrCode size={18} />
              </button>
              <a
                href={contact.phoneHref}
                aria-label="Call us"
                className="tap-target w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 active:scale-95 transition-transform"
              >
                <Phone size={18} />
              </a>
              <button
                onClick={() => setMenuOpen((value) => !value)}
                aria-label="Toggle menu"
                className="tap-target w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.06] border border-white/10 active:scale-95 transition-transform"
              >
                {menuOpen ? <X size={19} /> : <Menu size={19} />}
              </button>
            </div>
          </div>
        </header>

        {/* ─── MOBILE MENU (full-screen sheet) ────────────────────────────── */}
        {menuOpen && (
          <div className="md:hidden fixed inset-0 top-14 z-40 bg-app/98 backdrop-blur-xl overflow-y-auto anim-fade">
            <nav className="px-4 pt-3 pb-8 flex flex-col gap-1">
              <Link
                href="/"
                className="flex items-center gap-3 px-4 py-4 rounded-xl bg-white/[0.04] text-[15px] font-bold active:bg-white/[0.08]"
              >
                <Zap size={17} className="text-blue-400" /> Home
              </Link>

              {services.length > 0 && (
                <div className="rounded-xl bg-white/[0.04]">
                  <button
                    onClick={() => setServicesOpen((value) => !value)}
                    className="w-full flex items-center justify-between px-4 py-4 text-[15px] font-bold active:bg-white/[0.08] rounded-xl"
                  >
                    <span className="flex items-center gap-3">
                      <Zap size={17} className="text-cyan-400" /> Services
                    </span>
                    <ChevronDown
                      size={16}
                      className={`text-muted transition-transform duration-200 ${
                        servicesOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {servicesOpen && (
                    <div className="px-3 pb-3 space-y-1">
                      {services.map((service) => (
                        <Link
                          key={service.href}
                          href={service.href}
                          className={`flex items-start gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                            pathname.startsWith(service.href)
                              ? "bg-blue-500/15 text-blue-300"
                              : "text-app-2 active:bg-white/[0.06]"
                          }`}
                        >
                          <div className="w-7 h-7 shrink-0 bg-blue-500/15 rounded-lg flex items-center justify-center mt-0.5">
                            <Zap size={13} className="text-blue-400" />
                          </div>
                          <div>
                            <p className="font-bold text-[14px]">{service.label}</p>
                            <p className="text-[11px] text-muted mt-0.5">{service.desc}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {NAV_LINKS.filter((link) => link.href !== "/").map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 px-4 py-4 rounded-xl bg-white/[0.04] text-[15px] font-bold active:bg-white/[0.08]"
                >
                  {link.label}
                </Link>
              ))}

              <button
                onClick={() => {
                  setMenuOpen(false);
                  setQrOpen(true);
                }}
                className="flex items-center gap-3 px-4 py-4 rounded-xl bg-white/[0.04] text-[15px] font-bold active:bg-white/[0.08]"
              >
                <QrCode size={17} className="text-cyan-400" /> Website QR — Scan &amp; Share
              </button>

              {/* Actions */}
              {openState?.known && (
                <p
                  className={`mt-4 flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-bold ${
                    openState.open
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-white/10 bg-white/[0.04] text-muted"
                  }`}
                >
                  <Clock size={13} /> {openState.label} · {contact.businessHours}
                </p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <a
                  href={contact.phoneHref}
                  className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-sm font-bold active:scale-95 transition-transform"
                >
                  <Phone size={16} /> Call Now
                </a>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-[#25D366]/15 border border-[#25D366]/25 text-[#4ade80] text-sm font-bold active:scale-95 transition-transform"
                >
                  <MessageCircle size={16} /> WhatsApp
                </a>
              </div>
              <AuthAwareAction mobile />
            </nav>
          </div>
        )}

        {/* Content */}
        <main id="main-content" className="pt-14">
          {announcement && !announcementDismissed && (
            <div className="border-b border-cyan-500/20 bg-gradient-to-r from-blue-600/15 via-cyan-600/10 to-blue-600/15">
              <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
                <Megaphone size={14} className="shrink-0 text-cyan-400" />
                <p className="min-w-0 flex-1 text-[12px] font-semibold text-app-2">
                  {announcement}
                </p>
                <button
                  onClick={dismissAnnouncement}
                  aria-label="Announcement band karein"
                  className="shrink-0 rounded-lg p-1 text-muted hover:bg-white/[0.06] hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
          {children}
        </main>

        {/* ─── FOOTER ─────────────────────────────────────────────────────── */}
        <footer className="border-t border-white/[0.06] bg-app">
          <div className="mx-auto max-w-7xl px-4 py-10 pb-24 md:pb-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Brand */}
              <div className="sm:col-span-2 lg:col-span-1">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                    <Zap size={18} className="text-white" fill="currentColor" />
                  </div>
                  <span className="font-display text-[15px] font-bold">{brand.name}</span>
                </div>
                <p className="text-[13px] text-muted leading-relaxed">{footer.tagline}</p>
              </div>

              {/* Quick links */}
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-widest text-muted mb-3">
                  Quick Links
                </h4>
                <ul className="space-y-2.5">
                  <li>
                    <Link
                      href="/"
                      className="text-[13px] text-muted hover:text-white transition-colors"
                    >
                      Home
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/job-status"
                      className="text-[13px] text-muted hover:text-white transition-colors"
                    >
                      Track Your Repair
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/about"
                      className="text-[13px] text-muted hover:text-white transition-colors"
                    >
                      About Us
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/#faq"
                      className="text-[13px] text-muted hover:text-white transition-colors"
                    >
                      FAQ
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/contact"
                      className="text-[13px] text-muted hover:text-white transition-colors"
                    >
                      Contact / Inquiry
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Services */}
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-widest text-muted mb-3">
                  Our Services
                </h4>
                <ul className="space-y-2.5">
                  {services.map((service) => (
                    <li key={service.href}>
                      <Link
                        href={service.href}
                        className="text-[13px] text-muted hover:text-white transition-colors"
                      >
                        {service.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Contact */}
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-widest text-muted mb-3">
                  Contact Us
                </h4>
                <ul className="space-y-3">
                  <li>
                    <a
                      href={contact.phoneHref}
                      className="flex items-start gap-2.5 text-[13px] text-muted hover:text-white transition-colors"
                    >
                      <Phone size={15} className="mt-0.5 shrink-0 text-emerald-400" />{" "}
                      {contact.phone}
                    </a>
                  </li>
                  <li>
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-start gap-2.5 text-[13px] text-muted hover:text-white transition-colors"
                    >
                      <Mail size={15} className="mt-0.5 shrink-0 text-blue-400" /> {contact.email}
                    </a>
                  </li>
                  <li className="flex items-start gap-2.5 text-[13px] text-muted">
                    <MapPin size={15} className="mt-0.5 shrink-0 text-cyan-400" /> {contact.address}
                  </li>
                  {routeHref && (
                    <li className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <a
                        href={routeHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2.5 text-[13px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        <Navigation size={15} className="mt-0.5 shrink-0" /> Directions / Map
                      </a>
                      <LocationShare
                        shareText={locationShareText}
                        directionsHref={directionsHref}
                        mapHref={mapHref}
                        label="Share location"
                        className="flex items-center gap-1.5 text-[13px] font-bold text-blue-300 hover:text-blue-200 transition-colors"
                      />
                    </li>
                  )}
                  <li className="flex items-start gap-2.5 text-[13px] text-muted">
                    <Clock size={15} className="mt-0.5 shrink-0 text-amber-400" />{" "}
                    {contact.businessHours}
                  </li>
                </ul>
              </div>
            </div>

            {/* WhatsApp CTA */}
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 flex items-center justify-center gap-2.5 px-4 py-4 rounded-2xl bg-gradient-to-r from-[#25D366]/20 to-[#128C7E]/20 border border-[#25D366]/30 text-[14px] font-bold text-[#4ade80] active:scale-[0.99] transition-transform"
            >
              <MessageCircle size={18} /> {footer.whatsappCta}
            </a>

            {/* Bottom bar */}
            <div className="mt-8 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-[12px] text-muted-2">{footer.copyrightText}</p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                {footer.legalLinks.map((link) =>
                  /^https?:\/\//i.test(link.href) ? (
                    <a
                      key={`${link.label}-${link.href}`}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] font-bold text-muted hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      key={`${link.label}-${link.href}`}
                      href={link.href}
                      className="text-[12px] font-bold text-muted hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  )
                )}
                <button
                  onClick={() => setQrOpen(true)}
                  className="flex items-center gap-1.5 text-[12px] font-bold text-muted hover:text-cyan-400 transition-colors"
                >
                  <QrCode size={13} /> Scan / Share
                </button>
                <Link
                  href="/login"
                  className="text-[12px] font-bold text-muted hover:text-blue-400 transition-colors"
                >
                  Staff Login →
                </Link>
              </div>
            </div>
          </div>
        </footer>

        {/* ─── DESKTOP WHATSAPP FAB ──────────────────────────────────────── */}
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp par message karein"
            className="fixed bottom-5 right-4 z-40 hidden md:flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-2xl shadow-black/40 active:scale-90 transition-transform"
          >
            <MessageCircle size={26} className="text-app" />
          </a>
        )}

        {/* ─── MOBILE STICKY ACTIONS ─────────────────────────────────────── */}
        <nav
          aria-label="Quick contact actions"
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-white/10 bg-app/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        >
          <a
            href={contact.phoneHref}
            className="flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-bold text-emerald-300 active:bg-white/[0.06]"
          >
            <Phone size={18} /> Call
          </a>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-14 flex-col items-center justify-center gap-1 border-x border-white/[0.08] text-[11px] font-bold text-[#4ade80] active:bg-white/[0.06]"
          >
            <MessageCircle size={18} /> WhatsApp
          </a>
          {routeHref ? (
            <a
              href={routeHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-bold text-cyan-300 active:bg-white/[0.06]"
            >
              <Navigation size={18} /> Directions
            </a>
          ) : (
            <Link
              href="/contact"
              className="flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-bold text-cyan-300 active:bg-white/[0.06]"
            >
              <MapPin size={18} /> Contact
            </Link>
          )}
        </nav>

        {/* Scan & Share QR modal */}
        {qrOpen && <QrShareModal open={qrOpen} onClose={() => setQrOpen(false)} />}
      </div>
    </PublicContentProvider>
  );
}
