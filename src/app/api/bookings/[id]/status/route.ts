import { after, NextResponse } from "next/server";
import { z } from "zod";
import { check, handle, requireCaller } from "@/lib/server/caller";
import { notifyCompleted } from "@/lib/server/notify";
import type { Booking } from "@/lib/types";

const Body = z.object({ status: z.enum(["in_progress", "completed", "no_show", "confirmed"]), reason: z.string().max(300).optional() });

/** Therapist (own bookings) or admin moves a booking through the day. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/bookings/[id]/status">) => {
  const { id } = await ctx.params;
  const caller = await requireCaller(["employee", "admin"]);
  const { status, reason } = Body.parse(await req.json());
  const booking = check(await caller.db.rpc("set_booking_status", { p_booking: id, p_status: status, p_reason: reason ?? null })) as Booking;
  if (status === "completed") after(() => notifyCompleted(booking.id));
  return NextResponse.json({ booking });
});
