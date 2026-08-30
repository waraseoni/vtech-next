import webPush from "web-push";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Messaging } from "firebase-admin/messaging";
import { getMessaging as fbGetMessaging } from "firebase-admin/messaging";
import { initializeApp, cert, getApps } from "firebase-admin";

// ─── Server-side Push Notification Sender (100% Free — VAPID + FCM) ─────────
// Browser (web) push → web-push VAPID.
// Android app push → Firebase Cloud Messaging (firebase-admin).
//
// FCM ke liye zaroori:
//   FIREBASE_SERVICE_ACCOUNT = Firebase Project → Project settings → Service
//     accounts → Generate new private key → JSON content (ya path)
//   Native token (`fcm:<token>`) wale subscriptions isi se bheje jate hain.
//
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

let messaging: Messaging | null = null;

function getMessaging(): Messaging | null {
  if (messaging) return messaging;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    if (!getApps().length) {
      initializeApp({
        credential:
          typeof raw === "string" && raw.trim().startsWith("{")
            ? cert(JSON.parse(raw))
            : cert(raw.trim()),
      });
    }
    messaging = fbGetMessaging();
    return messaging;
  } catch (err) {
    console.error("Firebase init failed:", err);
    return null;
  }
}

export function isPushConfigured() {
  return (
    (!!VAPID_PUBLIC_KEY && !!VAPID_PRIVATE_KEY) || !!process.env.FIREBASE_SERVICE_ACCOUNT
  );
}

type SubRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Ek subscription par akele send karo.
 * - endpoint "fcm:<token>" → Firebase Cloud Messaging (native Android)
 * - baaki (https webpush) → web-push VAPID
 * Returns: { status: "sent" | "failed" | "gone", message }
 * "gone" = subscription inactive (404/410 / FCM invalid-token) → delete karo.
 */
async function sendOne(sub: SubRow, payload: PushPayload): Promise<{
  status: "sent" | "failed" | "gone";
  message: string;
}> {
  // Native FCM token
  if (sub.endpoint.startsWith("fcm:")) {
    const fcm = getMessaging();
    if (!fcm) {
      return { status: "failed", message: "FCM not configured (FIREBASE_SERVICE_ACCOUNT missing)" };
    }
    const token = sub.endpoint.slice(4);
    try {
      await fcm.send({
        token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          url: payload.url || "/dashboard",
          tag: payload.tag || "vtech-notification",
        },
        android: {
          priority: "high",
          notification: {
            title: payload.title,
            body: payload.body,
            tag: payload.tag || "vtech-notification",
          },
        },
      });
      return { status: "sent", message: "" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("registration-token-not-registered") || msg.includes("unregistered") || msg.includes("NONEXISTENT")) {
        return { status: "gone", message: msg };
      }
      return { status: "failed", message: msg.slice(0, 200) };
    }
  }

  // Web push (VAPID)
  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/icons/icon-192x192.png",
    badge: payload.badge || "/icons/icon-192x192.png",
    tag: payload.tag || "vtech-notification",
    url: payload.url || "/dashboard",
    data: payload.data || {},
  });
  try {
    await webPush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      notificationPayload
    );
    return { status: "sent", message: "" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404") || msg.includes("410") || msg.includes("Not Found") || msg.includes("Gone")) {
      return { status: "gone", message: msg };
    }
    return { status: "failed", message: msg.slice(0, 200) };
  }
}

/**
 * Saare subs ko bhejo aur count/errors return karo.
 */
async function sendToSubs(
  subs: SubRow[],
  payload: PushPayload,
  sb: SupabaseClient
): Promise<SendResult> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  await Promise.allSettled(
    subs.map(async (sub) => {
      const r = await sendOne(sub, payload);
      if (r.status === "sent") sent++;
      else if (r.status === "gone") {
        // subscription inactive → delete karo
        await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      } else {
        failed++;
        errors.push(r.message);
      }
    })
  );
  return { sent, failed, errors };
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
    return { sent: 0, failed: 0, errors: ["Push configured nahi hain"] };
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

  return sendToSubs(subs, payload, sb);
}

/** Saare enabled users ko push bhejo (broadcast). */
export async function sendPushToAll(payload: PushPayload): Promise<SendResult> {
  if (!isPushConfigured()) {
    return { sent: 0, failed: 0, errors: ["Push configured nahi hain"] };
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

  return sendToSubs(subs, payload, sb);
}

/** Specific users ko bhejo (user IDs array). */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<SendResult> {
  if (!isPushConfigured()) {
    return { sent: 0, failed: 0, errors: ["Push configured nahi hain"] };
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

  return sendToSubs(subs, payload, sb);
}
