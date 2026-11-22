import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * WhatsApp Cloud API (Meta). Business-initiated messages must use pre-approved templates.
 * Template names and their {{1}}, {{2}}… parameters are listed in README.md.
 */
export type TemplateName =
  | "booking_confirmed"
  | "therapist_assigned"
  | "booking_cancelled"
  | "booking_reminder"
  | "booking_completed"
  | "payment_received"
  | "staff_new_booking";

const GRAPH = "https://graph.facebook.com/v21.0";

export function whatsappConfigured() {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/** Normalises Indian numbers to 91XXXXXXXXXX. */
export function waNumber(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.length === 11 && d.startsWith("0")) return `91${d.slice(1)}`;
  return d;
}

export async function sendTemplate(to: string, template: TemplateName, params: string[], bookingId?: string) {
  const recipient = waNumber(to);
  const log = (status: string, error?: string) =>
    supabaseAdmin()
      .from("notification_log")
      .insert({ booking_id: bookingId ?? null, channel: "whatsapp", recipient, template, status, error: error ?? null })
      .then(() => undefined);

  if (!whatsappConfigured()) return log("skipped", "WhatsApp is not configured");
  try {
    const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient,
        type: "template",
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
          components: params.length
            ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text: text.slice(0, 1000) })) }]
            : [],
        },
      }),
    });
    if (!res.ok) return log("failed", (await res.text()).slice(0, 500));
    return log("sent");
  } catch (e) {
    return log("failed", e instanceof Error ? e.message : String(e));
  }
}
