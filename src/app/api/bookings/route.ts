import { after, NextResponse } from "next/server";
import { z } from "zod";
import { check, handle, HttpError, requireCaller } from "@/lib/server/caller";
import { razorpayConfigured } from "@/lib/server/razorpay";
import { afterConfirmed, createOrder } from "@/lib/server/booking-flow";
import type { Booking } from "@/lib/types";

const Body = z.object({
  variantIds: z.array(z.uuid()).min(1).max(5),
  start: z.iso.datetime({ offset: true }),
  gender: z.enum(["any", "female", "male"]),
  paymentMode: z.enum(["full", "partial", "pay_at_spa"]),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^\+?[0-9]{10,13}$/, "Enter a valid phone number"),
  notes: z.string().max(500).optional(),
});

/** Customer creates a booking. Prices and availability are checked inside Postgres. */
export const POST = handle(async (req: Request) => {
  const caller = await requireCaller();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid booking details");
  const b = parsed.data;
  if (b.paymentMode !== "pay_at_spa" && !razorpayConfigured()) throw new HttpError(400, "Online payment is not available right now");

  const booking = check(
    await caller.db.rpc("create_booking", {
      p_variant_ids: b.variantIds,
      p_start: b.start,
      p_gender: b.gender,
      p_payment_mode: b.paymentMode,
      p_name: b.name,
      p_phone: b.phone,
      p_notes: b.notes ?? null,
    }),
  ) as Booking;

  if (booking.status === "confirmed") {
    after(() => afterConfirmed(booking.id));
    return NextResponse.json({ booking });
  }

  const order = await createOrder(booking, booking.advance_amount);
  return NextResponse.json({ booking, order });
});
