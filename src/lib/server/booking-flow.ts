import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { razorpay, toPaise } from "./razorpay";
import { notifyAssigned, notifyConfirmed, notifyPayment } from "./notify";
import type { Booking, Settings } from "@/lib/types";

async function settings(): Promise<Settings> {
  const { data } = await supabaseAdmin().from("settings").select("*").eq("id", 1).single();
  return data as Settings;
}

/** After a booking becomes confirmed: try auto-assign (if enabled), then notify. */
export async function afterConfirmed(bookingId: string) {
  const s = await settings();
  let assigned = false;
  if (s.auto_assign) {
    const { data } = await supabaseAdmin().rpc("auto_assign", { p_booking: bookingId });
    assigned = Boolean((data as Booking | null)?.employee_id);
  }
  await notifyConfirmed(bookingId);
  if (assigned) await notifyAssigned(bookingId);
}

/**
 * Marks a Razorpay payment as captured. Safe to call more than once for the same payment
 * (checkout callback and webhook can both arrive).
 */
export async function capturePayment(orderId: string, paymentId: string) {
  const db = supabaseAdmin();
  const { data: pay } = await db.from("payments").select("*").eq("razorpay_order_id", orderId).maybeSingle();
  if (!pay) throw new Error("Unknown order");
  if (pay.status === "captured" || pay.status === "refunded") return { bookingId: pay.booking_id as string, already: true };

  const { data: updated } = await db
    .from("payments")
    .update({ status: "captured", razorpay_payment_id: paymentId })
    .eq("id", pay.id)
    .eq("status", "created") // guards against a concurrent capture
    .select()
    .maybeSingle();
  if (!updated) return { bookingId: pay.booking_id as string, already: true };

  await db.rpc("refresh_payment_totals", { p_booking: pay.booking_id });
  await db.from("booking_events").insert({ booking_id: pay.booking_id, type: "payment", message: `₹${pay.amount} paid online` });

  const { data: b } = await db.from("bookings").select("*").eq("id", pay.booking_id).single();
  const booking = b as Booking;

  if (booking.status === "pending_payment" || (booking.status === "cancelled" && booking.cancel_reason === "Payment not completed")) {
    // If the hold lapsed, the slot may have gone to someone else in the meantime.
    const expired = booking.hold_expires_at && new Date(booking.hold_expires_at) < new Date();
    let free = true;
    if (expired || booking.status === "cancelled") {
      const { data: services } = await db.from("booking_items").select("service_id").eq("booking_id", booking.id);
      const { data } = await db.rpc("slot_is_free", {
        p_start: booking.start_at,
        p_end: booking.end_at,
        p_resource: booking.resource,
        p_service_ids: (services ?? []).map((s) => s.service_id).filter(Boolean),
        p_gender: booking.gender_preference,
        p_exclude: booking.id,
      });
      free = Boolean(data);
    }
    if (free) {
      await db.from("bookings").update({ status: "confirmed", hold_expires_at: null, cancelled_at: null, cancel_reason: null }).eq("id", booking.id);
      await db.from("booking_events").insert({ booking_id: booking.id, type: "confirmed", message: "Booking confirmed" });
      await afterConfirmed(booking.id);
    } else {
      await db.from("bookings").update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: "Slot taken after payment window; refunded", hold_expires_at: null }).eq("id", booking.id);
      await refundPayment(updated.id, "Slot no longer available");
    }
  } else {
    await notifyPayment(booking.id, pay.amount);
  }
  return { bookingId: booking.id, already: false };
}

export async function refundPayment(paymentId: string, reason: string) {
  const db = supabaseAdmin();
  const { data: pay } = await db.from("payments").select("*").eq("id", paymentId).single();
  if (!pay || pay.method !== "razorpay" || pay.status !== "captured" || !pay.razorpay_payment_id) {
    throw new Error("Only captured online payments can be refunded here");
  }
  const refund = await razorpay().payments.refund(pay.razorpay_payment_id, { amount: Math.round(pay.amount * 100), notes: { reason } });
  await db.from("payments").update({ status: "refunded", refund_id: refund.id, note: reason }).eq("id", pay.id);
  await db.rpc("refresh_payment_totals", { p_booking: pay.booking_id });
  await db.from("booking_events").insert({ booking_id: pay.booking_id, type: "refund", message: `₹${pay.amount} refunded` });
  return refund.id;
}

/** Creates a Razorpay order for `amount` rupees and records it as a pending payment. */
export async function createOrder(booking: Booking, amount: number) {
  const order = await razorpay().orders.create({
    amount: toPaise(amount),
    currency: "INR",
    receipt: `${booking.code}-${Date.now().toString(36)}`,
    notes: { booking_id: booking.id, code: booking.code },
  });
  const { error } = await supabaseAdmin()
    .from("payments")
    .insert({ booking_id: booking.id, method: "razorpay", amount, status: "created", razorpay_order_id: order.id });
  if (error) throw new Error(error.message);
  return { id: order.id, amount: order.amount, currency: order.currency };
}
