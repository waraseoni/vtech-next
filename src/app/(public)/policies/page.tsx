import type { Metadata } from "next";
import { getPublicSiteContent } from "@/lib/public-site-content";
import { buildPublicPageMetadata } from "@/lib/public-site-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPublicSiteContent();
  return buildPublicPageMetadata(content, {
    path: "/policies",
    title: `Privacy, Terms & Warranty — ${content.brand.shortName}`,
    description:
      "Contact form data, repair terms aur service warranty — simple bhasha me. Sawaal ho to call ya WhatsApp karein.",
  });
}

const SECTIONS = [
  {
    id: "privacy",
    title: "Privacy",
    body: [
      "Contact form me aapka naam, mobile number, optional email aur message humari job system me save hota hai — sirf aapki inquiry ka jawab dene ke liye. Hum ye data kisi third party ko bechte nahi hain.",
      "Job status check karne ke liye Job ID ya Repair Code chahiye. Aapki device par recent lookups (last 5) browser ke localStorage me rehte hain; wo humare server par save nahi hote.",
      "Apna data dekhna ya delete karwana ho to phone/WhatsApp par sampark karein — hum verify karke action lete hain.",
    ],
  },
  {
    id: "terms",
    title: "Repair Terms",
    body: [
      "Diagnosis free hai. Repair sirf quote approve hone ke baad shuru hoti hai; fault badalne par rate dobara confirm kiya jata hai.",
      "Repair ka final amount, parts aur warranty period bill par likha jata hai. Bill ko sambhal kar rakhein — warranty claim ke liye zaroori hai.",
      "Physical damage, paani/burn ya tampering wale equipment ki condition pehle bata di jati hai; aise cases me repair possible na hone par bhi diagnosis charge ho sakta hai.",
    ],
  },
  {
    id: "warranty",
    title: "Service Warranty",
    body: [
      "Har repair par written service warranty milti hai. Warranty sirf repaired fault aur uske workmanship par lagti hai — naya ya unrelated fault cover nahi hota.",
      "Warranty period bill par mention hota hai. Claim ke waqt bill aur equipment dono saath laayein.",
      "Warranty ke andar repair dobara free hoti hai; warranty ke bahar hone par fresh diagnosis aur quote diya jata hai.",
    ],
  },
] as const;

export default async function PoliciesPage() {
  const content = await getPublicSiteContent();
  const { contact, brand } = content;

  return (
    <>
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.16),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.10),transparent_50%)]" />
        <div className="relative mx-auto max-w-3xl px-4 py-12 sm:py-16">
          <h1 className="font-display text-3xl sm:text-5xl font-black tracking-tight leading-[1.1]">
            Privacy, Terms &amp;{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              Warranty
            </span>
          </h1>
          <p className="mt-4 text-[14px] sm:text-base text-muted max-w-2xl">
            {brand.shortName} ke saath repair karwane se pehle ye simple terms padh lein. Final
            details aapke bill par bhi likhi hoti hain.
          </p>
        </div>
      </section>

      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-3xl space-y-6 px-4">
          {SECTIONS.map((section) => (
            <article
              key={section.id}
              id={section.id}
              className="scroll-mt-20 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8"
            >
              <h2 className="font-display text-xl sm:text-2xl font-black mb-4">{section.title}</h2>
              <div className="space-y-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-[14px] leading-relaxed text-muted">
                    {paragraph}
                  </p>
                ))}
              </div>
            </article>
          ))}

          <div className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-blue-600/10 to-cyan-600/5 p-6 sm:p-8">
            <h2 className="font-display text-lg font-black mb-2">Sawaal hai?</h2>
            <p className="text-[13px] text-muted leading-relaxed">
              Call/WhatsApp: <span className="font-bold text-white">{contact.phone}</span>
              <br />
              Email: <span className="font-bold text-white break-all">{contact.email}</span>
              <br />
              Address: {contact.address}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
