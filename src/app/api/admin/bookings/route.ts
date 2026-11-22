import { after, NextResponse } from "next/server";
import { z } from "zod";
import { check, handle, HttpError, requireCaller } from "@/lib/server/caller";
import { afterConfirmed } from "@/lib/server/booking-flow";
import type { Booking } from "@/lib/types";

const Body = z.object({
  variantIds: z.array(z.uuid()).min(1).max(5),
  start: z.iso.datetime({ offset: true }),
  gender: z.enum(["any", "female", "male"]),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^\+?[0-9]{10,13}$/, "Enter a valid phone number"),
  notes: z.string().max(500).optional(),
});

/** Admin adds a phone / walk-in booking. Payment is collected at the counter. */
export const POST = handle(async (req: Request) => {
  const caller = await requireCaller(["admin"]);
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid booking details");
  const b = parsed.data;
  const booking = check(
    await caller.db.rpc("create_booking", {
      p_variant_ids: b.variantIds,
      p_start: b.start,
      p_gender: b.gender,
      p_payment_mode: "pay_at_spa",
      p_name: b.name,
      p_phone: b.phone,
      p_notes: b.notes ?? null,
      p_source: "admin",
      p_customer: null,
    }),
  ) as Booking;
  after(() => afterConfirmed(booking.id));
  return NextResponse.json({ booking });
});
