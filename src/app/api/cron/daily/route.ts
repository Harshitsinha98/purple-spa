import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notifyReminder } from "@/lib/server/notify";
import { istDate } from "@/lib/format";

/**
 * Runs once a day from Vercel Cron (see vercel.json, 02:30 UTC = 8:00 AM IST):
 * releases unpaid holds and sends WhatsApp reminders for today's bookings.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = supabaseAdmin();
  const { data: expired } = await db.rpc("expire_unpaid_holds");

  const today = istDate(0);
  const from = new Date(`${today}T00:00:00+05:30`).toISOString();
  const to = new Date(`${today}T23:59:59+05:30`).toISOString();
  const { data: bookings } = await db
    .from("bookings")
    .select("*, booking_items(name_en)")
    .gte("start_at", from)
    .lte("start_at", to)
    .in("status", ["confirmed", "assigned"])
    .is("reminder_sent_at", null);

  let sent = 0;
  for (const b of bookings ?? []) {
    await notifyReminder(b);
    await db.from("bookings").update({ reminder_sent_at: new Date().toISOString() }).eq("id", b.id);
    sent++;
  }
  return NextResponse.json({ expired, reminders: sent });
}
