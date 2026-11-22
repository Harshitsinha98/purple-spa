"use client";

import { useEffect, useState } from "react";

/** Current time in ms, refreshed every `everyMs`. Keeps render pure. */
export function useNow(everyMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
