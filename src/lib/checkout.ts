"use client";

import { RAZORPAY_KEY_ID } from "@/lib/env";

type Order = { id: string; amount: number; currency: string };
type Success = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };
  }
}

function loadScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load the payment window. Check your connection."));
    document.body.appendChild(s);
  });
}

/** Opens Razorpay Checkout. Resolves with the signed result, or null if the customer closed it. */
export async function payWithRazorpay(order: Order, prefill: { name: string; contact: string; email?: string }, description: string) {
  await loadScript();
  return new Promise<Success | null>((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: RAZORPAY_KEY_ID,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      name: "The Purple Spa",
      description,
      image: `${window.location.origin}/icons/icon-192.png`,
      prefill,
      theme: { color: "#3b1c4f" },
      handler: (r: Success) => resolve(r),
      modal: { ondismiss: () => resolve(null), confirm_close: true },
    });
    rzp.on("payment.failed", () => {
      /* Razorpay shows the error and lets the customer retry inside the same window */
    });
    try {
      rzp.open();
    } catch (e) {
      reject(e);
    }
  });
}

export async function verifyPayment(r: Success) {
  const res = await api<{ bookingId: string }>("/api/payments/verify", r);
  return res.bookingId;
}

export async function api<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Something went wrong");
  return data as T;
}
