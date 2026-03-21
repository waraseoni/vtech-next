"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Loader2, CheckCircle, Send } from "lucide-react";
import Navbar from "../components/Navbar";

export default function ContactPage() {
  const [form, setForm] = useState({ fullname: "", contact: "", email: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullname.trim()) { setError("Naam zaroori hai!"); return; }
    if (!form.contact.trim()) { setError("Contact zaroori hai!"); return; }
    if (!form.message.trim()) { setError("Message zaroori hai!"); return; }

    setSending(true);
    setError("");
    try {
      await supabase.from("message_list").insert([{
        fullname: form.fullname.trim(),
        contact: form.contact.trim(),
        email: form.email.trim() || "not provided",
        message: form.message.trim(),
        status: 0,
      }]);
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[#0f0f1a] text-white py-10 px-4">
      <div className="max-w-5xl mx-auto">

        <div className="row my-5 grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* ══ LEFT: Contact Info (exact match PHP) ══════════════════════ */}
          <div className="md:col-span-5">
            <div style={{ background: "#1e1e2d", border: "1px solid #2d2d3d", borderRadius: "15px" }}>
              <div style={{ background: "#151521", padding: "1rem 1.5rem", borderBottom: "1px solid #2d2d3d", borderRadius: "15px 15px 0 0" }}>
                <h4 style={{ color: "#f3f4f6", margin: 0 }}>Contact Information</h4>
              </div>
              <div style={{ padding: "1.5rem" }}>
                <dl>
                  <dt className="mb-2" style={{ color: "#9ca3af" }}>
                    <span className="mr-2">📧</span> Email
                  </dt>
                  <dd className="mb-4" style={{ color: "#f3f4f6" }}>vtech.jbp@gmail.com</dd>

                  <dt className="mb-2" style={{ color: "#9ca3af" }}>
                    <span className="mr-2">📞</span> Contact #
                  </dt>
                  <dd className="mb-4" style={{ color: "#f3f4f6" }}>
                    <a href="tel:+919179105875" style={{ color: "#3b82f6", textDecoration: "none" }}>9179105875</a>
                  </dd>

                  <dt className="mb-2" style={{ color: "#9ca3af" }}>
                    <span className="mr-2">📍</span> Location
                  </dt>
                  <dd style={{ color: "#f3f4f6" }}>
                    F4 Hotel Plaza (Now Madhushala), Besides Jayanti Complex, Marhatal, Jabalpur, 482002
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          {/* ══ RIGHT: Message Form (exact match PHP) ═════════════════════ */}
          <div className="md:col-span-7">
            <div style={{ background: "#1e1e2d", border: "1px solid #2d2d3d", borderRadius: "15px" }}>
              <div style={{ padding: "1.5rem" }}>
                <h2 className="text-center" style={{ color: "#f3f4f6" }}>Message Us</h2>
                <hr style={{ borderColor: "#667eea", borderWidth: "2px", width: "100px", margin: "0.5rem auto 1.5rem" }} />

                {sent ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle size={32} style={{ color: "#10b981" }}/>
                    </div>
                    <h3 className="text-lg font-bold mb-2" style={{ color: "#f3f4f6" }}>Message Sent Successfully!</h3>
                    <p style={{ color: "#9ca3af" }}>We&apos;ll get back to you soon.</p>
                    <button onClick={() => { setSent(false); setForm({ fullname: "", contact: "", email: "", message: "" }); }}
                      className="mt-4" style={{ color: "#3b82f6", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    {error && (
                      <div style={{ background: "#2c0b0e", border: "1px solid #842029", color: "#ea868f", padding: "0.75rem", borderRadius: "5px", marginBottom: "1rem" }}>
                        {error}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <input type="text" value={form.fullname} onChange={e => setForm(p => ({ ...p, fullname: e.target.value }))}
                          required placeholder="Your Name"
                          style={{ background: "#0d1117", border: "1px solid #4b4b5a", color: "#f3f4f6", padding: "0.5rem 0.75rem", borderRadius: "5px", width: "100%" }}/>
                        <small style={{ color: "#9ca3af", paddingLeft: "0.75rem" }}>Full Name</small>
                      </div>
                      <div>
                        <input type="text" value={form.contact} onChange={e => setForm(p => ({ ...p, contact: e.target.value }))}
                          required placeholder="xxxxxxxxxxxxx"
                          style={{ background: "#0d1117", border: "1px solid #4b4b5a", color: "#f3f4f6", padding: "0.5rem 0.75rem", borderRadius: "5px", width: "100%" }}/>
                        <small style={{ color: "#9ca3af", paddingLeft: "0.75rem" }}>Contact #</small>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                          placeholder="xxxxxx@xxxxxx.xxx"
                          style={{ background: "#0d1117", border: "1px solid #4b4b5a", color: "#f3f4f6", padding: "0.5rem 0.75rem", borderRadius: "5px", width: "100%" }}/>
                        <small style={{ color: "#9ca3af", paddingLeft: "0.75rem" }}>Email</small>
                      </div>
                    </div>

                    <div className="mb-3">
                      <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                        required rows={4} placeholder="Write your message here"
                        style={{ background: "#0d1117", border: "1px solid #4b4b5a", color: "#f3f4f6", padding: "0.5rem 0.75rem", borderRadius: "5px", width: "100%", resize: "none" }}/>
                      <small style={{ color: "#9ca3af" }}>Message</small>
                    </div>

                    <div className="text-center">
                      <button type="submit" disabled={sending}
                        style={{
                          background: "linear-gradient(135deg, #667eea, #764ba2)",
                          color: "white", border: "none", borderRadius: "50px",
                          padding: "10px 40px", fontWeight: 600, cursor: "pointer",
                          opacity: sending ? 0.7 : 1,
                        }}>
                        {sending ? <><Loader2 size={14} className="animate-spin inline mr-2"/> Sending...</> : "Send Message"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ══ CTA ═══════════════════════════════════════════════════════ */}
        <div className="text-center mt-10" style={{ background: "#1e1e2d", borderRadius: "15px", padding: "2rem", border: "1px solid #2d2d3d" }}>
          <h4 style={{ color: "#f3f4f6", marginBottom: "1rem" }}>Or Call Us Directly</h4>
          <a href="tel:+919179105875" style={{
            background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
            color: "white", padding: "12px 30px", borderRadius: "50px",
            fontWeight: 600, textDecoration: "none", display: "inline-block",
          }}>
            📞 Call +91 91791 05875
          </a>
          <Link href="/login" className="block mt-3 text-sm" style={{ color: "#3b82f6" }}>
            Staff Login →
          </Link>
        </div>

      </div>
    </div>
    </>
  );
}
