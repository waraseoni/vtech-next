"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppTheme } from "./useAppTheme";
import { supabase, invalidateCachedUser } from "@/lib/supabase";
import {
  IDLE_MS,
  WARN_BEFORE_MS,
  IDLE_MINUTES,
  WARN_BEFORE_MIN,
  AUTO_LOGOUT_MINUTES_KEY,
  AUTO_LOGOUT_WARN_KEY,
  REVOKED_CHECK_MS,
  REVOKED_401_TOLERANCE,
  LAST_ACTIVE_KEY,
} from "@/lib/session-policy";
import type { LicenseStatus } from "@/lib/license";
import { logger } from "@/lib/logger";
import { initPresence, cleanupPresence } from "@/lib/presence";


/**
 * useAppBoot — RootClient (app shell) ka saara auth/boot state + effects.
 * G1 gate-split: ye hook auth/boot logic ko shell render se alag karta hai taaki
 * server-component migration ke liye clean seam bane.
 *
 * IMPORTANT: raw supabase.auth.getUser() yahan preserved hai (6s timeout + retry)
 * — intentional, isse kabhi hatao nahi. Boot-guard/watchdog/idle-eviction bhi
 * preserve hain.
 *
 * 2026-09-15 G1: `loading` → `authReady` reframe. Splash gate ab positive
 * semantics (`!authReady` = boot ho raha hai) — behavior unchanged, sirf
 * naam/meaning alag. Boot-guard 6s auto-reload bhi reverse ho gaya: jab tak
 * auth ready nahi, watchdog active.
 */
