"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { X, Download, ExternalLink } from "lucide-react";

type LightboxState = { src: string; alt: string } | null;

// Lightweight global store — kisi bhi component se bina props ke open kar sakte ho
const listeners = new Set<(s: LightboxState) => void>();

/** Image ko bada kar ke dikhane ke liye (double-click handler me use karo). */
export function openImageLightbox(src: string | null | undefined, alt?: string) {
  if (!src) return;
  listeners.forEach((l) => l({ src, alt: alt || "Image" }));
}

/** Root layout me ek baar mount karo — poori app me zoom available ho jata hai. */
export function ImageLightbox() {
  const [state, setState] = useState<LightboxState>(null);

  useEffect(() => {
    const h = (s: LightboxState) => setState(s);
    listeners.add(h);
    return () => {
      listeners.delete(h);
    };
  }, []);

  // Esc se close
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setState(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  if (!state) return null;

  return (
    <div
      className="fixed inset-0 z-[999] bg-white/95 backdrop-blur-sm dark:bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
      onClick={() => setState(null)}
    >
      <button
        onClick={() => setState(null)}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/10 hover:bg-black/20 text-slate-800 dark:bg-white/10 dark:hover:bg-white/25 dark:text-white flex items-center justify-center z-20 transition"
        title="Close (Esc)"
      >
        <X size={20} />
      </button>
      <div
        className="absolute top-4 right-16 flex items-center gap-2 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <a
          href={state.src}
          target="_blank"
          rel="noreferrer"
          className="w-10 h-10 rounded-full bg-black/10 hover:bg-black/20 text-slate-800 dark:bg-white/10 dark:hover:bg-white/25 dark:text-white flex items-center justify-center transition"
          title="Original open karein"
        >
          <ExternalLink size={18} />
        </a>
        <a
          href={state.src}
          download
          className="w-10 h-10 rounded-full bg-black/10 hover:bg-black/20 text-slate-800 dark:bg-white/10 dark:hover:bg-white/25 dark:text-white flex items-center justify-center transition"
          title="Download"
        >
          <Download size={18} />
        </a>
      </div>
      <div
        className="max-w-[92vw] max-h-[88vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={state.src}
          alt={state.alt}
          width={1600}
          height={1200}
          unoptimized
          className="max-w-[92vw] max-h-[88vh] w-auto h-auto object-contain rounded-xl shadow-2xl border border-black/10 dark:border-white/10 bg-white"
        />
      </div>
      <p className="absolute bottom-5 left-0 right-0 text-center text-slate-500 dark:text-white/60 text-xs font-bold pointer-events-none select-none">
        {state.alt} · backdrop par click karke ya Esc se band karein
      </p>
    </div>
  );
}
