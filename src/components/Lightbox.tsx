"use client";

import { useEffect } from "react";
import Image from "next/image";
import { X, ExternalLink } from "lucide-react";

type Props = {
  src: string;
  alt?: string;
  onClose: () => void;
};

// Fullscreen image viewer — thumbnail/photo click par image bada kar ke dekho.
// Esc ya backdrop click se band. Double-click / External → naye tab me kholo.
export default function Lightbox({ src, alt, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-sm dark:bg-black/90 flex items-center justify-center p-4 sm:p-8 cursor-zoom-out"
      onClick={onClose}
    >
      <div
        className="relative max-w-[98vw] max-h-[96vh] w-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={src}
          alt={alt || "Image"}
          width={1600}
          height={1200}
          className="max-w-full max-h-[94vh] w-auto h-auto object-contain rounded-xl shadow-2xl border border-black/10 dark:border-white/10 bg-white"
        />
      </div>

      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2.5 rounded-full bg-black/10 hover:bg-black/20 text-app dark:bg-white/10 dark:hover:bg-white/25 dark:text-white transition-colors z-10"
        title="Close (Esc)"
      >
        <X size={18} />
      </button>

      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-4 right-4 p-2.5 rounded-full bg-black/10 hover:bg-black/20 text-app dark:bg-white/10 dark:hover:bg-white/25 dark:text-white transition-colors z-10"
        title="Naye tab me kholo"
      >
        <ExternalLink size={18} />
      </a>
    </div>
  );
}