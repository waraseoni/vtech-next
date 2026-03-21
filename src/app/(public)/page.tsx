"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

// ── Auto-redirect to dashboard if logged in ────────────────────────────────
export default function HomePage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { window.location.href = "/dashboard"; return; }
      setReady(true);
    });
  }, []);

  if (!ready) return (
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-slate-600"/>
    </div>
  );

  return <HomePageContent />;
}

function HomePageContent() {
  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">

      {/* ══ HERO (exact match PHP home.php) ════════════════════════════════ */}
      <section className="relative" style={{
        background: "linear-gradient(rgba(15,15,26,0.92), rgba(15,15,26,0.95))",
        minHeight: "calc(100vh - 60px)",
        display: "flex",
        alignItems: "center",
        textAlign: "center",
      }}>
        <div className="container mx-auto px-4">
          <h1 style={{ fontSize: "3.5rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "20px" }}>
            Expert Stage Lighting &amp;<br/>Power Supply Repair Center
          </h1>
          <p style={{ fontSize: "1.2rem", maxWidth: "900px", margin: "0 auto 40px", lineHeight: 1.6, color: "#94a3b8" }}>
            SMPS | Sharpy | Moving Head | Par Lights | DMX | Laser | LED Wall | Fog Machine<br/>
            Fast Repair • Genuine Parts • Same Day Service
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="tel:9179105875" style={{
              background: "#3b82f6", color: "white", padding: "16px 40px",
              fontSize: "1.1rem", border: "none", borderRadius: "50px",
              textDecoration: "none", fontWeight: 600,
            }}>Call +91 917910 5875</a>
            <a href="https://wa.me/9179105875" target="_blank" rel="noopener" style={{
              background: "#25d366", color: "white", padding: "16px 40px",
              fontSize: "1.1rem", border: "none", borderRadius: "50px",
              textDecoration: "none", fontWeight: 600,
            }}>WhatsApp Us</a>
          </div>
        </div>
      </section>

      {/* ══ SERVICES (8 cards exact match PHP) ═════════════════════════════ */}
      <section className="py-20" style={{ background: "#0f0f1a", color: "white" }}>
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-center mb-12" style={{ fontSize: "2.5rem", fontWeight: 700 }}>
            Our Professional <span style={{ color: "#3b82f6" }}>Repair Services</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: "⚡", title: "SMPS & Power Supply", desc: "All types of Switch Mode Power Supply Repair" },
              { icon: "💡", title: "Sharpy & Moving Head", desc: "Beam, Color Wheel, Gobo, Motor Repair" },
              { icon: "🎤", title: "Par Light & LED Par", desc: "RGBW, Driver Board, LED Replacement" },
              { icon: "🎛️", title: "DMX Controller & Console", desc: "DMX 512, Motherboard, Touch Screen Repair" },
              { icon: "🌫️", title: "Fog & Smoke Machine", desc: "Pump, Heating Element, PCB Repair" },
              { icon: "📺", title: "LED Wall & Processor", desc: "Module, Receiving Card, Power Supply Fix" },
              { icon: "🔦", title: "Laser Light Repair", desc: "Galvo, Driver, Diode Replacement" },
              { icon: "🛠️", title: "All Stage Equipment", desc: "Strobe, Follow Spot, Effect Lights etc." },
            ].map((s, i) => (
              <div key={i} className="text-center p-5 rounded-xl border border-[#333] hover:border-[#3b82f6] transition-all"
                style={{ background: "#1a1a2e" }}>
                <div className="text-3xl mb-3">{s.icon}</div>
                <h4 className="text-sm font-bold mb-2">{s.title}</h4>
                <p className="text-xs" style={{ color: "#94a3b8" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ WHY CHOOSE US (exact match PHP) ════════════════════════════════ */}
      <section className="py-20" style={{ background: "#16213e", color: "white" }}>
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-center mb-12" style={{ fontSize: "2.5rem", fontWeight: 700 }}>
            Why Choose <span style={{ color: "#3b82f6" }}>V-Technologies</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            {[
              { icon: "⚡", title: "Express Repair", desc: "Most jobs done same day" },
              { icon: "⚙️", title: "Genuine Parts", desc: "100% original spares used" },
              { icon: "💰", title: "Best Rates", desc: "Transparent & fair pricing" },
            ].map((f, i) => (
              <div key={i}>
                <div className="text-3xl mb-3" style={{ color: "#3b82f6" }}>{f.icon}</div>
                <h4 style={{ fontSize: "1.3rem", marginBottom: "10px" }}>{f.title}</h4>
                <p style={{ color: "#94a3b8" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CONTACT BAR (exact match PHP) ═══════════════════════════════ */}
      <section className="py-16 text-center" style={{
        background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", color: "white"
      }}>
        <div className="max-w-3xl mx-auto px-4">
          <h2 style={{ fontSize: "2.2rem", marginBottom: "1.5rem" }}>Need Urgent Repair? Contact Us Now!</h2>
          <p style={{ fontSize: "1.2rem", margin: "20px 0" }}>
            📞 +91 91791 05875<br/>
            💬 WhatsApp: +91 91791 05875<br/>
            📍 Vikram Jain V-Technologies, F4, Madhushala, Marhatal, Jabalpur, 482002
          </p>
          <a href="tel:+919179105875" style={{
            background: "white", color: "#3b82f6", padding: "16px 40px",
            fontSize: "1.1rem", border: "none", borderRadius: "50px",
            textDecoration: "none", fontWeight: 600, display: "inline-block",
          }}>Call Now</a>
        </div>
      </section>

      {/* ══ FOOTER ══════════════════════════════════════════════════════ */}
      <footer className="py-8 text-center" style={{ background: "#0f0f1a" }}>
        <p className="text-xs" style={{ color: "#94a3b8" }}>
          © {new Date().getFullYear()} V-Technologies. Made with ❤️ in Jabalpur
        </p>
        <Link href="/login" className="text-xs mt-2 inline-block" style={{ color: "#3b82f6" }}>
          Staff Login →
        </Link>
      </footer>

      {/* ══ FLOATING BUTTONS (exact match PHP) ══════════════════════════ */}
      <div style={{ position: "fixed", bottom: "20px", right: "20px", zIndex: 9999, display: "flex", flexDirection: "column", gap: "15px" }}>
        <a href="tel:+919179105875" style={{
          background: "#3b82f6", width: "60px", height: "60px", borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "24px", color: "white", boxShadow: "0 8px 25px rgba(0,0,0,0.4)",
          textDecoration: "none",
        }}>📞</a>
        <a href="https://wa.me/+919179105875" target="_blank" rel="noopener" style={{
          background: "#25d366", width: "60px", height: "60px", borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "24px", color: "white", boxShadow: "0 8px 25px rgba(0,0,0,0.4)",
          textDecoration: "none",
        }}>💬</a>
      </div>

    </div>
  );
}
