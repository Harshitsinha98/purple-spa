import { after, NextResponse } from "next/server";
import { z } from "zod";
import { check, handle, requireCaller } from "@/lib/server/caller";
import { notifyAssigned, notifyConfirmed } from "@/lib/server/notify";
import type { Booking } from "@/lib/types";

const Body = z.object({ start: z.iso.datetime({ offset: true }) });

/** Admin moves a booking. The customer gets the confirmation again with the new time. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/admin/bookings/[id]/reschedule">) => {
  const { id } = await ctx.params;
  const caller = await requireCaller(["admin"]);
  const { start } = Body.parse(await req.json());
  const booking = check(await caller.db.rpc("reschedule_booking", { p_booking: id, p_start: start })) as Booking;
  if (booking.status !== "pending_payment") {
    after(async () => {
      await notifyConfirmed(booking.id);
      if (booking.employee_id) await notifyAssigned(booking.id);
    });
  }
  return NextResponse.json({ booking });
});
