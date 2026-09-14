"use client";
import { supabase, getCachedUser } from "@/lib/supabase";
import { logActivity } from "@/lib/activity";

export type PaymentMode = "cash" | "upi" | "bank_transfer" | "cheque" | "adjustment";

export const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "adjustment", label: "Adjustment" },
];

export type SupplierPayment = {
  id: number;
  supplier_id: number;
  amount: number;
  payment_mode: PaymentMode;
  reference: string | null;
  notes: string | null;
  payment_date: string;
  created_by: number | null;
  date_created: string;
  contact_person_id?: number | null;
};

export type SupplierDues = {
  supplierId: number;
  name: string;
  billed: number;
  paid: number;
  outstanding: number;
};

/** Logged-in user ka numeric mechanic_id (profiles.mechanic_id → users.id mapping). */
async function resolveNumericUserId(): Promise<number> {
  try {
    const {
      data: { user },
    } = await getCachedUser();
    if (!user) return 0;
    const { data: profile } = await supabase
      .from("profiles")
      .select("mechanic_id")
      .eq("id", user.id)
      .single();
    return profile?.mechanic_id || 0;
  } catch {
    return 0;
  }
}

/** Ek supplier ke saare payments (naye se purane). */
export async function listSupplierPayments(
  supplierId: number,
  limit = 50
): Promise<SupplierPayment[]> {
  const { data } = await supabase
    .from("supplier_payments")
    .select("*")
    .eq("supplier_id", supplierId)
    .order("payment_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  return (data || []) as SupplierPayment[];
}

export type AddPaymentInput = {
  supplier_id: number;
  amount: number;
  payment_mode: PaymentMode;
  reference?: string;
  notes?: string;
  payment_date?: string; // YYYY-MM-DD (default aaj)
  contact_person_id?: number | null;
};

/** Payment record + activity log (writer rule: meta_id = supplier id). */
export async function addSupplierPayment(input: AddPaymentInput): Promise<SupplierPayment | null> {
  const createdBy = await resolveNumericUserId();
  const { data, error } = await supabase
    .from("supplier_payments")
    .insert({
      supplier_id: input.supplier_id,
      amount: input.amount,
      payment_mode: input.payment_mode,
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim() || null,
      payment_date: input.payment_date || new Date().toISOString().slice(0, 10),
      created_by: createdBy,
      contact_person_id: input.contact_person_id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  void logActivity(
    "Added Supplier Payment",
    "Suppliers",
    input.supplier_id,
    `₹${input.amount} (${input.payment_mode})${input.reference ? " · " + input.reference : ""}`
  );
  return data as SupplierPayment;
}

export async function removeSupplierPayment(id: number, supplierId: number): Promise<void> {
  const { error } = await supabase.from("supplier_payments").delete().eq("id", id);
  if (error) throw error;
  void logActivity("Deleted Supplier Payment", "Suppliers", supplierId, `payment #${id}`);
}

export type UpdatePaymentInput = {
  amount: number;
  payment_mode: PaymentMode;
  reference?: string;
  notes?: string;
  payment_date?: string; // YYYY-MM-DD
  contact_person_id?: number | null;
};

/** Payment record update + activity log (writer rule: meta_id = supplier id). */
export async function updateSupplierPayment(
  id: number,
  supplierId: number,
  input: UpdatePaymentInput
): Promise<SupplierPayment | null> {
  const { data, error } = await supabase
    .from("supplier_payments")
    .update({
      amount: input.amount,
      payment_mode: input.payment_mode,
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim() || null,
      payment_date: input.payment_date || new Date().toISOString().slice(0, 10),
      contact_person_id: input.contact_person_id ?? null,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  void logActivity(
    "Updated Supplier Payment",
    "Suppliers",
    supplierId,
    `payment #${id} · ₹${input.amount} (${input.payment_mode})`
  );
  return data as SupplierPayment;
}

/**
 * Har supplier ka outstanding (due) — billed = Σ PO total_amount,
 * paid = Σ supplier_payments. Koi PO kam se kam ho ya na ho dono cases safe.
 * supplierIds empty → sab active suppliers.
 */
export async function fetchSupplierDues(supplierIds?: number[]): Promise<SupplierDues[]> {
  let supQuery = supabase.from("suppliers").select("id, name").eq("delete_flag", 0);
  if (supplierIds && supplierIds.length > 0) supQuery = supQuery.in("id", supplierIds);

  const [{ data: suppliers }, { data: payments }, { data: pos }] = await Promise.all([
    supQuery.order("name"),
    supabase.from("supplier_payments").select("supplier_id, amount"),
    supabase.from("purchase_orders").select("supplier_id, total_amount"),
  ]);

  const paidBySupplier: Record<number, number> = {};
  for (const p of (payments || []) as { supplier_id: number; amount: number }[]) {
    paidBySupplier[p.supplier_id] = (paidBySupplier[p.supplier_id] || 0) + Number(p.amount || 0);
  }

  const billedBySupplier: Record<number, number> = {};
  for (const po of (pos || []) as { supplier_id: number; total_amount: number }[]) {
    billedBySupplier[po.supplier_id] =
      (billedBySupplier[po.supplier_id] || 0) + Number(po.total_amount || 0);
  }

  return ((suppliers as { id: number; name: string }[]) || []).map((s) => {
    const billed = billedBySupplier[s.id] || 0;
    const paid = paidBySupplier[s.id] || 0;
    return {
      supplierId: s.id,
      name: s.name,
      billed,
      paid,
      outstanding: Math.round((billed - paid) * 100) / 100,
    };
  });
}
