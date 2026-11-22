import "server-only";
import * as webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/admin";

let ready = false;
function configure() {
  if (ready) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:purplespasalon23@gmail.com", pub, priv);
  ready = true;
  return true;
}

export type PushPayload = { title: string; body: string; url: string; tag?: string };

/** Sends a push notification to every device a profile has registered. Dead subscriptions are removed. */
export async function pushToProfiles(profileIds: string[], payload: PushPayload) {
  if (!profileIds.length || !configure()) return;
  const db = supabaseAdmin();
  const { data } = await db.from("push_subscriptions").select("*").in("profile_id", profileIds);
  await Promise.all(
    (data ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600 });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
      }
    }),
  );
}

export async function adminProfileIds() {
  const { data } = await supabaseAdmin().from("profiles").select("id").eq("role", "admin");
  return (data ?? []).map((r) => r.id as string);
}
