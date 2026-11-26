/**
 * Bulk job rows ka pure validation — RSC/client ke bina, test karne layak.
 *
 * Critical catch (service type v2 #4): validation aur save-filter alag-alag
 * logic ho to row silently drop ho sakti hai. Isliye dono ek hi helper se
 * aate hain: `validateBulkRows` jis row ka error nahi deta, wahi save hoti hai.
 */
import { expectsFault, type ServiceTypeOption } from "./serviceType";

export type BulkValidatableRow = {
  id: number;
  /** Final composed item label (caller `itemOf(r)` se banata hai). */
  itemLabel: string;
  fault: string;
  serviceTypeId: number | null;
  mechanicId: string;
};

/** NULL/legacy type = fault required. */
export function bulkRowFaultRequired(
  row: Pick<BulkValidatableRow, "serviceTypeId">,
  types: readonly ServiceTypeOption[]
): boolean {
  return expectsFault(types.find((t) => t.id === row.serviceTypeId));
}

/** Row ka missing-fields map (row id → field names). */
export function validateBulkRows(
  rows: readonly BulkValidatableRow[],
  types: readonly ServiceTypeOption[]
): Record<number, string[]> {
  const errs: Record<number, string[]> = {};
  rows.forEach((row) => {
    const miss: string[] = [];
    const hasItem = !!row.itemLabel.trim();
    const faultRequired = bulkRowFaultRequired(row, types);
    const hasFault = !!row.fault.trim();

    if (!hasItem) miss.push("Item / Model");
    if (faultRequired && !hasFault) miss.push("Fault Reported");
    // Mechanic sirf unhi rows me mandatory hai jo save hongi. Faultless type me
    // fault khali rehna bhi valid hai — usme bhi mechanic chahiye.
    if (hasItem && (!faultRequired || hasFault) && !row.mechanicId.trim()) miss.push("Mechanic");
    if (miss.length) errs[row.id] = miss;
  });
  return errs;
}

/** Save hone wali rows = jinhe validation ne reject nahi kiya (ek hi source). */
export function validBulkRows<T extends { id: number }>(
  rows: readonly T[],
  errs: Record<number, string[]>
): T[] {
  return rows.filter((r) => !errs[r.id]);
}
