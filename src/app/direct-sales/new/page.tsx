import SaleForm from "../components/SaleForm";
import Link from "next/link";
import { ArrowLeft, ShoppingBag, Plus } from "lucide-react";

export default function NewSalePage() {
  return (
    <div className="min-h-screen bg-app font-sans pb-16">
      {/* ── HERO HEADER ── */}
      <div className="relative overflow-hidden bg-app border-b border-app">
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="absolute -top-16 -left-10 w-72 h-72 bg-emerald-600/8 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-5">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[10px] text-app mb-4 font-bold uppercase tracking-wider">
            <Link href="/direct-sales" className="hover:text-muted transition-colors">
              Direct Sales
            </Link>
            <span className="text-app">›</span>
            <span className="text-muted">New Sale</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            {/* Left: title */}
            <div className="flex items-start gap-4">
              <Link
                href="/direct-sales"
                className="mt-1 p-2 bg-panel hover:bg-panel-2 border border-app rounded-xl text-muted hover:text-app-2 transition-all flex-shrink-0"
              >
                <ArrowLeft size={16} />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/25 flex-shrink-0">
                  <Plus size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-white tracking-tight leading-none">
                    New Direct Sale
                  </h1>
                  <p className="text-muted-2 text-xs font-bold uppercase tracking-[0.2em] mt-1">
                    Create a new sale entry
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── FORM CARD ── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5">
        <div className="bg-panel border border-app rounded-2xl overflow-hidden">
          {/* Section label */}
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-app bg-panel-2">
            <ShoppingBag size={13} className="text-emerald-400" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted">
              Sale Details
            </span>
          </div>
          <div className="p-5 sm:p-6">
            <SaleForm mode="new" />
          </div>
        </div>
      </div>
    </div>
  );
}
