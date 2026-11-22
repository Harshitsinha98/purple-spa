import { after, NextResponse } from "next/server";
import { z } from "zod";
import { check, handle, requireCaller } from "@/lib/server/caller";
import { notifyCancelled } from "@/lib/server/notify";
import type { Booking } from "@/lib/types";

const Body = z.object({ reason: z.string().max(300).optional() });

/** Customer (within the cancellation window) or admin cancels. Refunds are handled by admin. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/bookings/[id]/cancel">) => {
  const { id } = await ctx.params;
  const caller = await requireCaller();
  const { reason } = Body.parse(await req.json().catch(() => ({})));
  const { data: before } = await caller.db.from("bookings").select("employee_id").eq("id", id).maybeSingle();
  const booking = check(await caller.db.rpc("set_booking_status", { p_booking: id, p_status: "cancelled", p_reason: reason || "Cancelled" })) as Booking;
  after(() => notifyCancelled(booking.id, before?.employee_id ?? null));
  return NextResponse.json({ booking });
});