export function useAppBoot() {
  const pathname = usePathname();
  const router = useRouter();
  // THEME — alag hook (G1 split): useAppTheme.ts. Boot/auth se independent.
  const { theme, themePref, setThemePref, toggleTheme } = useAppTheme();

  // BUG FIX 1: null prevents SSR↔client hydration mismatch.
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<{
    full_name: string;
    role: string;
    avatar_url?: string | null;
  } | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  // Desktop sidebar collapse (icons-only). Sirf >=1024px viewport me use hota
  // hai; mobile drawer se independent. localStorage me persist ("1"/"0").
  const [sidebarCollapsed, setSidebarCollapsedRaw] = useState(false);
  // THEME (theme/themePref/setThemePref/toggleTheme) — useAppTheme hook se.
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  // Display ke liye resolved minutes (modal text) — runtime refs ka render-safe copy.
  const [idleLogoutMin, setIdleLogoutMin] = useState(IDLE_MINUTES);
  const [idleWarnMin, setIdleWarnMin] = useState(WARN_BEFORE_MIN);

  const lastActiveRef = useRef(Date.now());
  const showIdleWarningRef = useRef(false);
  const initialLicenseFetch = useRef(true);
  // Auto-logoff config — system_info se override hote hain (Settings > Auto Logoff).
  // Defaults session-policy.ts ke hain. `idleMsRef.current === 0` = Never (off).
  const idleMsRef = useRef<number>(IDLE_MS);
  const warnMsRef = useRef<number>(WARN_BEFORE_MS);

  // Dynamic session settings load karo (staff/admin/developer — login ke baad).
  useEffect(() => {
    if (!profile?.role) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("system_info")
          .select("meta_field, meta_value")
          .in("meta_field", [AUTO_LOGOUT_MINUTES_KEY, AUTO_LOGOUT_WARN_KEY]);
        if (cancelled || !data) return;
        const map: Record<string, string> = {};
        data.forEach((r) => (map[r.meta_field] = String(r.meta_value ?? "")));
        const idleMin = parseInt(map[AUTO_LOGOUT_MINUTES_KEY] || "", 10);
        if (Number.isFinite(idleMin) && idleMin >= 0) {
          idleMsRef.current = idleMin === 0 ? 0 : idleMin * 60 * 1000;
          setIdleLogoutMin(idleMin);
        }
        const warnMin = parseInt(map[AUTO_LOGOUT_WARN_KEY] || "", 10);
        if (Number.isFinite(warnMin) && warnMin > 0) {
          warnMsRef.current = warnMin * 60 * 1000;
          setIdleWarnMin(warnMin);
        }
      } catch {
        /* ignore — defaults hi rakhte hain */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.role]);

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
      // Dynamic import: nativePrint module (capgo printer, filesystem, share)
      // shell ke critical JS me NAHI khinchta. Web par module load hi nahi hota.
      try {
        if (/Android/i.test(navigator.userAgent)) {
          const { initNativeBridge } = await import("@/lib/nativePrint");
          initNativeBridge();
        }
      } catch {
        /* ignore — browser fallback chalta rahega */
      }
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

        // FAST PATH: getSession() storage se (network ke bina) turant session
        // deta hai. Session hai → shell turant render (spinner 6s tak nahi
        // atakta); getUser() validation + profile fetch NICHE background me
        // chalta hai. Session nahi → turant /login. RLS har query ko protect
        // karta hai, isliye shell pehle dikhana safe hai.
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!session) {
          if (!isPublicPage) router.push("/login");
          setAuthReady(true);
          return;
        }
        setUserEmail(session.user.email ?? null);
        setAuthReady(true); // shell itni der me dikh jata hai — data background

        // PERF (lightning A2): profile fetch PEHLE se getUser validation ke
        // saath PARALLEL chalao. Pehle ye SERIAL tha (getUser RTT → uske baad
        // profile RTT) — role-based shell (sidebar naam, admin guards, module
        // filter) ek extra RTT late render hota tha. Session id se profile read
        // safe hai (RLS protect karta hai); validation fail par waise bhi
        // signOut + /login hota hai. Supabase client promise reject nahi karta,
        // isliye early-return par bhi unhandled rejection nahi.
        const profileFetch = supabase
          .from("profiles")
          .select("full_name, role, avatar_url")
          .eq("id", session.user.id)
          .maybeSingle();

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
          // Local session hai par server validation fail (revoked/expired) →
          // signOut + /login. Sirf TIMED_OUT (network atak gaya) par user ko
          // tabah NAHI karte — shell RLS-gated hai, agle load par validate hoga.
          if (authResult !== TIMED_OUT) {
            await supabase.auth.signOut();
            invalidateCachedUser();
            if (!isPublicPage) router.push("/login");
          }
          return;
        }
        const { data: pd } = await profileFetch;
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
        if (!cancelled) setAuthReady(true);
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
    if (authReady) return;
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
  }, [authReady]);

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
      const idleMs = idleMsRef.current;
      if (idleMs <= 0) return; // "Never" — auto logout off
      const elapsed = Date.now() - lastActiveRef.current;
      if (elapsed >= idleMs) {
        supabase.auth.signOut().catch(() => {});
        invalidateCachedUser();
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login?reason=idle";
      } else if (elapsed >= idleMs - warnMsRef.current && !showIdleWarningRef.current) {
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

  // Desktop sidebar collapse ke liye persistence (theme "vtech_theme" jaisa hi
  // pattern). Init sirf mount par read karta hai; writes toggle/set ke through.
  useEffect(() => {
    try {
      if (localStorage.getItem("vtech_sidebar_collapsed") === "1") {
        setSidebarCollapsedRaw(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const setSidebarCollapsed = useCallback((v: boolean) => {
    setSidebarCollapsedRaw(v);
    try {
      localStorage.setItem("vtech_sidebar_collapsed", v ? "1" : "0");
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebarCollapse = useCallback(() => {
    setSidebarCollapsedRaw((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("vtech_sidebar_collapsed", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // ── THEME ─────────────────────────────────────────────────────────────────
  // G1 split (2026-09-15): theme state/effects ab `useAppTheme` me (top par
  // composed). localStorage "vtech_theme" + data-theme apply etc. wahan.

  // Auto-close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return {
    isMobile,
    authReady,
    profile,
    userEmail,
    dropdownOpen,
    setDropdownOpen,
    drawerOpen,
    setDrawerOpen,
    aiDrawerOpen,
    setAiDrawerOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebarCollapse,
    theme,
    themePref,
    setThemePref,
    license,
    brandLogo,
    showIdleWarning,
    setShowIdleWarning,
    lastActiveRef,
    showIdleWarningRef,
    idleMsRef,
    warnMsRef,
    idleLogoutMin,
    idleWarnMin,
    refreshLicense,
    handleLogout,
    toggleTheme,
  };
}
