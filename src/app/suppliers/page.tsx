// ─── Sprint 4 #17 (SSR pilot): suppliers list server-rendered ───────────────
// Pehla data server se aata hai (cookies session + RLS), interactivity
// SuppliersClient me. Dues math lib (supplierPayments) ko mirror karta hai —
// lib "use client" hai isliye server par import nahi ho sakta.
import { getServerSupabase } from "@/lib/api-auth";
import {
  SuppliersClient,
  type RawPersonRow,
  type RawPhoneRow,
} from "./SuppliersClient";
import type { SupplierRow } from "@/components/SupplierFormModal";

export default async function SuppliersPage() {
  const supabase = await getServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role = "staff";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = profile?.role ?? "staff";
  }

  const [{ data: suppliers, error }, { data: personRows }, { data: phoneRows }, { data: payments }, { data: pos }] =
    await Promise.all([
      supabase.from("suppliers").select("*").eq("delete_flag", 0).order("name"),
      supabase
        .from("supplier_contact_persons")
        .select("id, supplier_id, name, role, is_primary"),
      supabase
        .from("supplier_contact_phones")
        .select("id, person_id, label, phone, is_primary"),
      supabase.from("supplier_payments").select("supplier_id, amount"),
      supabase.from("purchase_orders").select("supplier_id, total_amount"),
    ]);

  // Dues: billed (PO) − paid, per supplier (lib mirror)
  const paidBySupplier: Record<number, number> = {};
  for (const p of (payments || []) as { supplier_id: number; amount: number }[]) {
    paidBySupplier[p.supplier_id] = (paidBySupplier[p.supplier_id] || 0) + Number(p.amount || 0);
  }
  const billedBySupplier: Record<number, number> = {};
  for (const po of (pos || []) as { supplier_id: number; total_amount: number }[]) {
    billedBySupplier[po.supplier_id] =
      (billedBySupplier[po.supplier_id] || 0) + Number(po.total_amount || 0);
  }
  const initialDues: Record<number, number> = {};
  for (const s of (suppliers || []) as { id: number }[]) {
    const billed = billedBySupplier[s.id] || 0;
    const paid = paidBySupplier[s.id] || 0;
    initialDues[s.id] = Math.round((billed - paid) * 100) / 100;
  }

  return (
    <SuppliersClient
      initialRows={(suppliers || []) as SupplierRow[]}
      initialPersons={(personRows || []) as RawPersonRow[]}
      initialPhones={(phoneRows || []) as RawPhoneRow[]}
      initialDues={initialDues}
      initialRole={role}
      initialError={error?.message ?? null}
    />
  );
}
