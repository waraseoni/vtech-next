"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * useAppTheme — 3-way theme (system / dark / light) + public-page dark lock.
 * G1 gate-split (2026-09-15): theme logic useAppBoot se bahar nikal ke apne
 * hook me. localStorage "vtech_theme" = "system" | "dark" | "light";
 * `resolveTheme(pref)` system ko OS (prefers-color-scheme) se resolve karta
 * hai; data-theme hamesha "dark"/"light" hi hota hai. CSS (dark: variant,
 * light overrides) isi binary attribute par depend karta hai.
 */
const PUBLIC_THEME_DARK = [
  "/",
  "/login",
  "/setup",
  "/about",
  "/contact",
  "/job-status",
  "/stage-lighting",
  "/industrial",
  "/power-supply",
];

export function useAppTheme() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [themePref, setThemePrefState] = useState<"system" | "dark" | "light">("dark");
  const systemDark = useRef(false);
  const isPublicRef = useRef(false);

  const applyTheme = useCallback((pref: "system" | "dark" | "light") => {
    try {
      const system = systemDark.current;
      const effective: "dark" | "light" = pref === "system" ? (system ? "dark" : "light") : pref;
      // public page hamesha dark-only hota hai (hardcoded design)
      const t = isPublicRef.current ? "dark" : effective;
      document.documentElement.setAttribute("data-theme", t);
      document.body.style.backgroundColor = isPublicRef.current
        ? "#070714"
        : t === "dark"
          ? "#0d1117"
          : "#f8f9fc";
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
      const saved =
        (localStorage.getItem("vtech_theme") as "system" | "dark" | "light" | null) || "dark";
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
    const pub = PUBLIC_THEME_DARK.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );
    isPublicRef.current = pub;
    try {
      const saved =
        (localStorage.getItem("vtech_theme") as "system" | "dark" | "light" | null) || "dark";
      applyTheme(saved);
    } catch {
      applyTheme("dark");
    }
  }, [pathname, applyTheme]);

  return { theme, themePref, setThemePref, toggleTheme };
}