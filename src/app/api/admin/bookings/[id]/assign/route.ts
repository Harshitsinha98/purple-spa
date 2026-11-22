import { after, NextResponse } from "next/server";
import { z } from "zod";
import { check, handle, HttpError, requireCaller } from "@/lib/server/caller";
import { notifyAssigned } from "@/lib/server/notify";
import type { Booking } from "@/lib/types";

const Body = z.object({ employeeId: z.uuid().nullable() });

/** Admin assigns a therapist, or passes null to let the system pick the best free one. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/admin/bookings/[id]/assign">) => {
  const { id } = await ctx.params;
  const caller = await requireCaller(["admin"]);
  const { employeeId } = Body.parse(await req.json());
  const booking = (employeeId
    ? check(await caller.db.rpc("assign_employee", { p_booking: id, p_employee: employeeId, p_actor: caller.id }))
    : check(await caller.db.rpc("auto_assign", { p_booking: id }))) as Booking;
  if (!booking.employee_id) throw new HttpError(409, "No qualified therapist is free at this time");
  after(() => notifyAssigned(booking.id));
  return NextResponse.json({ booking });
});
