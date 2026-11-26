import { describe, expect, it } from "vitest";
import { RESET_SEQUENCE_TABLES, isResetSequenceTable } from "./resetSequence";

describe("D1 — reset_sequence allowlist", () => {
  it("backup page ke saare known tables allow hain", () => {
    const required = [
      "transaction_list",
      "client_payments",
      "job_id_counter",
      "service_types",
      "brands",
      "login_throttle",
    ];
    for (const table of required) expect(isResetSequenceTable(table)).toBe(true);
    expect(RESET_SEQUENCE_TABLES.length).toBeGreaterThan(40);
  });

  it("arbitrary / injection payload reject hota hai", () => {
    for (const bad of [
      "pg_class",
      "auth.users",
      "public.profiles; drop table x",
      "xyz",
      "",
      null,
      undefined,
      42,
      {},
    ]) {
      expect(isResetSequenceTable(bad)).toBe(false);
    }
  });

  it("case-sensitive exact match — 'Transaction_List' nahi", () => {
    expect(isResetSequenceTable("Transaction_List")).toBe(false);
    expect(isResetSequenceTable("transaction_list ")).toBe(false);
  });
});
