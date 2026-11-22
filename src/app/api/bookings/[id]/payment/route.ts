import { after, NextResponse } from "next/server";
import { z } from "zod";
import { check, handle, requireCaller } from "@/lib/server/caller";
import { notifyPayment } from "@/lib/server/notify";
import type { Booking } from "@/lib/types";

const Body = z.object({ amount: z.number().positive().max(1_000_000), method: z.enum(["cash", "upi", "card"]), note: z.string().max(200).optional() });

/** Cash / UPI / card collected at the counter. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/bookings/[id]/payment">) => {
  const { id } = await ctx.params;
  const caller = await requireCaller(["employee", "admin"]);
  const { amount, method, note } = Body.parse(await req.json());
  const booking = check(await caller.db.rpc("record_offline_payment", { p_booking: id, p_amount: amount, p_method: method, p_note: note ?? null })) as Booking;
  after(() => notifyPayment(booking.id, amount));
  return NextResponse.json({ booking: { id: booking.id, status: booking.status, payment_status: booking.payment_status, amount_paid: booking.amount_paid } });
});
