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

/**
 * Payment edit → linked expense sync (P4 integrity).
 * Agar is payment ki expense entry already hai (supplier_payment_id), amount /
 * remarks / date usi ke mutabik update karo — ledger mismatch na rahe.
 * Sirf tab chalta hai jab expense entry exist karti hai; nahi to no-op.
 */
export async function syncExpenseForPayment(input: {
  paymentId: number;
  amount: number;
  supplierName: string;
  reference?: string | null;
  paymentDate?: string; // YYYY-MM-DD
}): Promise<{ synced: boolean; error?: string }> {
  try {
    const { data: expRow, error: findErr } = await supabase
      .from("expense_list")
      .select("id")
      .eq("supplier_payment_id", input.paymentId)
      .maybeSingle();
    if (findErr) return { synced: false, error: findErr.message };
    if (!expRow) return { synced: false };

    const date = input.paymentDate || new Date().toISOString().slice(0, 10);
    const { error: updErr } = await supabase
      .from("expense_list")
      .update({
        amount: input.amount,
        remarks: `Supplier payment - ${input.supplierName}${input.reference ? ` · ${input.reference}` : ""}`,
        date_created: `${date}T12:00:00+05:30`,
      })
      .eq("id", expRow.id);
    if (updErr) return { synced: false, error: updErr.message };
    return { synced: true };
  } catch (e) {
    return { synced: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Payment → Expense ledger entry (P4).
 * supplier_payment_id pe dedup — payment pehle se hi expenses me ho to
 * duplicate NAHI banega. date_created aaj ki payment hi date (IST noon format).
 */
export async function addExpenseFromPayment(input: {
  paymentId: number;
  supplierId: number;
  supplierName: string;
  amount: number;
  reference?: string | null;
  paymentDate?: string; // YYYY-MM-DD (default: aaj)
}): Promise<{ created: boolean; error?: string }> {
  try {
    const { count, error: countErr } = await supabase
      .from("expense_list")
      .select("id", { count: "exact", head: true })
      .eq("supplier_payment_id", input.paymentId);
    if (countErr) return { created: false, error: countErr.message };
    if (count && count > 0) return { created: false, error: "Pehle se expense entry ban gayi hai." };

    const date = input.paymentDate || new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("expense_list").insert({
      category: "Spare Parts Purchase",
      amount: input.amount,
      remarks: `Supplier payment - ${input.supplierName}${input.reference ? ` · ${input.reference}` : ""}`,
      date_created: `${date}T12:00:00+05:30`,
      supplier_id: input.supplierId,
      supplier_payment_id: input.paymentId,
    });
    if (error) return { created: false, error: error.message };
    void logActivity(
      "Added Supplier Expense",
      "Expenses",
      input.supplierId,
      `₹${input.amount} (payment #${input.paymentId} from ${input.supplierName})`
    );
    return { created: true };
  } catch (e) {
    return { created: false, error: e instanceof Error ? e.message : String(e) };
  }
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
