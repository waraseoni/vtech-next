// ============================================================================
// src/components/ui — shared UI kit (Sprint 1+)
//
// Barrel exports. Naye pages se yahan se import karo:
//   import { StatusBadge, EmptyState, ConfirmDialog } from "@/components/ui";
//
// Migration note: PageHeader abhi bhi purane path se chal raha hai
// (@/app/components/ui/PageHeader) — usse bhi yahan re-export karte hain
// taaki gradually ek hi jagah aaye.
// ============================================================================

export { StatusBadge } from "./StatusBadge";
export type { } from "./StatusBadge";

export { EmptyState } from "./EmptyState";

export { ConfirmDialog } from "./ConfirmDialog";

// Re-export legacy PageHeader (src/app/components/ui/PageHeader) — import path
// stable rakha hai, actual file baad me yahan move hogi.
export { PageHeader } from "@/app/components/ui/PageHeader";
export { DataTable } from "./DataTable";
export type { Column, DataTableProps } from "./DataTable";
