"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/env";
import type { Profile } from "@/lib/types";

export type SessionState = { loading: boolean; user: User | null; profile: Profile | null };

/** Current Supabase user + profile row (role lives on the profile). Updates on sign-in/out. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ loading: supabaseConfigured, user: null, profile: null });

  useEffect(() => {
    if (!supabaseConfigured) return;
    const db = supabaseBrowser();
    let alive = true;

    const load = async (user: User | null) => {
      if (!user) {
        if (alive) setState({ loading: false, user: null, profile: null });
        return;
      }
      const { data } = await db.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (alive) setState({ loading: false, user, profile: (data as Profile) ?? null });
    };

    db.auth.getUser().then(({ data }) => load(data.user));
    const { data: sub } = db.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") load(session?.user ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
