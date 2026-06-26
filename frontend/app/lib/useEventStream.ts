"use client";

import { useEffect, useRef } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5001";

/**
 * Subscribes to the backend SSE stream and calls `onUpdate` with the list of
 * affected scopes (e.g. ["published"], ["pending"]) whenever something changes.
 * EventSource reconnects automatically; the connection is closed on unmount.
 */
export function useEventStream(onUpdate: (scopes: string[]) => void) {
  const cb = useRef(onUpdate);
  cb.current = onUpdate;

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    const es = new EventSource(`${API_BASE}/api/stream`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (Array.isArray(data?.scopes)) cb.current(data.scopes);
      } catch {
        /* ignore malformed events */
      }
    };
    // On error EventSource will retry on its own; nothing to do here.
    return () => es.close();
  }, []);
}
