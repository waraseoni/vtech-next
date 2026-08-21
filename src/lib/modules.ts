// ─── Module Selection System ────────────────────────────────────────────────
// Seller decides which modules each client gets.
// This file is the single source of truth for module keys, labels,
// plan defaults, and route mapping.

export const ALL_MODULES = [
  { key: "dashboard",  label: "Dashboard",         always: true  },
  { key: "jobs",       label: "Jobs / Repairs",    always: false },
  { key: "sales",      label: "Direct Sales",      always: false },
  { key: "clients",    label: "Clients",           always: false },
  { key: "inventory",  label: "Inventory",         always: false },
  { key: "finance",    label: "Finance",           always: false },
  { key: "people",     label: "People / Staff",    always: false },
  { key: "reports",    label: "Reports",           always: false },
] as const;

export type ModuleKey = typeof ALL_MODULES[number]["key"];

/** Har module ke related routes — route guard ke liye */
export const MODULE_TO_ROUTE: Record<string, string[]> = {
  jobs:      ["/jobs"],
  sales:     ["/direct-sales"],
  clients:   ["/clients", "/clients-admin", "/client-loans"],
  inventory: ["/inventory", "/products", "/suppliers"],
  finance:   ["/back-office", "/payments", "/expenses", "/advance", "/lenders"],
  people:    ["/mechanics", "/services"],
  reports:   ["/reports", "/activity-logs"],
};

/** Plan-based default modules — seller ek click mein apply kar sakta hai */
export const PLAN_DEFAULTS: Record<string, ModuleKey[]> = {
  standard: ["dashboard", "jobs", "clients", "sales"],
  premium:  ["dashboard", "jobs", "sales", "clients", "inventory", "finance", "people", "reports"],
  lifetime: ["dashboard", "jobs", "sales", "clients", "inventory", "finance", "people", "reports"],
};

/** Saare toggleable module keys (always-on chhod kar) */
export const TOGGLEABLE_KEYS = ALL_MODULES.filter(m => !m.always).map(m => m.key);

/** Check if a module is enabled. null/undefined/empty = all enabled (backward compat) */
export function isModuleEnabled(
  enabledModules: string[] | null | undefined,
  key: string,
): boolean {
  if (!enabledModules || enabledModules.length === 0) return true;
  return enabledModules.includes(key);
}

/** Check if a pathname belongs to a disabled module */
export function isRouteDisabled(
  pathname: string,
  enabledModules: string[] | null | undefined,
): boolean {
  if (!enabledModules || enabledModules.length === 0) return false;
  for (const [modKey, routes] of Object.entries(MODULE_TO_ROUTE)) {
    if (enabledModules.includes(modKey)) continue;
    for (const route of routes) {
      if (pathname === route || pathname.startsWith(route + "/")) return true;
    }
  }
  return false;
}
