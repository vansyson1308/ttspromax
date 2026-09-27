"use client";

import { useEffect, useState } from "react";

/** useState backed by localStorage (read after mount to stay SSR-safe). */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* storage unavailable or corrupt — keep default */
    }
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota / private mode */
    }
  }, [key, value, loaded]);

  return [value, setValue] as const;
}
