"use client";
import { useParams } from "next/navigation";
import SaleForm from "../../components/SaleForm";
import Link from "next/link";
import { ArrowLeft, Edit3, ShoppingBag } from "lucide-react";

export default function EditSalePage() {
  const params = useParams();
  const saleId = Number(params.id);

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
        <div className="absolute -top-16 -right-10 w-72 h-72 bg-amber-600/8 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-5">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[10px] text-app mb-4 font-bold uppercase tracking-wider">
            <Link href="/direct-sales" className="hover:text-muted transition-colors">
              Direct Sales
            </Link>
            <span className="text-app">›</span>
            <Link
              href={`/direct-sales/${saleId}/view`}
              className="hover:text-muted transition-colors"
            >
              #{saleId}
            </Link>
            <span className="text-app">›</span>
            <span className="text-muted">Edit</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              {/* Back button */}
              <Link
                href={`/direct-sales/${saleId}/view`}
                className="mt-1 p-2 bg-panel hover:bg-panel-2 border border-app rounded-xl text-muted hover:text-app-2 transition-all flex-shrink-0"
              >
                <ArrowLeft size={16} />
              </Link>

              {/* Title */}
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-amber-500/25 flex-shrink-0">
                  <Edit3 size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-white tracking-tight leading-none">
                    Edit Sale
                  </h1>
                  <p className="text-muted-2 text-xs font-bold uppercase tracking-[0.2em] mt-1">
                    Sale ID: #{saleId}
                  </p>
                </div>
              </div>
            </div>

            {/* View Invoice shortcut */}
            <Link
              href={`/direct-sales/${saleId}/view`}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-panel hover:bg-panel-2 border border-app text-muted hover:text-white rounded-xl text-xs font-extrabold transition-all"
            >
              <ShoppingBag size={13} /> View Invoice
            </Link>
          </div>
        </div>
      </div>

      {/* ── FORM CARD ── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5">
        <div className="bg-panel border border-app rounded-2xl overflow-hidden">
          {/* Section label */}
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-app bg-panel-2">
            <Edit3 size={13} className="text-amber-400" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted">
              Edit Sale Details
            </span>
            <span className="ml-auto text-[9px] text-app font-bold uppercase tracking-wider">
              ID #{saleId}
            </span>
          </div>
          <div className="p-5 sm:p-6">
            <SaleForm mode="edit" saleId={saleId} />
          </div>
        </div>

        {/* Warning note */}
        <div className="flex items-start gap-2.5 bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3 mt-4">
          <span className="text-amber-500/60 text-xs flex-shrink-0 mt-0.5">⚠</span>
          <p className="text-[11px] text-app leading-relaxed">
            Changes will update the sale record permanently. Stock quantities are automatically
            adjusted on save.
          </p>
        </div>
      </div>
    </div>
  );
}
