import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/server/razorpay";
import { capturePayment } from "@/lib/server/booking-flow";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Razorpay webhook (backup for when the customer closes the tab before the browser callback).
 * Configure in Razorpay Dashboard → Webhooks with events: payment.captured, payment.failed.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature") ?? "";
  if (!verifyWebhookSignature(raw, sig)) return NextResponse.json({ error: "bad signature" }, { status: 400 });

  const event = JSON.parse(raw) as { event: string; payload?: { payment?: { entity?: { id: string; order_id: string } } } };
  const payment = event.payload?.payment?.entity;
  if (!payment?.order_id) return NextResponse.json({ ok: true });

  try {
    if (event.event === "payment.captured") {
      await capturePayment(payment.order_id, payment.id);
    } else if (event.event === "payment.failed") {
      await supabaseAdmin().from("payments").update({ status: "failed" }).eq("razorpay_order_id", payment.order_id).eq("status", "created");
    }
  } catch (e) {
    console.error("[razorpay webhook]", e);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
