import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Toast browser-only hai — mock.
vi.mock("@/lib/toast", () => ({
  toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() },
  default: { warning: vi.fn() },
}));

// Supabase browser client env vars chahta hai + real network karta hai. Is
// module ka POORA purpose ye hai ki ek fake client Proxy se wrap ho — to fake
// ko `@supabase/ssr` se inject karke asli `lib/supabase.ts` (aur uska gate)
// test karte hain, mocking the mock nahi.
const mkBuilder = (table: string) => {
  const calls: string[] = [];
  const rec =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push(name);
      void args;
      return builder;
    };
  const builder: Record<string, unknown> = {
    select: rec("select"),
    insert: rec("insert"),
    update: rec("update"),
    upsert: rec("upsert"),
    delete: rec("delete"),
    eq: rec("eq"),
    order: rec("order"),
    single: rec("single"),
    maybeSingle: rec("maybeSingle"),
    then: (resolve: (v: unknown) => void) => resolve({ data: [{ id: 1, table }], error: null }),
  };
  return { builder, calls };
};

const tables = new Map<string, ReturnType<typeof mkBuilder>>();

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => ({
    from: (t: string) => {
      if (!tables.has(t)) tables.set(t, mkBuilder(t));
      return tables.get(t)!.builder;
    },
    rpc: (fn: string) => ({
      then: (resolve: (v: unknown) => void) => resolve({ data: fn === "read_only_rpc" ? 1 : 42, error: null }),
    }),
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } }, error: null }) },
    channel: () => ({ on: () => ({}), subscribe: () => ({}) }),
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: { path: "x" }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "u" } }),
      }),
    },
  }),
}));

import { supabase } from "./supabase";
import { resetWriteGuardState, setWriteGuardState } from "./writeGuard";

const open = () => resetWriteGuardState();
const lock = () => setWriteGuardState({ blocked: true, status: "outside", distanceM: 900 });

beforeEach(() => {
  tables.clear();
  open();
});

describe("supabase client proxy — reads ALWAYS allowed", () => {
  it("select() staff ke liye bhi chalta hai (bahar dekhna zaroori hai)", async () => {
    lock();
    const { data, error } = await supabase.from("transaction_list").select("*").eq("id", 1);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: 1, table: "transaction_list" }]);
  });

  it("auth kaUser chalta hai (login block nahi hona chahiye)", async () => {
    lock();
    const { data } = await supabase.auth.getUser();
    expect(data?.user?.id).toBe("u1");
  });

  it("storage getPublicUrl (read) allowed", () => {
    lock();
    expect(supabase.storage.from("photos").getPublicUrl("a.jpg").data.publicUrl).toBe("u");
  });
});

describe("supabase client proxy — writes BLOCKED jab staff bahar + no permit", () => {
  it("insert block + error.code", async () => {
    lock();
    const { error } = await supabase.from("clients").insert({ name: "X" });
    expect(error?.code).toBe("GEO_WRITE_BLOCKED");
  });

  it("update block", async () => {
    lock();
    const { error } = await supabase.from("payments").update({ amt: 0 }).eq("id", 1);
    expect(error?.code).toBe("GEO_WRITE_BLOCKED");
  });

  it("upsert block", async () => {
    lock();
    const { error } = await supabase.from("attendance_list").upsert({ status: 1 });
    expect(error?.code).toBe("GEO_WRITE_BLOCKED");
  });

  it("delete block", async () => {
    lock();
    const { error } = await supabase.from("messages").delete().eq("id", 3);
    expect(error?.code).toBe("GEO_WRITE_BLOCKED");
  });

  it("chained .insert().select().single() bhi block (call-site crash nahi)", async () => {
    lock();
    const { error } = await supabase.from("products").insert({ n: 1 }).select("id").single();
    expect(error?.code).toBe("GEO_WRITE_BLOCKED");
  });

  it("next_job_id RPC (read+increment WRITE) block", async () => {
    lock();
    const { error } = await supabase.rpc("next_job_id");
    expect(error?.code).toBe("GEO_WRITE_BLOCKED");
  });

  it("read-only RPCs ALLOWED — staff bahar bhi reports/inventory dekh sakta hai", async () => {
    lock();
    for (const fn of [
      "get_inventory_stock",
      "get_dashboard_stats",
      "get_monthly_revenue",
      "get_financial_summary",
      "get_technician_metrics",
      "get_clients_page_financials",
      "get_public_config",
      "check_license",
      "peek_next_job_id",
    ]) {
      const { error } = await supabase.rpc(fn);
      expect(error, `${fn} block ho gaya — read chahiye`).toBeNull();
    }
  });

  it("write RPCs block (default-deny: unknown RPC bhi)", async () => {
    lock();
    for (const fn of [
      "record_stocktake",
      "receive_po_receipt",
      "reset_sequence",
      "activate_license",
      "next_job_id",
      "some_brand_new_write_rpc",
    ]) {
      const { error } = await supabase.rpc(fn);
      expect(error?.code, `${fn} allow ho gaya`).toBe("GEO_WRITE_BLOCKED");
    }
  });

  it("storage upload block", async () => {
    lock();
    const r = (await supabase.storage.from("photos").upload("a.jpg", new Blob())) as {
      error?: { code?: string };
    };
    expect(r.error?.code).toBe("GEO_WRITE_BLOCKED");
  });

  it("koi unhandled throw nahi — sab `{ data: null, error }` resolve hota hai", async () => {
    lock();
    const results = await Promise.all([
      supabase.from("a").insert({}),
      supabase.from("b").update({}).eq("id", 1),
      supabase.from("c").delete().eq("id", 1),
    ]);
    for (const r of results) expect((r as { error: { code: string } }).error.code).toBe(
      "GEO_WRITE_BLOCKED"
    );
  });
});

