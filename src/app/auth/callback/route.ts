import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Google OAuth lands here. Exchanges the code for a session and routes by role. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (!code) return NextResponse.redirect(`${origin}/login?error=1`);
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(`${origin}/login?error=1`);

  let dest = next;
  if (!dest) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
    dest = profile?.role === "admin" ? "/admin" : profile?.role === "employee" ? "/staff" : "/account";
  }
  return NextResponse.redirect(`${origin}${dest}`);
}

// Only allow same-site relative paths to avoid open redirects.
function safeNext(v: string | null) {
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return null;
  return v;
}
