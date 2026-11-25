import { describe, it, expect } from "vitest";
import {
  AUTH_LINKED_TABLES,
  buildAuthUuidRemap,
  remapAuthRows,
  filterRowsToColumns,
} from "./backupAuthRestore";

describe("buildAuthUuidRemap", () => {
  const profiles = [
    { id: "old-vikram", email: "Vikram@Vtech.com", full_name: "Vikram Jain", role: "admin" },
    { id: "old-preeti", email: "preeti@vtech.com", full_name: "Preeti Jain" },
    { id: "old-noemail", full_name: "Legacy User" },
  ];

  it("maps old UUIDs to existing new-project users by email", () => {
    const plan = buildAuthUuidRemap(
      profiles,
      [
        { id: "new-vikram", email: "vikram@vtech.com" },
        { id: "new-preeti", email: "preeti@vtech.com" },
      ],
      false
    );
    expect(plan.remap).toEqual({
      "old-vikram": "new-vikram",
      "old-preeti": "new-preeti",
    });
    expect(plan.missing).toEqual([{ oldId: "old-noemail", email: "<no-email>" }]);
    expect(plan.toCreate).toEqual([]);
  });

  it("keeps an old UUID that already exists in the new project", () => {
    const plan = buildAuthUuidRemap(
      [{ id: "same-id", email: "x@y.com" }],
      [{ id: "same-id", email: "other@y.com" }],
      false
    );
    expect(plan.remap["same-id"]).toBe("same-id");
  });

  it("plans missing users only when explicitly allowed", () => {
    const plan = buildAuthUuidRemap(
      [{ id: "old-rajeev", email: "rajeev@vtech.com", full_name: "Dr. Rajeev Jain" }],
      [],
      true
    );
    expect(plan.toCreate).toEqual([
      { id: "old-rajeev", email: "rajeev@vtech.com", fullName: "Dr. Rajeev Jain" },
    ]);
    expect(plan.remap["old-rajeev"]).toBe("old-rajeev");
    expect(plan.missing).toEqual([]);
  });

  it("does not create duplicate emails", () => {
    const plan = buildAuthUuidRemap(
      [
        { id: "a", email: "dup@vtech.com" },
        { id: "b", email: "dup@vtech.com" },
      ],
      [],
      true
    );
    expect(plan.toCreate).toHaveLength(1);
    expect(plan.missing).toEqual([{ oldId: "b", email: "dup@vtech.com" }]);
  });
});

describe("remapAuthRows", () => {
  it("remaps message sender/recipient UUIDs", () => {
    const rows = [{ id: 1, sender_id: "old-vikram", recipient_id: "old-preeti", content: "hi" }];
    expect(
      remapAuthRows("messages", rows, { "old-vikram": "new-vikram", "old-preeti": "new-preeti" })
    ).toEqual([{ id: 1, sender_id: "new-vikram", recipient_id: "new-preeti", content: "hi" }]);
  });

  it("remaps profile id and stock counted_by", () => {
    const profiles = remapAuthRows("profiles", [{ id: "old-vikram", role: "admin" }], {
      "old-vikram": "new-vikram",
    });
    expect(profiles[0].id).toBe("new-vikram");
    const counts = remapAuthRows("stock_counts", [{ id: 1, counted_by: "old-vikram" }], {
      "old-vikram": "new-vikram",
    });
    expect(counts[0].counted_by).toBe("new-vikram");
  });

  it("strips generated identity id for staff_geofence_permit", () => {
    const rows = remapAuthRows(
      "staff_geofence_permit",
      [{ id: 1, user_id: "old-vikram", expires_at: "2026-12-01" }],
      { "old-vikram": "new-vikram" }
    );
    expect(rows[0]).not.toHaveProperty("id");
    expect(rows[0].user_id).toBe("new-vikram");
  });

  it("leaves unknown UUIDs untouched for the DB to report", () => {
    const rows = remapAuthRows("user_passkeys", [{ id: 1, user_id: "unknown" }], {});
    expect(rows[0].user_id).toBe("unknown");
  });
});

describe("filterRowsToColumns", () => {
  it("drops columns that are not in the live schema", () => {
    const rows = [
      { id: 1, user_id: "old", legacy_col: "drop-me" },
      { id: 2, user_id: "old", legacy_col: 42 },
    ];
    expect(filterRowsToColumns(rows, ["id", "user_id"])).toEqual([
      { id: 1, user_id: "old" },
      { id: 2, user_id: "old" },
    ]);
  });
});

describe("AUTH_LINKED_TABLES", () => {
  it("covers all eight tables that failed in the 26 Nov report", () => {
    expect(AUTH_LINKED_TABLES).toEqual([
      "profiles",
      "stock_counts",
      "stock_adjustments",
      "messages",
      "push_subscriptions",
      "user_presence",
      "staff_geofence_permit",
      "user_passkeys",
    ]);
  });
});
