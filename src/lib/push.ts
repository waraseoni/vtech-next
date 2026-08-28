import { supabase, getCachedUser } from "./supabase";

/**
 * Web Push subscription helper.
 *
 * Flow:
 *   - Browser par PushManager + service worker ready ho to subscribe() karo
 *     (VAPID public key naya env / system_info se milta hai).
 *   - Subscription JSON ko `push_subscriptions` table me upsert karo
 *     (user_id = current auth user ka profile UUID).
 *   - Unsubscribe / disable par table me se delete ya enabled=false karo.
 *
 * Notes:
 *   - VAPID public key production deploy par environment se aata hai
 *     (NEXT_PUBLIC_VAPID_PUBLIC_KEY). Set nahi ho to function "unavailable"
 *     return karta hai — app crash nahi karta.
 */

export type PushResult =
  | { ok: true; mode: "subscribed" | "disabled" | "unsupported" | "denied" }
  | { ok: false; error: string };

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function base64UrlToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer instanceof ArrayBuffer ? new Uint8Array(arr.buffer) : arr;
}

async function currentUserId(): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await getCachedUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

export async function subscribeToPush(): Promise<PushResult> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: true, mode: "unsupported" };
  }
  if (!VAPID_KEY) {
    return { ok: false, error: "VAPID public key configured nahi hai. Settings me daalo." };
  }

  const perm = Notification?.permission;
  if (perm === "denied") return { ok: true, mode: "denied" };

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(VAPID_KEY),
    });

    const json = sub.toJSON();
    const userId = await currentUserId();

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh || "",
        auth: json.keys?.auth || "",
        enabled: true,
        device_name: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 120) : "",
      },
      { onConflict: "endpoint" }
    );

    if (error) return { ok: false, error: error.message };
    return { ok: true, mode: "subscribed" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function disablePush(): Promise<PushResult> {
  try {
    const userId = await currentUserId();
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();

    if (userId) {
      // Remove this device's subscription from the table.
      const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", userId);
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true, mode: "disabled" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function pushStatus(): Promise<{
  supported: boolean;
  enabled: boolean;
  permission: string;
  vapidConfigured: boolean;
}> {
  const supported = "serviceWorker" in navigator && "PushManager" in window;
  let enabled = false;
  if (supported && typeof navigator !== "undefined" && navigator.serviceWorker) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      enabled = !!sub;
    } catch {
      /* ignored */
    }
  }
  return {
    supported,
    enabled,
    permission: typeof Notification !== "undefined" ? Notification.permission : "unsupported",
    vapidConfigured: !!VAPID_KEY,
  };
}
