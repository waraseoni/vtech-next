"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const [firmName, setFirmName] = useState("V-Tech");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    supabase.from("system_info")
      .select("meta_field, meta_value")
      .then(({ data }) => {
        if (data) {
          const n = data.find(r => r.meta_field === "name")?.meta_value;
          if (n) setFirmName(n);
        }
      });

    const h = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all ${
        scrolled ? "bg-[#0d1117]/95 backdrop-blur shadow-lg border-b border-[#21293d]" : "bg-transparent"
      }`}>
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-sm font-black">
              VT
            </div>
            <span className="font-black text-white text-sm truncate max-w-[180px]">{firmName}</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <a href="/#services" className="text-sm text-slate-400 hover:text-white transition-colors">Services</a>
            <a href="/#about" className="text-sm text-slate-400 hover:text-white transition-colors">About</a>
            <a href="/#contact" className="text-sm text-slate-400 hover:text-white transition-colors">Contact</a>
            <Link href="/ai" className="text-sm text-purple-400 hover:text-purple-300 transition-colors font-bold">🤖 AI Chat</Link>
            <Link href="/login" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition">
              Login
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-16">{children}</main>

      {/* Footer */}
      <footer className="border-t border-[#21293d] mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-slate-400">{firmName}</span>
          <p className="text-xs text-slate-600">© {new Date().getFullYear()} {firmName}</p>
          <Link href="/login" className="text-xs text-slate-500 hover:text-blue-400">Staff Login →</Link>
        </div>
      </footer>
    </div>
  );
}
