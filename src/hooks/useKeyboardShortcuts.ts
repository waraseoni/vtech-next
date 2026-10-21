"use client";

import { useEffect, useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface ShortcutAction {
  label: string;
  href: string;
}

interface ShortcutConfig {
  dashboard?: string;
  jobs?: string;
  clients?: string;
  sales?: string;
}

export function useKeyboardShortcuts(config: ShortcutConfig) {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const waitingForG = useRef(false);

  // useMemo: warna har render par nayi object → handleKeyDown identity badalti
  // rehti thi aur keydown listener baar-baar re-attach hota tha.
  const shortcuts = useMemo<Record<string, ShortcutAction>>(() => {
    const map: Record<string, ShortcutAction> = {};
    if (config.dashboard) map["g d"] = { label: "Dashboard", href: config.dashboard };
    if (config.jobs) map["g j"] = { label: "Jobs", href: config.jobs };
    if (config.clients) map["g c"] = { label: "Clients", href: config.clients };
    if (config.sales) map["g s"] = { label: "Sales", href: config.sales };
    return map;
  }, [config.dashboard, config.jobs, config.clients, config.sales]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if ((e.ctrlKey || e.metaKey) && e.key === "k") return;

      // g-prefix
      if (e.key === "g" && !e.ctrlKey && !e.metaKey && !e.altKey && !waitingForG.current) {
        e.preventDefault();
        waitingForG.current = true;
        setTimeout(() => {
          waitingForG.current = false;
        }, 2000);
        return;
      }

      if (waitingForG.current) {
        const combo = `g ${e.key}`;
        const action = shortcuts[combo];
        if (action) {
          e.preventDefault();
          router.push(action.href);
        }
        waitingForG.current = false;
        return;
      }

      if (e.key === "Escape") {
        if (helpOpen) {
          e.preventDefault();
          setHelpOpen(false);
        }
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((prev) => !prev);
      }
    },
    [helpOpen, shortcuts, router]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { helpOpen, setHelpOpen };
}
