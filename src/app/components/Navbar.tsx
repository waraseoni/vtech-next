"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", icon: "🏠", label: "Home" },
  { href: "/about", icon: "ℹ️", label: "About" },
  { href: "/job-status", icon: "🔍", label: "Job Status" },
  { href: "/contact", icon: "📞", label: "Contact" },
  { href: "/login", icon: "🔐", label: "Login" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMenuOpen(false);
  }

  return (
    <>
      <nav style={{
        background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
        padding: "0.5rem 0",
        minHeight: "60px",
        zIndex: 1030,
        transition: "all 0.3s ease",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
      }}>
        {/* ══ DESKTOP LAYOUT ═══════════════════════════════════════════ */}
        {!isMobile && (
          <div style={{ display: "flex", alignItems: "center", maxWidth: "1200px", margin: "0 auto", padding: "0 1rem" }}>
            {/* Logo (Left) */}
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: "8px", marginRight: "2rem", textDecoration: "none" }}>
              <div style={{ width: "32px", height: "32px", background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, color: "white" }}>
                VT
              </div>
              <span style={{ fontSize: "1.3rem", fontWeight: 700, color: "white" }}>V-<span style={{ color: "#3b82f6" }}>Tech</span></span>
            </Link>

            {/* Menu (Center) */}
            <div style={{ flex: 1 }}>
              <ul style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.3rem", listStyle: "none", margin: 0, padding: 0 }}>
                {NAV_ITEMS.filter(i => i.href !== "/login").map(item => (
                  <li key={item.href}>
                    <Link href={item.href} style={{
                      fontSize: "0.85rem", fontWeight: 500, padding: "0.5rem 0.7rem",
                      borderRadius: "6px", textAlign: "center", minWidth: "65px",
                      transition: "all 0.2s ease", display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                      color: pathname === item.href ? "#3b82f6" : "rgba(255,255,255,0.85)",
                      textDecoration: "none",
                      background: pathname === item.href ? "rgba(59,130,246,0.15)" : "transparent",
                    }}>
                      <span style={{ fontSize: "1rem", marginBottom: "2px" }}>{item.icon}</span>
                      <span style={{ fontSize: "0.7rem", lineHeight: 1 }}>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Actions (Right) */}
            <div style={{ display: "flex", alignItems: "center", marginLeft: "1rem" }}>
              <a href="tel:+919179105875" style={{
                background: "#3b82f6", color: "white", padding: "0.3rem 0.8rem",
                borderRadius: "20px", fontSize: "0.8rem", fontWeight: 600,
                border: "none", textDecoration: "none", marginRight: "8px",
              }}>
                📞 Call
              </a>
              <Link href="/login" style={{
                background: "rgba(255,255,255,0.1)", color: "white", padding: "0.3rem 0.8rem",
                borderRadius: "20px", fontSize: "0.8rem", border: "1px solid rgba(255,255,255,0.2)",
                textDecoration: "none",
              }}>
                🔐 Login
              </Link>
            </div>
          </div>
        )}

        {/* ══ MOBILE LAYOUT ════════════════════════════════════════════ */}
        {isMobile && (
          <div style={{ position: "relative", height: "60px", display: "flex", alignItems: "center" }}>
          {/* Left: Call */}
          <div style={{ position: "absolute", left: "15px", zIndex: 2 }}>
            <a href="tel:+919179105875" style={{
              background: "#3b82f6", color: "white", padding: "0.4rem 0.8rem",
              borderRadius: "20px", fontSize: "0.8rem", fontWeight: 600, textDecoration: "none",
            }}>📞</a>
          </div>

          {/* Center: Logo */}
          <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", zIndex: 1 }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: "5px", textDecoration: "none" }}>
              <div style={{ width: "32px", height: "32px", background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, color: "white" }}>
                VT
              </div>
              <span style={{ fontSize: "1.3rem", fontWeight: 700, color: "white" }}>V-<span style={{ color: "#3b82f6" }}>Tech</span></span>
            </Link>
          </div>

          {/* Right: Menu Toggle */}
          <div style={{ position: "absolute", right: "15px", zIndex: 2 }}>
            <button onClick={() => setMenuOpen(!menuOpen)} style={{
              border: "1px solid rgba(255,255,255,0.3)", padding: "0.4rem 0.6rem",
              borderRadius: "6px", background: "rgba(0,0,0,0.2)", cursor: "pointer", color: "white",
            }}>
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>
        )}

        {/* ══ MOBILE MENU (Full Screen) ═══════════════════════════════ */}
        {isMobile && menuOpen && (
          <div className="lg:hidden" style={{
            position: "fixed", top: "60px", left: 0, right: 0, bottom: 0,
            background: "rgba(15, 15, 26, 0.98)", backdropFilter: "blur(10px)",
            zIndex: 1025, overflowY: "auto", padding: "1rem",
            borderTop: "1px solid rgba(255,255,255,0.1)",
          }}>
            {NAV_ITEMS.map(item => (
              <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} style={{
                display: "flex", alignItems: "center", padding: "0.75rem",
                borderBottom: "1px solid rgba(255,255,255,0.1)", textDecoration: "none",
                color: pathname === item.href ? "#3b82f6" : "white",
                background: pathname === item.href ? "rgba(59,130,246,0.2)" : "transparent",
              }}>
                <div style={{
                  width: "40px", height: "40px", background: "rgba(59,130,246,0.15)",
                  borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center",
                  marginRight: "12px", fontSize: "1.2rem",
                }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: "1.1rem" }}>{item.label}</div>
                </div>
              </Link>
            ))}

            {/* Mobile Actions */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
              <a href="tel:+919179105875" style={{
                background: "#3b82f6", color: "white", padding: "10px", borderRadius: "10px",
                fontWeight: 600, textDecoration: "none", textAlign: "center", fontSize: "0.95rem",
              }}>📞 Call Now</a>
              <a href="https://wa.me/919179105875" target="_blank" rel="noopener" style={{
                background: "#25D366", color: "white", padding: "10px", borderRadius: "10px",
                fontWeight: 600, textDecoration: "none", textAlign: "center", fontSize: "0.95rem",
              }}>💬 WhatsApp</a>
            </div>
          </div>
        )}
      </nav>

      {/* Spacer for fixed navbar */}
      <div style={{ height: "60px" }}></div>
    </>
  );
}
