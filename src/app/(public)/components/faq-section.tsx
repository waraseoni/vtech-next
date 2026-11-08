import { ChevronDown, HelpCircle, MessageCircle, Phone } from "lucide-react";
import {
  buildWhatsAppLink,
  type FaqContent,
  type PublicSiteContent,
} from "@/lib/public-site-defaults";
import { buildFaqJsonLd, serializeJsonLd } from "@/lib/public-site-metadata";

export function FaqSection({ faq, content }: { faq: FaqContent; content: PublicSiteContent }) {
  const items = faq.items.filter((item) => item.q.trim() && item.a.trim());
  if (items.length === 0) return null;

  const jsonLd = buildFaqJsonLd({ ...faq, items });

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="border-y border-white/[0.05] bg-app/60 py-14 sm:py-20"
    >
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />
      )}
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-blue-300">
              <HelpCircle size={13} /> {faq.badge}
            </span>
            <h2
              id="faq-heading"
              className="mt-4 font-display text-2xl font-black tracking-tight sm:text-4xl"
            >
              {faq.title}
            </h2>
            {faq.subtitle && (
              <p className="mt-3 max-w-md text-[14px] leading-relaxed text-muted">{faq.subtitle}</p>
            )}

            <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
              <p className="text-[13px] font-bold text-white">Aur kuch puchna hai?</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                Photo bhejo, seedha jawab milega — form fill karne ki zarurat nahi.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <a
                  href={buildWhatsAppLink(content, "Hello, repair ke baare mein ek sawaal hai.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366]/15 px-4 text-[13px] font-bold text-[#4ade80] ring-1 ring-[#25D366]/25 transition-colors hover:bg-[#25D366]/25 active:scale-95"
                >
                  <MessageCircle size={15} /> WhatsApp
                </a>
                <a
                  href={content.contact.phoneHref}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/[0.04] px-4 text-[13px] font-bold text-white ring-1 ring-white/10 transition-colors hover:bg-white/[0.08] active:scale-95"
                >
                  <Phone size={15} className="text-emerald-400" /> Call
                </a>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            {items.map((item, index) => (
              <details
                key={`${item.q}-${index}`}
                name="site-faq"
                open={index === 0}
                className="group overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] transition-colors open:border-blue-500/30 open:bg-white/[0.045]"
              >
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
                  <span className="w-7 shrink-0 font-mono text-[12px] font-bold tabular-nums text-blue-400/80">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-[14px] font-bold leading-snug text-white sm:text-[15px]">
                    {item.q}
                  </span>
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className="shrink-0 text-muted transition-transform duration-300 group-open:rotate-180 motion-reduce:transition-none"
                  />
                </summary>
                <div className="px-4 pb-4 sm:px-5 sm:pl-[3.75rem]">
                  <p className="anim-fade text-[13px] leading-relaxed text-app-2 sm:text-[13.5px]">
                    {item.a}
                  </p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
