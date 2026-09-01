"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase, invalidateCachedUser } from "@/lib/supabase";
import {
  IDLE_MS,
  WARN_BEFORE_MS,
  REVOKED_CHECK_MS,
  REVOKED_401_TOLERANCE,
  LAST_ACTIVE_KEY,
} from "@/lib/session-policy";
import type { LicenseStatus } from "@/lib/license";
import { logger } from "@/lib/logger";
import { initPresence, cleanupPresence } from "@/lib/presence";
import { initNativeBridge } from "@/lib/nativePrint";

/**
 * useAppBoot — RootClient (app shell) ka saara auth/boot state + effects.
 * G1 gate-split: ye hook auth/boot logic ko shell render se alag karta hai taaki
 * server-component migration ke liye clean seam bane. Behavior ko kisi bhi tarah
 * change NAHI karta — sirf mechanical extraction.
 *
 * IMPORTANT: raw supabase.auth.getUser() yahan preserved hai (6s timeout + retry)
 * — intentional, isse kabhi hatao nahi. Boot-guard/watchdog/idle-eviction bhi
 * preserve hain.
 */
export function useAppBoot() {
  const pathname = usePathname();
  const router = useRouter();

  // BUG FIX 1: null prevents SSR↔client hydration mismatch.
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{
    full_name: string;
    role: string;
    avatar_url?: string | null;
  } | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  // themePref: user ki choice — "system" (OS ke saath), "dark" ya "light".
  // theme: USED/resolved theme (hamesha "dark" ya "light") jo CSS/UI ko milta hai.
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [themePref, setThemePrefState] = useState<"system" | "dark" | "light">("dark");
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [showIdleWarning, setShowIdleWarning] = useState(false);

  const lastActiveRef = useRef(Date.now());
  const showIdleWarningRef = useRef(false);
  const initialLicenseFetch = useRef(true);

  const refreshLicense = useCallback(async (force = false) => {
    try {
      const url = force ? "/api/license/status?force=true" : "/api/license/status";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        setLicense(null);
        return;
      }
      setLicense(await res.json());
    } catch {
      setLicense(null);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    cleanupPresence();
    await supabase.auth.signOut();
    invalidateCachedUser();
    // Intentional full reload: RootClient ke stale in-memory state ko puri tarah reset karta hai
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }, []);

  // BUG FIX 2: Auth runs ONCE on mount — NOT on pathname change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Android (Capacitor) me print/export natively kaam karne ke liye global
      // bridge — window.print + window.open(/api/print-*) ko intercept karta hai.
      initNativeBridge();
      try {
        const PUBLIC_PAGES = [
          "/",
          "/about",
          "/contact",
          "/job-status",
          "/login",
          "/setup",
          "/stage-lighting",
          "/industrial",
          "/power-supply",
        ];
        const isPublicPage = PUBLIC_PAGES.some(
          (p) => pathname === p || pathname.startsWith(p + "/")
        );

        // BUG FIX: getUser() kabhi-kabhi network par hang ho jata hai → "V-TECH
        // Secure Boot" loader hamesha ke liye atak jata tha. 6s timeout + EK
        // retry: pehle sirf ek 6s race thi — slow network par valid session
        // bhi "not logged in" samajh kar /login par chala jata tha.
        const AUTH_TIMEOUT_MS = 6000;
        const TIMED_OUT = Symbol("auth-timeout");
        const getUserWithTimeout = () =>
          Promise.race([
            supabase.auth.getUser(),
            new Promise<typeof TIMED_OUT>((resolve) =>
              setTimeout(() => resolve(TIMED_OUT), AUTH_TIMEOUT_MS)
            ),
          ]);
        let authResult = await getUserWithTimeout();
        if (authResult === TIMED_OUT) authResult = await getUserWithTimeout(); // ek retry
        const user = authResult === TIMED_OUT ? null : authResult.data.user;
        if (cancelled) return;
        if (!user) {
          if (!isPublicPage) router.push("/login");
          setLoading(false);
          return;
        }
        setUserEmail(user.email ?? null);
        const { data: pd } = await supabase
          .from("profiles")
          .select("full_name, role, avatar_url")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;
        setProfile({
          full_name:
            pd?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
          role: pd?.role || "staff",
          avatar_url: pd?.avatar_url || null,
        });

        // Presence: login par "online" mark + heartbeat (chat/status ke liye).
        if (!isPublicPage) initPresence(user.id);

        // Auto-subscribe push notifications (fire-and-forget).
        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          "serviceWorker" in navigator
        ) {
          const perm = Notification.permission;
          if (perm === "granted") {
            import("@/lib/push").then((m) => m.subscribeToPush()).catch(() => {});
          } else if (perm === "default" && !localStorage.getItem("vtech_push_prompted")) {
            localStorage.setItem("vtech_push_prompted", "1");
            Notification.requestPermission()
              .then((p) => {
                if (p === "granted")
                  import("@/lib/push").then((m) => m.subscribeToPush()).catch(() => {});
              })
              .catch(() => {});
          }
        }
      } catch (e) {
        logger.error("Auth error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← empty deps: intentional, auth only on mount

  // Brand logo — pehle native app first-run setup se (Capacitor plugin), warna DB se.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let resolvedLogo: string | null = null;
      try {
      // Android app me: first-run setup screen se chuna gayi logo file/URL.
      type VTechPlugin = { getLogo?: () => Promise<{ logo?: string }> };
      type CapGlobal = {
        isNativePlatform?: () => boolean;
        Plugins?: { VTechBrand?: VTechPlugin };
      };
      const cap = (window as unknown as { Capacitor?: CapGlobal }).Capacitor;
      const isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
      if (isNative) {
        try {
          const plugin = cap?.Plugins?.VTechBrand;
          if (plugin && typeof plugin.getLogo === "function") {
            const res = await plugin.getLogo();
            const val = res?.logo ?? "";
            if (val) resolvedLogo = String(val);
          }
        } catch {
          /* plugin call fail → industry DB me fallback */
        }
      }
      } catch {
        /* ignore */
      }

      if (cancelled) return;
      if (resolvedLogo) {
        setBrandLogo(resolvedLogo);
        return;
      }

      try {
        const { data } = await supabase
          .from("system_info")
          .select("meta_value")
          .eq("meta_field", "logo")
          .maybeSingle();
        if (!cancelled && data?.meta_value) setBrandLogo(String(data.meta_value));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // BUG FIX: Boot-guard inline script ko signal — React mount/hydrate ho gaya.
  useEffect(() => {
    try {
      (window as unknown as { __VTECH_BOOTED__: boolean }).__VTECH_BOOTED__ = true;
    } catch {
      /* ignore */
    }
  }, []);

  // BUG FIX: loader (V-TECH Secure Boot) atak jata hai jab stale SW cache purana
  // HTML/chunk serve karta hai ya auth call hang ho jati hai. 6s tak atka → auto reload.
  // `vtech_manual_refresh` flag (hardRefresh se) set ho to cooldown bypass karte hain —
  // user ne deliberately refresh kiya hai, isse roka nahi jaata.
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => {
      try {
        let manual = false;
        try {
          const m = Number(sessionStorage.getItem("vtech_manual_refresh") || "0");
          if (Date.now() - m < 15000) {
            manual = true;
            sessionStorage.removeItem("vtech_manual_refresh");
          }
        } catch {
          /* ignore */
        }
        if (!manual) {
          const k = "vtech_boot_reloaded";
          const last = Number(sessionStorage.getItem(k) || "0");
          if (Date.now() - last < 30000) return; // 30s cooldown — loop guard
          sessionStorage.setItem(k, String(Date.now()));
        }
      } catch {
        /* ignore */
      }
      window.location.reload();
    }, 6000);
    return () => clearTimeout(t);
  }, [loading]);

  // BUG FIX: Next.js kabhi-kabhi chunk load fail hone par router stuck chhod deta
  // hai. Chunk error → cooldown ke saath auto hard reload.
  useEffect(() => {
    const reloadWithCooldown = () => {
      try {
        const k = "vtech_chunk_reload";
        const last = Number(sessionStorage.getItem(k) || "0");
        if (Date.now() - last < 30000) return;
        sessionStorage.setItem(k, String(Date.now()));
      } catch {
        /* ignore */
      }
      window.location.reload();
    };

    const onErr = (e: ErrorEvent) => {
      const m = e.message || "";
      if (
        /Failed to fetch dynamically imported module|ChunkLoadError|loading chunk|Importing a module script failed/i.test(
          m
        )
      ) {
        reloadWithCooldown();
        return;
      }
      if (e.target instanceof HTMLScriptElement) {
        reloadWithCooldown();
        return;
      }
      if (e.target instanceof HTMLLinkElement) {
        const rel = e.target.rel || "";
        if (/stylesheet|modulepreload/i.test(rel)) reloadWithCooldown();
      }
    };
    window.addEventListener("error", onErr, true);
    return () => window.removeEventListener("error", onErr, true);
  }, []);

  // Client role → sirf /my-account/* access.
  useEffect(() => {
    if (profile?.role === "client" && !pathname.startsWith("/my-account")) {
      router.replace("/my-account");
    }
  }, [profile?.role, pathname, router]);

  // LICENSE GATE: profile milne ke baad non-public page par license status fetch.
  useEffect(() => {
    if (!profile) return;
    const pub =
      pathname === "/" ||
      [
        "/login",
        "/about",
        "/contact",
        "/job-status",
        "/stage-lighting",
        "/industrial",
        "/power-supply",
      ].some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (pub) return;
    const isFirst = initialLicenseFetch.current;
    if (isFirst) initialLicenseFetch.current = false;
    refreshLicense(isFirst);
  }, [profile, pathname, refreshLicense]);

  // ── Client portal revoked-access check ─────────────────────────────────
  const forceClientLogout = useCallback(async (reason: "revoked" | "idle") => {
    try {
      await supabase.auth.signOut();
      invalidateCachedUser();
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login?reason=" + reason;
  }, []);

  useEffect(() => {
    if (profile?.role !== "client") return;
    let cancelled = false;
    let strikes = 0;
    const check = async () => {
      try {
        const res = await fetch("/api/client/me", { cache: "no-store" });
        if (res.status === 401) {
          strikes += 1;
          if (strikes >= REVOKED_401_TOLERANCE && !cancelled) forceClientLogout("revoked");
        } else {
          strikes = 0;
        }
      } catch {
        /* network glitch ≠ revoke */
      }
    };
    check();
    const interval = setInterval(check, REVOKED_CHECK_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [profile?.role, forceClientLogout]);

  // ── UNIFIED IDLE TIMEOUT — sab roles ke liye EK hi mechanism ────────────
  useEffect(() => {
    if (!profile?.role) return;

    let lastWrite = 0;
    const resetTimer = () => {
      lastActiveRef.current = Date.now();
      if (showIdleWarningRef.current) {
        showIdleWarningRef.current = false;
        setShowIdleWarning(false);
      }
      const now = Date.now();
      if (now - lastWrite > 5000) {
        lastWrite = now;
        try {
          localStorage.setItem(LAST_ACTIVE_KEY, String(now));
        } catch {
          /* ignore */
        }
      }
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key !== LAST_ACTIVE_KEY || !e.newValue) return;
      lastActiveRef.current = Number(e.newValue) || lastActiveRef.current;
    };

    const evaluate = () => {
      const elapsed = Date.now() - lastActiveRef.current;
      if (elapsed >= IDLE_MS) {
        supabase.auth.signOut().catch(() => {});
        invalidateCachedUser();
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login?reason=idle";
      } else if (elapsed >= IDLE_MS - WARN_BEFORE_MS && !showIdleWarningRef.current) {
        showIdleWarningRef.current = true;
        setShowIdleWarning(true);
      }
    };

    const onVisible = () => {
      if (!document.hidden) evaluate();
    };

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "keydown",
      "touchstart",
      "click",
      "scroll",
    ];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("storage", onStorage);
    resetTimer();

    const interval = setInterval(evaluate, 10_000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("storage", onStorage);
      clearInterval(interval);
      showIdleWarningRef.current = false;
      setShowIdleWarning(false);
    };
  }, [profile?.role]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── THEME (3-way: system / dark / light) ─────────────────────────────────
  // localStorage me "vtech_theme" = "system" | "dark" | "light".
  // `resolveTheme(pref)` system ko OS (prefers-color-scheme) se resolve karta
  // hai; data-theme hamesha "dark"/"light" hi hota hai. CSS (dark: variant,
  // light overrides) isi binary attribute par depend karta hai.
  const systemDark = useRef(false);
  const isPublicRef = useRef(false);

  const applyTheme = useCallback((pref: "system" | "dark" | "light") => {
    try {
      const system = systemDark.current;
      const effective: "dark" | "light" =
        pref === "system" ? (system ? "dark" : "light") : pref;
      // public page hamesha dark-only hota hai (hardcoded design)
      const t = isPublicRef.current ? "dark" : effective;
      document.documentElement.setAttribute("data-theme", t);
      document.body.style.backgroundColor =
        isPublicRef.current ? "#070714" : t === "dark" ? "#0d1117" : "#f8f9fc";
      document.body.style.color = t === "dark" ? "#e2e8f0" : "#0f172a";
      setTheme(t);
      return t;
    } catch {
      document.documentElement.setAttribute("data-theme", "dark");
      return "dark";
    }
  }, []);

  // setThemePref — user ki choice save + apply karo
  const setThemePref = useCallback(
    (pref: "system" | "dark" | "light") => {
      setThemePrefState(pref);
      try {
        localStorage.setItem("vtech_theme", pref);
      } catch {
        // ignore
      }
      applyTheme(pref);
    },
    [applyTheme]
  );

  // toggleTheme — quick switch: current effective opposite (dark<->light).
  // Agar pref "system" hai to OS ke current effective ke opposite set karo.
  const toggleTheme = useCallback(() => {
    let pref: "system" | "dark" | "light" = "light";
    try {
      const saved = localStorage.getItem("vtech_theme");
      const effectiveNow =
        (document.documentElement.getAttribute("data-theme") as "dark" | "light") || "dark";
      const next = effectiveNow === "dark" ? "light" : "dark";
      pref = next;
      localStorage.setItem("vtech_theme", next);
    } catch {
      pref = "light";
    }
    setThemePrefState(pref);
    applyTheme(pref);
  }, [applyTheme]);

  // Init: systemDark ref + OS theme listener + initial apply
  useEffect(() => {
    try {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      systemDark.current = mq.matches;
      const onChange = (e: MediaQueryListEvent) => {
        systemDark.current = e.matches;
        // agar pref "system" hai to OS change par turant re-apply
        const saved = localStorage.getItem("vtech_theme");
        if (saved === "system") applyTheme("system");
      };
      mq.addEventListener("change", onChange);
      const saved = (localStorage.getItem("vtech_theme") as
        | "system"
        | "dark"
        | "light"
        | null) || "dark";
      setThemePrefState(saved);
      applyTheme(saved);
      return () => {
        try {
          mq.removeEventListener("change", onChange);
        } catch {
          // ignore
        }
      };
    } catch {
      applyTheme("dark");
    }
  }, [applyTheme]);

  // Pathname change: public-page flag update + re-apply
  useEffect(() => {
    const pub =
      pathname === "/" ||
      [
        "/login",
        "/setup",
        "/about",
        "/contact",
        "/job-status",
        "/stage-lighting",
        "/industrial",
        "/power-supply",
      ].some((p) => pathname === p || pathname.startsWith(p + "/"));
    isPublicRef.current = pub;
    try {
      const saved = (localStorage.getItem("vtech_theme") as
        | "system"
        | "dark"
        | "light"
        | null) || "dark";
      applyTheme(saved);
    } catch {
      applyTheme("dark");
    }
  }, [pathname, applyTheme]);


  // Auto-close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return {
    isMobile,
    loading,
    profile,
    userEmail,
    dropdownOpen,
    setDropdownOpen,
    drawerOpen,
    setDrawerOpen,
    aiDrawerOpen,
    setAiDrawerOpen,
    theme,
    themePref,
    setThemePref,
    license,
    brandLogo,
    showIdleWarning,
    setShowIdleWarning,
    lastActiveRef,
    showIdleWarningRef,
    refreshLicense,
    handleLogout,
    toggleTheme,
  };
}
