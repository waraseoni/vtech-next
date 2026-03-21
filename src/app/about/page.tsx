"use client";

import Link from "next/link";
import Navbar from "../components/Navbar";

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[#0f0f1a] text-white">

      {/* ══ HERO (exact match PHP about.php) ═══════════════════════════════ */}
      <section className="text-center mb-5" style={{
        background: "linear-gradient(135deg, rgba(59,130,246,0.95), rgba(29,78,216,0.9))",
        borderRadius: "20px", padding: "100px 20px", margin: "20px", boxShadow: "0 15px 35px rgba(0,0,0,0.3)"
      }}>
        <h1 style={{ fontSize: "3.5rem", fontWeight: 700, textShadow: "0 5px 15px rgba(0,0,0,0.5)", marginBottom: "20px" }}>
          V-Technologies
        </h1>
        <p style={{ fontSize: "1.5rem", fontWeight: 500, maxWidth: "800px", margin: "0 auto 1rem" }}>
          Jabalpur&apos;s Most Trusted SMPS • DJ • Lighting • LED Wall Repair Experts
        </p>
        <p style={{ fontSize: "1.3rem", fontWeight: 600, marginTop: "1rem" }}>
          17+ Years | 27,000+ Repairs | 24×7 Emergency Service
        </p>
        <a href="tel:+919179105875" style={{
          background: "white", color: "#3b82f6", borderRadius: "50px",
          fontWeight: 600, fontSize: "1.2rem", padding: "12px 30px",
          textDecoration: "none", display: "inline-block", marginTop: "1.5rem",
        }}>
          📞 Call Now: 91791 05875
        </a>
      </section>

      {/* ══ OUR STORY (exact match PHP) ═══════════════════════════════════ */}
      <section className="py-10 px-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div style={{ color: "#cbd5e1" }}>
            <h2 className="mb-4" style={{ fontSize: "2rem", fontWeight: 700, color: "white" }}>
              From One Table to Jabalpur&apos;s Biggest Repair Hub
            </h2>
            <p style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>
              Hi, I&apos;m <strong style={{ color: "#3b82f6" }}>Vikram Jain</strong>. In 2007, I started this journey with just one small table, a few tools, and a burning passion to fix things.
            </p>
            <p style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>
              Today, we&apos;re proud to be the <strong style={{ color: "#3b82f6" }}>largest and most trusted</strong> repair center for DJ systems, moving heads, laser lights, LED walls, processors, and SMPS in Central India.
            </p>
            <p style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>
              Whether it&apos;s a wedding emergency at 2 AM or a massive event tomorrow – <strong style={{ color: "#3b82f6" }}>we never say no</strong>.
            </p>
            <div style={{ background: "rgba(59,130,246,0.1)", borderLeft: "4px solid #3b82f6", borderRadius: "10px", padding: "1rem", marginTop: "1rem" }}>
              <p className="font-bold text-lg" style={{ color: "white", margin: 0 }}>
                Your trust is our biggest reward. Your smile when your equipment works perfectly – that&apos;s why we do this.
              </p>
            </div>
          </div>

          <div className="text-center">
            <div style={{ background: "#1a1a2e", borderRadius: "20px", padding: "2rem", border: "1px solid rgba(59,130,246,0.2)" }}>
              <div className="grid grid-cols-3 gap-4 mb-6 text-center">
                <div>
                  <h3 style={{ color: "#3b82f6", fontSize: "2.5rem", fontWeight: 700 }}>27,000+</h3>
                  <p style={{ color: "#94a3b8" }}>Repairs Completed</p>
                </div>
                <div>
                  <h3 style={{ color: "#3b82f6", fontSize: "2.5rem", fontWeight: 700 }}>17+</h3>
                  <p style={{ color: "#94a3b8" }}>Years of Trust</p>
                </div>
                <div>
                  <h3 style={{ color: "#3b82f6", fontSize: "2.5rem", fontWeight: 700 }}>5,000+</h3>
                  <p style={{ color: "#94a3b8" }}>Happy Clients</p>
                </div>
              </div>
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center mx-auto text-2xl font-black">
                VT
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ WHY CHOOSE US (3 feature cards) ═══════════════════════════════ */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-center mb-10" style={{ color: "white", fontSize: "2.2rem" }}>
            Why <span style={{ color: "#3b82f6" }}>5000+ Clients</span> Choose Us
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: "⚡", title: "Lightning Fast Repairs", desc: "90% jobs done in 24 hours. Emergency? We fix in 2-6 hours!" },
              { icon: "🏆", title: "17 Years of Mastery", desc: "From basic SMPS to high-end LED wall processors – we've seen and fixed it all." },
              { icon: "🛡️", title: "100% Transparent", desc: "Original parts. No hidden charges. You see everything." },
            ].map((f, i) => (
              <div key={i} className="text-center p-6" style={{ background: "#1a1a2e", borderRadius: "15px" }}>
                <div style={{ width: "90px", height: "90px", background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "2.5rem", color: "white" }}>
                  {f.icon}
                </div>
                <h4 style={{ color: "white", marginBottom: "1rem" }}>{f.title}</h4>
                <p style={{ color: "#94a3b8" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TEAM (3 members) ═════════════════════════════════════════════ */}
      <section className="py-16 px-4" style={{ background: "#0a0f1a" }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-center mb-10" style={{ color: "white", fontSize: "2.2rem" }}>
            The Faces Behind <span style={{ color: "#3b82f6" }}>Your Trust</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { name: "Vikram Jain", role: "Founder & Master Technician", quote: "Every broken equipment has a story. I just help it work again." },
              { name: "Preeti Jain", role: "Customer Happiness Manager", quote: "Your smile when you pick up your repaired item – that's my biggest reward." },
              { name: "Hemant Mehra", role: "Head Technician", quote: "From dead circuits to perfect beats – I bring machines back to life." },
            ].map((m, i) => (
              <div key={i} style={{ background: "#1a1a2e", borderRadius: "20px", overflow: "hidden", textAlign: "center" }}>
                <div style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(29,78,216,0.1))", padding: "1.5rem" }}>
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto text-2xl font-black">
                    {m.name.split(" ").map(n => n[0]).join("")}
                  </div>
                </div>
                <div className="p-4">
                  <h5 style={{ color: "white", marginBottom: "0.25rem" }}>{m.name}</h5>
                  <p className="text-sm mb-2" style={{ color: "#3b82f6", fontWeight: 600 }}>{m.role}</p>
                  <p className="text-xs" style={{ color: "#94a3b8" }}>{m.quote}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TESTIMONIALS ════════════════════════════════════════════════ */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-center mb-10" style={{ color: "white", fontSize: "2.2rem" }}>
            What Our <span style={{ color: "#3b82f6" }}>Clients Say</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { quote: "2 AM pe DJ kharab ho gaya tha – Vikram bhai 3 ghante mein fix kar ke de gaye. Life saver!", name: "Rohit DJ, Jabalpur" },
              { quote: "LED wall ka processor jal gaya tha – market mein 15 din bol rahe the. Yahan 18 ghante mein ho gaya!", name: "Shubham Events" },
            ].map((t, i) => (
              <div key={i} style={{ background: "#1a1a2e", borderRadius: "15px", padding: "1.5rem", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ color: "#ffc107", fontSize: "1.5rem", marginBottom: "0.75rem" }}>★★★★★</div>
                <p style={{ color: "#cbd5e1", fontSize: "1.1rem", marginBottom: "0.75rem" }}>{t.quote}</p>
                <p className="font-bold" style={{ color: "white" }}>- {t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CONTACT ═════════════════════════════════════════════════════ */}
      <section className="py-16 px-4" style={{ background: "#0a0f1a" }}>
        <div className="max-w-4xl mx-auto" style={{ background: "#1a1a2e", borderRadius: "20px", padding: "2rem", border: "1px solid rgba(59,130,246,0.2)" }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 style={{ color: "white", marginBottom: "1rem" }}>📍 Visit Our Workshop</h4>
              <p style={{ color: "#94a3b8", marginBottom: "1rem" }}>
                F4 Hotel Plaza (Now Madhushala), Besides Jayanti Complex,<br/>Marhatal, Jabalpur, 482002, Madhya Pradesh
              </p>
              <h5 style={{ color: "white", marginBottom: "0.5rem" }}>📞 Contact</h5>
              <a href="tel:+919179105875" style={{ color: "#25D366", textDecoration: "none" }}>+91 91791 05875</a>
            </div>
            <div>
              <h4 style={{ color: "white", marginBottom: "1rem" }}>🌐 Connect With Us</h4>
              <div className="flex gap-4 mt-2">
                <a href="#" className="text-2xl" style={{ color: "#ddd" }} title="Facebook">📘</a>
                <a href="#" className="text-2xl" style={{ color: "#ddd" }} title="Instagram">📸</a>
                <a href="https://wa.me/919179105875" target="_blank" rel="noopener" className="text-2xl" style={{ color: "#ddd" }} title="WhatsApp">💬</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ CTA ═════════════════════════════════════════════════════════ */}
      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto text-center" style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", borderRadius: "20px", padding: "2.5rem" }}>
          <h3 style={{ color: "white", marginBottom: "1rem", fontSize: "2rem" }}>Ready to Get Your Equipment Repaired?</h3>
          <p style={{ color: "rgba(255,255,255,0.9)", marginBottom: "1.5rem" }}>Contact us today for a free diagnostic assessment</p>
          <div className="flex flex-wrap justify-content-center gap-3">
            <a href="tel:+919179105875" style={{ background: "white", color: "#3b82f6", padding: "12px 30px", borderRadius: "50px", fontWeight: 600, textDecoration: "none" }}>
              📞 Call Now
            </a>
            <a href="https://wa.me/919179105875" target="_blank" rel="noopener" style={{ background: "#25D366", color: "white", padding: "12px 30px", borderRadius: "50px", fontWeight: 600, textDecoration: "none" }}>
              💬 WhatsApp
            </a>
          </div>
        </div>
      </section>
    </div>
    </>
  );
}
