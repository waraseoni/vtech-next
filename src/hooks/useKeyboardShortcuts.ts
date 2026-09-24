"use client";

import { useEffect, useCallback, useRef, useState } from "react";
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

  const shortcuts: Record<string, ShortcutAction> = {};
  if (config.dashboard) shortcuts["g d"] = { label: "Dashboard", href: config.dashboard };
  if (config.jobs) shortcuts["g j"] = { label: "Jobs", href: config.jobs };
  if (config.clients) shortcuts["g c"] = { label: "Clients", href: config.clients };
  if (config.sales) shortcuts["g s"] = { label: "Sales", href: config.sales };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if ((e.ctrlKey || e.metaKey) && e.key === "k") return;

      // g-prefix
      if (e.key === "g" && !e.ctrlKey && !e.metaKey && !e.altKey && !waitingForG.current) {
        e.preventDefault();
        waitingForG.current = true;
        setTimeout(() => { waitingForG.current = false; }, 2000);
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
