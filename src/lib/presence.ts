import { supabase } from "@/lib/supabase";

// ─── Online Presence Engine ────────────────────────────────────────────────
// `user_presence` table me har user ki status + last_seen rehti hai.
//   • initPresence(userId) → app boot par "online" mark + heartbeat.
//   • Heartbeat har x sec me last_seen update karta hai.
//   • pagehide / tab hidden → mark offline (ya last_seen stale ho jata hai).
//   • cleanupPresence() → logout par offline set karo.
//   • subscribePresence(cb) → live presence updates (realtime).
//
// Sab RLS-friendly: har user SIRF apni row likhta hai; staff sab padhta hai.
// ─────────────────────────────────────────────────────────────────────────────

const HEARTBEAT_MS = 30_000; // every 30s touch last_seen
const SUB_KEY = "vtech-presence-sub";

let currentUserId: string | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let unloadHandler: (() => void) | null = null;
let visHandler: (() => void) | null = null;
let sub: ReturnType<typeof supabase.channel> | null = null;

async function writeStatus(userId: string, status: "online" | "offline") {
  try {
    await supabase.from("user_presence").upsert(
      { user_id: userId, status, last_seen: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  } catch {
    // ignore — presence is best-effort
  }
}

async function setOffline() {
  if (!currentUserId) return;
  await writeStatus(currentUserId, "offline");
}

export function initPresence(userId: string) {
  if (currentUserId === userId) return;
  cleanupPresence();

  currentUserId = userId;
  // mark online (upsert = insert or update)
  void writeStatus(userId, "online");

  // heartbeat — last_seen ko fresh rakhta hai
  heartbeatTimer = setInterval(() => {
    if (currentUserId) void writeStatus(currentUserId, "online");
  }, HEARTBEAT_MS);

  // pagehide → offline (browser/app band ya navigate)
  unloadHandler = () => {
    void setOffline();
  };
  window.addEventListener("pagehide", unloadHandler);

  // tab background → offline (mobile/desktop dono)
  visHandler = () => {
    if (document.visibilityState === "hidden") {
      void setOffline();
    } else if (document.visibilityState === "visible" && currentUserId) {
      // wapas aa gaya — dobara online
      void writeStatus(currentUserId, "online");
    }
  };
  document.addEventListener("visibilitychange", visHandler);
}

export function cleanupPresence() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (unloadHandler) {
    window.removeEventListener("pagehide", unloadHandler);
    unloadHandler = null;
  }
  if (visHandler) {
    document.removeEventListener("visibilitychange", visHandler);
    visHandler = null;
  }
  if (currentUserId) {
    void setOffline();
  }
  currentUserId = null;
}

// Subscribe to realtime presence changes. cb(userId, row) ho call hota hai.
export function subscribePresence(
  cb: (userId: string, row: { status: string; last_seen: string }) => void
): { unsubscribe: () => void } {
  if (sub) return { unsubscribe: unsubscribePresence };
  sub = supabase
    .channel("vtech-presence")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "user_presence",
      },
      (payload) => {
        if (!payload.new) return;
        const row = payload.new as { user_id: string; status: string; last_seen: string };
        cb(row.user_id, row);
      }
    )
    .subscribe();
  return { unsubscribe: unsubscribePresence };
}

export function unsubscribePresence() {
  if (sub) {
    void supabase.removeChannel(sub);
    sub = null;
  }
}

export const PRESENCE_SUB_KEY = SUB_KEY;

export type PresenceTracker = ReturnType<typeof subscribePresence>;
