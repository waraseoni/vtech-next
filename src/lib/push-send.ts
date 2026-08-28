import webPush from "web-push";
import { createClient } from "@supabase/supabase-js";

// ─── Server-side Push Notification Sender (100% Free — VAPID) ──────────────
// VAPID keys generate karo: npx web-push generate-vapid-keys
// Env vars set karo:
//   VAPID_PUBLIC_KEY  = browser ko deta hai (push.ts me use hota hai)
//   VAPID_PRIVATE_KEY = sirf server par (yahan use hota hai)
//   VAPID_EMAIL       = mailto:admin@yourdomain.com (optional but recommended)

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:admin@vtech.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export function isPushConfigured() {
  return !!VAPID_PUBLIC_KEY && !!VAPID_PRIVATE_KEY;
}

export type PushPayload = {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string; // notification click par navigate
  tag?: string; // same tag = browser ek hi notification dikhata hai
  data?: Record<string, unknown>;
};

type SendResult = { sent: number; failed: number; errors: string[] };

/** Ek user ko push bhejo (saare uske devices par). */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<SendResult> {
  if (!isPushConfigured()) {
    return { sent: 0, failed: 0, errors: ["VAPID keys configured nahi hain"] };
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: subs, error } = await sb
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId)
    .eq("enabled", true);

  if (error || !subs?.length) {
    return { sent: 0, failed: 0, errors: [error?.message || "No subscriptions found"] };
  }

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/icons/icon-192x192.png",
    badge: payload.badge || "/icons/icon-192x192.png",
    tag: payload.tag || "vtech-notification",
    url: payload.url || "/dashboard",
    data: payload.data || {},
  });

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Har subscription par send karo (parallel)
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notificationPayload
        );
        sent++;
      } catch (err: unknown) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        // 404/410 = subscription expired → delete karo
        if (
          msg.includes("404") ||
          msg.includes("410") ||
          msg.includes("Not Found") ||
          msg.includes("Gone")
        ) {
          await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
        errors.push(msg.slice(0, 200));
      }
    })
  );

  return { sent, failed, errors };
}

/** Saare enabled users ko push bhejo (broadcast). */
export async function sendPushToAll(payload: PushPayload): Promise<SendResult> {
  if (!isPushConfigured()) {
    return { sent: 0, failed: 0, errors: ["VAPID keys configured nahi hain"] };
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: subs, error } = await sb
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("enabled", true);

  if (error || !subs?.length) {
    return { sent: 0, failed: 0, errors: [error?.message || "No subscriptions found"] };
  }

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/icons/icon-192x192.png",
    badge: payload.badge || "/icons/icon-192x192.png",
    tag: payload.tag || "vtech-notification",
    url: payload.url || "/dashboard",
    data: payload.data || {},
  });

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notificationPayload
        );
        sent++;
      } catch (err: unknown) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("404") || msg.includes("410")) {
          await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
        errors.push(msg.slice(0, 200));
      }
    })
  );

  return { sent, failed, errors };
}

/** Specific users ko bhejo (user IDs array). */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<SendResult> {
  if (!isPushConfigured()) {
    return { sent: 0, failed: 0, errors: ["VAPID keys configured nahi hain"] };
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: subs, error } = await sb
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", userIds)
    .eq("enabled", true);

  if (error || !subs?.length) {
    return { sent: 0, failed: 0, errors: [error?.message || "No subscriptions found"] };
  }

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/icons/icon-192x192.png",
    badge: payload.badge || "/icons/icon-192x192.png",
    tag: payload.tag || "vtech-notification",
    url: payload.url || "/dashboard",
    data: payload.data || {},
  });

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notificationPayload
        );
        sent++;
      } catch (err: unknown) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("404") || msg.includes("410")) {
          await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
        errors.push(msg.slice(0, 200));
      }
    })
  );

  return { sent, failed, errors };
}