describe("supabase client proxy — writes ALLOWED when gate open", () => {
  it("office ke andar: sab writes pahunchte hain", async () => {
    open();
    const { data, error } = await supabase.from("clients").insert({ name: "X" }).select();
    expect(error).toBeNull();
    expect(data).toEqual([{ id: 1, table: "clients" }]);
  });

  it("permit active (viewOnly=false) → writes allowed", async () => {
    setWriteGuardState({ blocked: false, status: "permit" });
    const { error } = await supabase.from("jobs").update({ status: "done" }).eq("id", 1);
    expect(error).toBeNull();
  });

  it("next_job_id RPC gate open par chalta hai", async () => {
    open();
    const { data, error } = await supabase.rpc("next_job_id");
    expect(error).toBeNull();
    expect(data).toBe(42);
  });
});

// ─── /messages exemption — end-to-end Proxy behaviour ──────────────────────
describe("supabase client proxy — /messages par messaging writes ALLOWED (staff bahar)", () => {
  beforeEach(() => {
    lock(); // staff office ke bahar, permit nahi
    window.history.pushState({}, "", "/messages");
  });
  afterEach(() => window.history.pushState({}, "", "/dashboard"));

  it("messages insert (message bhejna) chalega", async () => {
    const { data, error } = await supabase.from("messages").insert({ body: "hi" }).select();
    expect(error).toBeNull();
    expect(data).toEqual([{ id: 1, table: "messages" }]);
  });

  it("messages update (delivered_at / read_at) chalega", async () => {
    const { error } = await supabase.from("messages").update({ read_at: "now" }).eq("id", 1);
    expect(error).toBeNull();
  });

  it("user_presence upsert (online heartbeat) chalega", async () => {
    const { error } = await supabase.from("user_presence").upsert({ online: true });
    expect(error).toBeNull();
  });

  it("media bucket upload (message attachment) chalega", async () => {
    const r = (await supabase.storage.from("media").upload("a.jpg", new Blob())) as {
      error?: { code?: string };
    };
    expect(r.error?.code).toBeUndefined();
  });

  // ── SABSE IMPORTANT: exemption narrow rehni chahiye.
  it("clients/jobs AABHI bhi blocked hain (/messages khula hone par bhi)", async () => {
    const a = await supabase.from("clients").insert({ name: "X" });
    const b = await supabase.from("jobs").update({ status: "x" }).eq("id", 1);
    expect((a as { error: { code: string } }).error.code).toBe("GEO_WRITE_BLOCKED");
    expect((b as { error: { code: string } }).error.code).toBe("GEO_WRITE_BLOCKED");
  });

  it("non-media storage bucket bhi blocked (media hi exempt hai)", async () => {
    const r = (await supabase.storage.from("photos").upload("a.jpg", new Blob())) as {
      error?: { code?: string };
    };
    expect(r.error?.code).toBe("GEO_WRITE_BLOCKED");
  });

  it("write RPC bhi blocked (messaging RPC allow-list me nahi)", async () => {
    const { error } = await supabase.rpc("next_job_id");
    expect(error?.code).toBe("GEO_WRITE_BLOCKED");
  });

  // `save_direct_sale` direct-sale ka POORA write hai (parent + items, ek
  // transaction me). Ye /messages exception ke under NAHI aata — exception sirf
  // `messages`/`user_presence` tables aur 2 API routes tak hai, RPC nahi.
  it("save_direct_sale RPC staff ke liye bhi blocked (direct sale = business write)", async () => {
    const { error } = await supabase.rpc("save_direct_sale", { p_items: [] });
    expect(error?.code).toBe("GEO_WRITE_BLOCKED");
  });
});

describe("supabase client proxy — /messages kholne se kisi aur page ka gate nahi hilta", () => {
  it("/clients par messages table bhi blocked", async () => {
    lock();
    window.history.pushState({}, "", "/clients");
    const { error } = await supabase.from("messages").insert({ body: "hi" });
    expect(error?.code).toBe("GEO_WRITE_BLOCKED");
    window.history.pushState({}, "", "/dashboard");
  });
});
