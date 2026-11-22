import "server-only";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types";

export type Caller = {
  id: string;
  email: string;
  role: AppRole;
  db: Awaited<ReturnType<typeof supabaseServer>>;
};

/** Reads the signed-in user from cookies. Returns null when signed out. */
export async function getCaller(): Promise<Caller | null> {
  const db = await supabaseServer();
  const { data } = await db.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await db.from("profiles").select("role, email").eq("id", data.user.id).maybeSingle();
  return { id: data.user.id, email: profile?.email ?? data.user.email ?? "", role: (profile?.role as AppRole) ?? "customer", db };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireCaller(roles?: AppRole[]): Promise<Caller> {
  const c = await getCaller();
  if (!c) throw new HttpError(401, "Please sign in");
  if (roles && !roles.includes(c.role)) throw new HttpError(403, "Not allowed");
  return c;
}

/** Wraps a route handler: turns thrown errors (including Postgres RAISE messages) into JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      const msg = e instanceof Error ? e.message : "Something went wrong";
      console.error("[api]", e);
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  };
}

/** Supabase RPC errors carry the RAISE EXCEPTION text in `message`. */
export function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new HttpError(400, res.error.message);
  return res.data;
}
