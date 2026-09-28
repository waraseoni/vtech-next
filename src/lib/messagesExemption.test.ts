// @vitest-environment jsdom
// ─── /messages geofence exemption — scoping tests ───────────────────────────
//
// User decision 2026-09-28: staff office ke bahar se /messages par message dekh
// AUR bhej sake. Ye tests prove karti hain ki exception NAARROW hai:
//   1. sirf /messages route par,
//   2. sirf messaging tables/bucket/API par,
//   3. kisi aur page par ya kisi aur table par gate POORI TARAH active rehta hai.
//
// Ye "narrow scope" hi security ke liye zaroori hai — agar exemption
// blanket hoti to staff /messages khol ke kisi bhi table me likh paata.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isOnMessagingRoute,
  isMessagingTableExempt,
  isMessagingStorageExempt,
  isMessagingApiExempt,
} from "./writeGuard";

const at = (path: string) => window.history.pushState({}, "", path);

describe("isOnMessagingRoute", () => {
  afterEach(() => at("/dashboard"));

  it.each([
    ["/messages", true],
    ["/messages/supervise", true],
    ["/messages/", true],
  ])("%s → %s", (path, want) => {
    at(path);
    expect(isOnMessagingRoute()).toBe(want);
  });

  it.each([
    ["/dashboard", false],
    ["/clients", false],
    ["/messages-archive", false], // prefix hi nahi, exact segment match chahiye
    ["/users", false],
  ])("%s → %s", (path, want) => {
    at(path);
    expect(isOnMessagingRoute()).toBe(want);
  });
});

describe("isMessagingTableExempt — sirf messaging tables", () => {
  beforeEach(() => at("/messages"));

  it.each(["messages", "user_presence"])("%s exempt hai", (t) => {
    expect(isMessagingTableExempt(t)).toBe(true);
  });

  // ── Business tables: /messages khula ho tab bhi BLOCKED rehne chahiye.
  it.each([
    "clients",
    "jobs",
    "job_items",
    "bom_templates",
    "bom_template_items",
    "office_settings",
    "staff_geofence_permit",
    "users",
  ])("%s /messages par bhi exempt NAHI", (t) => {
    expect(isMessagingTableExempt(t)).toBe(false);
  });
});

describe("table exemption route-scoped hai (sirf /messages par)", () => {
  it.each(["/dashboard", "/clients", "/users", "/settings"])(
    "%s par messages table bhi exempt nahi",
    (path) => {
      at(path);
      expect(isMessagingTableExempt("messages")).toBe(false);
      expect(isMessagingTableExempt("user_presence")).toBe(false);
    }
  );
});

describe("isMessagingStorageExempt — sirf `media` bucket", () => {
  it("media bucket /messages par exempt", () => {
    at("/messages");
    expect(isMessagingStorageExempt("media")).toBe(true);
  });

  it.each(["avatars", "job-photos", "client-photos", "products", "spare-photos"])(
    "%s bucket exempt nahi",
    (b) => {
      at("/messages");
      expect(isMessagingStorageExempt(b)).toBe(false);
    }
  );

  it("media bucket bhi /clients par exempt nahi", () => {
    at("/clients");
    expect(isMessagingStorageExempt("media")).toBe(false);
  });
});

describe("isMessagingApiExempt — sirf messaging routes", () => {
  beforeEach(() => at("/messages"));

  it.each([
    "/api/messages/push",
    "/api/media/delete",
  ])("%s exempt hai", (u) => {
    expect(isMessagingApiExempt(u)).toBe(true);
  });

  it("absolute Supabase-origin URL bhi exempt (URL parse hota hai)", () => {
    expect(isMessagingApiExempt("https://proj.supabase.co/api/messages/push")).toBe(true);
  });

  // ── Inse koi bhi write bahar staff se nahi chalna chahiye.
  it.each([
    "/api/locations",
    "/api/manage",
    "/api/bom-templates",
    "/api/bom-templates/12",
    "/api/settings/signature",
    "/api/client-photo",
    "/api/user-avatar",
    "/api/media/other", // /api/media/ ke baad "delete" ke alawa kuch
  ])("%s exempt NAHI", (u) => {
    expect(isMessagingApiExempt(u)).toBe(false);
  });

  it("/clients page par /api/media/delete bhi exempt nahi", () => {
    at("/clients");
    expect(isMessagingApiExempt("/api/media/delete")).toBe(false);
  });
});
