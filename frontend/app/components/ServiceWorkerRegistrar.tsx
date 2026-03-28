"use client";

/**
 * Registers the service worker on mount.
 * Requirement: 9.2
 */

import { useEffect } from "react";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Silent fail — SW is a progressive enhancement
      });
    }
  }, []);

  return null;
}
