"use client";

import { useEffect, useState } from "react";
import { fmtClock } from "@/lib/format";
import type { Locale } from "@/lib/i18n/dictionaries";
import type { Settings } from "@/lib/types";

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Whether the spa is open right now (spa time zone). null until mounted, so server and client render the same. */
export function useOpenStatus(s: Pick<Settings, "open_time" | "close_time">, locale: Locale) {
  const [state, setState] = useState<{ open: boolean; next: string } | null>(null);
  useEffect(() => {
    const tick = () => {
      const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date()).split(":").map(Number);
      const now = h * 60 + m;
      const open = now >= toMin(s.open_time) && now < toMin(s.close_time);
      setState({ open, next: fmtClock(open ? s.close_time : s.open_time, locale) });
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [s.open_time, s.close_time, locale]);
  return state;
}
