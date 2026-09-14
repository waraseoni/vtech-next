-- ═══════════════════════════════════════════════════════════════════════════
-- P4 (suppliers plan) — expense_list ↔ suppliers link.
-- Provenance: suppliers_module_plan.md P4 — auto-create an Expenses ledger
-- entry from a supplier payment and trace it back (expense_list.supplier_id).
-- Nullable: adjustments/advances may not belong to a supplier.
-- Idempotent → repeat run safe. Apply: Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.expense_list
  add column if not exists supplier_id bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'expense_list_supplier_fk'
      and conrelid = 'public.expense_list'::regclass
  ) then
    alter table only public.expense_list
      add constraint expense_list_supplier_fk
      foreign key (supplier_id) references public.suppliers(id)
      on delete set null;
  end if;
end $$;

create index if not exists expense_list_supplier_idx
  on public.expense_list(supplier_id);

-- ── 2) expense_list.supplier_payment_id ──────────────────────────────────
--   Payment → expense traceability + dedup ("Expense entry banao" button on
--   old payments). Kehta hai kaunsi supplier_payments row ka bana hai.
alter table public.expense_list
  add column if not exists supplier_payment_id bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'expense_list_supplier_payment_fk'
      and conrelid = 'public.expense_list'::regclass
  ) then
    alter table only public.expense_list
      add constraint expense_list_supplier_payment_fk
      foreign key (supplier_payment_id) references public.supplier_payments(id)
      on delete set null;
  end if;
end $$;

create index if not exists expense_list_supplier_payment_idx
  on public.expense_list(supplier_payment_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- PostgREST ke liye schema reload.
-- ═══════════════════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';