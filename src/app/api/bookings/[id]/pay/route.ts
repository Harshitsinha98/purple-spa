import { NextResponse } from "next/server";
import { handle, HttpError, requireCaller } from "@/lib/server/caller";
import { razorpayConfigured } from "@/lib/server/razorpay";
import { createOrder } from "@/lib/server/booking-flow";
import type { Booking } from "@/lib/types";

/** Customer pays the outstanding amount online (retry after a failed payment, or the balance after an advance). */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/bookings/[id]/pay">) => {
  const { id } = await ctx.params;
  const caller = await requireCaller();
  if (!razorpayConfigured()) throw new HttpError(400, "Online payment is not available right now");
  const { data } = await caller.db.from("bookings").select("*").eq("id", id).maybeSingle();
  const b = data as Booking | null;
  if (!b || b.customer_id !== caller.id) throw new HttpError(404, "Booking not found");
  if (["cancelled", "completed", "no_show"].includes(b.status)) throw new HttpError(400, "This booking is closed");

  let amount: number;
  if (b.status === "pending_payment") {
    if (b.hold_expires_at && new Date(b.hold_expires_at) < new Date()) throw new HttpError(400, "The payment window has expired. Please book again.");
    amount = b.advance_amount - b.amount_paid;
  } else {
    amount = b.total_amount - b.amount_paid;
  }
  if (amount <= 0) throw new HttpError(400, "Nothing to pay");
  const order = await createOrder(b, amount);
  return NextResponse.json({ booking: b, order });
});
