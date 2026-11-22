import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireCaller } from "@/lib/server/caller";
import { refundPayment } from "@/lib/server/booking-flow";

const Body = z.object({ reason: z.string().trim().min(2).max(200) });

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/admin/payments/[id]/refund">) => {
  const { id } = await ctx.params;
  await requireCaller(["admin"]);
  const { reason } = Body.parse(await req.json());
  const refundId = await refundPayment(id, reason);
  return NextResponse.json({ refundId });
});
