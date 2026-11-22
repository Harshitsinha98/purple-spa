"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Booking } from "@/lib/types";

type Query = {
  /** Postgres-changes filter, e.g. `customer_id=eq.<uuid>`. RLS still decides what arrives. */
  filter?: string;
  from?: string;
  to?: string;
  enabled?: boolean;
  channel: string;
};

/**
 * Bookings (with items) that stay in sync through Supabase Realtime. Any change to a row the
 * user is allowed to see triggers a refetch of that row, so therapist assignment shows up live.
 */
export function useLiveBookings({ filter, from, to, enabled = true, channel }: Query) {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const db = supabaseBrowser();
    let q = db.from("bookings").select("*, booking_items(*)").order("start_at", { ascending: true });
    if (filter) {
      const [col, rest] = filter.split("=");
      const [, val] = rest.split(".");
      q = q.eq(col, val);
    }
    if (from) q = q.gte("start_at", from);
    if (to) q = q.lt("start_at", to);
    const { data, error } = await q.limit(500);
    if (error) setError(error.message);
    else setBookings(data as Booking[]);
  }, [filter, from, to]);

  useEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    load();
    const db = supabaseBrowser();
    const ch = db
      .channel(channel)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", ...(filter ? { filter } : {}) }, () => load())
      .subscribe();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      db.removeChannel(ch);
    };
  }, [channel, enabled, filter, load]);

  return { bookings, error, reload: load };
}
