// ============================================================================
// requireAdmin.ts — Sirf-Admin actions ka single helper (Sprint 1)
//
// Pehle har list page me copy-paste hota tha (~15 jagah, 7 files):
//   if (userRole !== "admin") { alert("Sirf Admin delete kar sakta hai!"); return; }
//
// Ab:
//   import { requireAdmin } from "@/lib/requireAdmin";
//   if (!requireAdmin(userRole, "delete")) return;
//   // ... actual delete
//
// Pure function (hook nahi) — pages me pehle se userRole state hoti hai.
// Toast use karta hai (alert nahi) — Sprint 1 toast-unification rule.
// Role check: admin OR developer (RootClient isAdmin pattern ke same).
// ============================================================================

import { toast } from "@/lib/toast";

type AdminAction = "delete" | "status" | "edit" | "manage" | string;

const VERBS: Record<string, string> = {
  delete: "delete kar sakta hai",
  status: "status change kar sakta hai",
  edit: "edit kar sakta hai",
  manage: "manage kar sakta hai",
};

/**
 * @param userRole  caller ka role state (profiles.role)
 * @param action    kya karne ki koshish thi — toast me verb ke liye
 * @returns true = admin hai, flow continue karo; false = toast dikh gaya, return karo
 */
export function requireAdmin(
  userRole: string | null | undefined,
  action: AdminAction = "manage"
): boolean {
  if (userRole === "admin" || userRole === "developer") return true;
  const verb = VERBS[action] || `${action} kar sakta hai`;
  toast.error(`Sirf Admin ${verb}!`);
  return false;
}

/** Boolean check bina toast ke (jahan sirf UI hide karna ho — waise already hota hai). */
export function isAdminRole(userRole: string | null | undefined): boolean {
  return userRole === "admin" || userRole === "developer";
}

export default requireAdmin;
