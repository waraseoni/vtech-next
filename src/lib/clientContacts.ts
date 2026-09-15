import { supabase } from "@/lib/supabase";

/**
 * Client MULTI-CONTACT model (2026-09-21, provenance `20260921_client_contacts.sql`).
 *
 * Ek client ke 1+ mobile numbers — flat table `client_contacts`, per row:
 *   name (rishta, optional) | label (Mobile/Office/WhatsApp/Shop/Other) |
 *   phone (digits) | is_primary (ek hi per client — partial unique index).
 *
 * `client_list.contact` legacy primary REPLACE nahi hota — form primary row
 * sync karta hai, back-compat ke liye rehta hai.
 */

export const CONTACT_LABELS = ["Mobile", "Office", "WhatsApp", "Shop", "Other"] as const;
export type ContactLabel = (typeof CONTACT_LABELS)[number];

export type ClientContact = {
  id?: number;
  client_id: number;
  name: string;
  label: string;
  phone: string;
  is_primary: boolean;
};

export type ClientContactInput = {
  id?: number;
  name: string;
  label: string;
  phone: string;
  is_primary: boolean;
};

/** URL helpers (suppliers/[id] page ke local helpers ka same contract). */
export const stripDigits = (phone: string) => (phone || "").replace(/\D/g, "");

export const telLink = (phone: string) => `tel:+91${stripDigits(phone)}`;

export const smsLink = (phone: string) => `sms:+91${stripDigits(phone)}`;

export const waChatLink = (phone: string) =>
  `https://wa.me/91${stripDigits(phone)}`;

const norm = (phone: string) => stripDigits(phone).trim();

/**
 * Pure form-state normalize + validation.
 * Returns `{ contacts, error }` — error = pehli dikkat (phone missing/non-10
 * digit/duplicate). Empty editor rows skip.
 */
export function normalizeContacts(input: ClientContactInput[]): {
  contacts: ClientContactInput[];
  error: string | null;
} {
  const seen = new Set<string>();
  const contacts: ClientContactInput[] = [];
  let error: string | null = null;
  let primarySeen = false;

  for (const c of input) {
    const digits = stripDigits(c.phone);
    if (!digits) continue;
    if (digits.length < 10 || digits.length > 12) {
      error = error || `Phone number sahi nahi hai: ${c.label || "number"}`;
      continue;
    }
    if (seen.has(digits)) {
      error = error || `Duplicate phone number: ${digits}`;
      continue;
    }
    seen.add(digits);
    // DB me partial unique index enforces 1 primary/client — form demotes
    // extra stars to secondary (pehla star win karta hai, rest self-heal).
    const isPrimary = c.is_primary && !primarySeen;
    if (isPrimary) primarySeen = true;
    contacts.push({ ...c, phone: digits, label: c.label.trim() || "Mobile", is_primary: isPrimary });
  }

  if (contacts.length > 0 && !primarySeen) {
    error = error || "Ek number primary (star) hona chahiye.";
  }

  return { contacts, error };
}

/** Ek client ke contacts load karo (primary pehle). */
export async function fetchClientContacts(clientId: number): Promise<ClientContact[]> {
  const { data, error } = await supabase
    .from("client_contacts")
    .select("id, client_id, name, label, phone, is_primary")
    .eq("client_id", clientId)
    .order("is_primary", { ascending: false })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`client_contacts load fail: ${error.message}`);
  }
  return (data || []) as ClientContact[];
}

/** Multiple clients ke contacts ek saath (list page bulk attach). */
export async function fetchClientContactsBulk(
  clientIds: number[]
): Promise<ClientContact[]> {
  if (clientIds.length === 0) return [];
  const { data, error } = await supabase
    .from("client_contacts")
    .select("id, client_id, name, label, phone, is_primary")
    .in("client_id", clientIds)
    .order("is_primary", { ascending: false })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`client_contacts bulk load fail: ${error.message}`);
  }
  return (data || []) as ClientContact[];
}

/**
 * Form contacts ko DB me sync karo (save par). Diff-by-phone strategy:
 *   • phone same hai → update (is_primary/label/name pakda)
 *   • naya phone → insert
 *   • DB me hai par form me nahi → delete
 * `client_list.contact` primary sync caller karta hai (payload.contact).
 */
export async function syncClientContacts(
  clientId: number,
  contacts: ClientContactInput[]
): Promise<ClientContact[]> {
  const { data: existing } = await supabase
    .from("client_contacts")
    .select("id, client_id, name, label, phone, is_primary")
    .eq("client_id", clientId);
  const existingRows = (existing || []) as ClientContact[];
  const existingByPhone = new Map(existingRows.map((r) => [norm(r.phone), r]));

  const desiredPhones = new Set(contacts.map((c) => norm(c.phone)));

  for (const c of contacts) {
    const key = norm(c.phone);
    const row = existingByPhone.get(key);
    if (row?.id) {
      const { error } = await supabase
        .from("client_contacts")
        .update({
          name: c.name.trim() || null,
          label: c.label.trim() || "Mobile",
          is_primary: c.is_primary,
        })
        .eq("id", row.id);
      if (error) throw new Error(`client_contacts update fail: ${error.message}`);
    } else {
      const { error } = await supabase
        .from("client_contacts")
        .insert({
          client_id: clientId,
          name: c.name.trim() || null,
          label: c.label.trim() || "Mobile",
          phone: c.phone,
          is_primary: c.is_primary,
        });
      if (error) throw new Error(`client_contacts insert fail: ${error.message}`);
    }
  }

  for (const row of existingRows) {
    if (desiredPhones.has(norm(row.phone))) continue;
    const { error } = await supabase
      .from("client_contacts")
      .delete()
      .eq("id", row.id);
    if (error) throw new Error(`client_contacts delete fail: ${error.message}`);
  }

  return fetchClientContacts(clientId);
}