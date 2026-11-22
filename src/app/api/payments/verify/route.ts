import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, HttpError, requireCaller } from "@/lib/server/caller";
import { verifyCheckoutSignature } from "@/lib/server/razorpay";
import { capturePayment } from "@/lib/server/booking-flow";

const Body = z.object({
  razorpay_order_id: z.string().min(5),
  razorpay_payment_id: z.string().min(5),
  razorpay_signature: z.string().min(10),
});

/** Called by the browser after Razorpay Checkout succeeds. The signature proves the payment is genuine. */
export const POST = handle(async (req: Request) => {
  await requireCaller();
  const p = Body.parse(await req.json());
  if (!verifyCheckoutSignature(p.razorpay_order_id, p.razorpay_payment_id, p.razorpay_signature)) {
    throw new HttpError(400, "Payment could not be verified");
  }
  const { bookingId } = await capturePayment(p.razorpay_order_id, p.razorpay_payment_id);
  return NextResponse.json({ bookingId });
});
