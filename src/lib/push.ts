import { supabase, getCachedUser } from "./supabase";

/**
 * Web + Native (Android) Push subscription helper.
 *
 * Flow:
 *   - Native (Capacitor/Android) ho to @capacitor/push-notifications se FCM
 *     token register karo aur `push_subscriptions` me upsert karo
 *     (endpoint = "fcm:<token>"). Push delivery FCM se hoti hai.
 *   - Browser par PushManager + service worker ready ho to subscribe() karo
 *     (VAPID public key naya env / system_info se milta hai).
 *   - Subscription JSON ko `push_subscriptions` table me upsert karo
 *     (user_id = current auth user ka profile UUID).
 *   - Unsubscribe / disable par table me se delete ya enabled=false karo.
 *
 * Notes:
 *   - VAPID public key production deploy par environment se aata hai
 *     (NEXT_PUBLIC_VAPID_PUBLIC_KEY). Browser me set nahi ho to "unavailable".
 *   - Native push require karta hai: Firebase google-services.json (android/app)
 *     + server-side FCM service account (firebase-admin). Dono ke bina native
 *     token milega par delivery nahi hogi.
 */

export type PushResult =
  | { ok: true; mode: "subscribed" | "disabled" | "unsupported" | "denied" }
  | { ok: false; error: string };

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

// Kapasar native runtime detect karo (Android app, not browser).
function isNative(): boolean {
  if (typeof window === "undefined") return false;
  // @ts-expect-error Capacitor global browser runtime par plug karta hai
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

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
  // ── Native (Capacitor/Android) path ────────────────────────────────────
  if (isNative()) {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== "granted") return { ok: true, mode: "denied" };

      // FCM token ka wait karo — listener register() se pehle add hona chahiye
      const token = await new Promise<string>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("Timeout waiting for push token")), 10000);
        PushNotifications.addListener("registration", (data) => {
          clearTimeout(t);
          resolve(data.value);
        }).catch((err: unknown) => {
          clearTimeout(t);
          reject(err);
        });
        PushNotifications.register().catch((err: unknown) => {
          clearTimeout(t);
          reject(err);
        });
      });

      const userId = await currentUserId();
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint: `fcm:${token}`,
          p256dh: "",
          auth: "",
          enabled: true,
          device_name: `Android (${typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 60) : "App"})`,
        },
        { onConflict: "endpoint" }
      );

      if (error) return { ok: false, error: error.message };
      return { ok: true, mode: "subscribed" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ── Browser (web push) path ────────────────────────────────────────────
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
  // ── Native path ────────────────────────────────────────────────────────
  if (isNative()) {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      await PushNotifications.unregister();
      const userId = await currentUserId();
      if (userId) {
        // Is device ke FCM subscriptions delete karo
        const { error } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", userId)
          .eq("device_name", "Android");
        if (error) return { ok: false, error: error.message };
      }
      return { ok: true, mode: "disabled" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ── Browser path ───────────────────────────────────────────────────────
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
  const supported = isNative() || ("serviceWorker" in navigator && "PushManager" in window);
  let enabled = false;
  if (isNative()) {
    // Native me enabled tabhi hai jab table me is device ka FCM token ho.
    try {
      const userId = await currentUserId();
      if (userId) {
        const { data } = await supabase
          .from("push_subscriptions")
          .select("endpoint")
          .eq("user_id", userId)
          .eq("enabled", true)
          .eq("device_name", "Android");
        enabled = !!data?.length;
      }
    } catch {
      /* ignored */
    }
    return {
      supported,
      enabled,
      permission: "granted",
      vapidConfigured: !!VAPID_KEY,
    };
  }
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
