import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fmtDate, fmtTime, inr } from "@/lib/format";
import { sendTemplate } from "./whatsapp";
import { adminProfileIds, pushToProfiles } from "./push";
import type { Booking } from "@/lib/types";

type Full = Booking & { booking_items: { name_en: string }[] };

async function load(id: string): Promise<Full | null> {
  const { data } = await supabaseAdmin().from("bookings").select("*, booking_items(name_en)").eq("id", id).maybeSingle();
  return (data as Full) ?? null;
}

const when = (b: Booking) => `${fmtDate(b.start_at)}, ${fmtTime(b.start_at)}`;
const services = (b: Full) => b.booking_items.map((i) => i.name_en).join(", ");
const first = (name: string) => name.trim().split(/\s+/)[0] || name;

async function employeeProfile(employeeId: string | null) {
  if (!employeeId) return null;
  const { data } = await supabaseAdmin().from("employees").select("profile_id, phone, full_name").eq("id", employeeId).maybeSingle();
  return data as { profile_id: string | null; phone: string | null; full_name: string } | null;
}

async function optedIn(b: Booking) {
  if (!b.customer_id) return true;
  const { data } = await supabaseAdmin().from("profiles").select("whatsapp_opt_in").eq("id", b.customer_id).maybeSingle();
  return data?.whatsapp_opt_in !== false;
}

/** Booking is confirmed (paid, or pay-at-spa). Customer gets WhatsApp, admins get a push. */
export async function notifyConfirmed(id: string) {
  const b = await load(id);
  if (!b) return;
  const paid = b.amount_paid > 0 ? `${inr(b.amount_paid)} paid` : "Pay at the spa";
  if (await optedIn(b)) await sendTemplate(b.customer_phone, "booking_confirmed", [first(b.customer_name), b.code, services(b), when(b), paid], b.id);
  await pushToProfiles(await adminProfileIds(), {
    title: `New booking · ${when(b)}`,
    body: `${b.customer_name} — ${services(b)}${b.employee_name ? ` · ${b.employee_name}` : " · needs a therapist"}`,
    url: `/admin/bookings?focus=${b.id}`,
    tag: `booking-${b.id}`,
  });
}

/** Therapist assigned (auto or by admin). Customer sees it live via Realtime; WhatsApp + staff push here. */
export async function notifyAssigned(id: string) {
  const b = await load(id);
  if (!b || !b.employee_id) return;
  if (await optedIn(b)) await sendTemplate(b.customer_phone, "therapist_assigned", [first(b.customer_name), b.employee_name ?? "", when(b), b.code], b.id);
  const emp = await employeeProfile(b.employee_id);
  if (emp?.profile_id) {
    await pushToProfiles([emp.profile_id], {
      title: `New booking · ${when(b)}`,
      body: `${b.customer_name} — ${services(b)}`,
      url: `/staff?focus=${b.id}`,
      tag: `booking-${b.id}`,
    });
  }
  if (emp?.phone && process.env.WHATSAPP_STAFF_ALERTS === "true") {
    await sendTemplate(emp.phone, "staff_new_booking", [first(emp.full_name), b.customer_name, services(b), when(b)], b.id);
  }
}

export async function notifyCancelled(id: string, previousEmployee: string | null) {
  const b = await load(id);
  if (!b) return;
  if (await optedIn(b)) await sendTemplate(b.customer_phone, "booking_cancelled", [first(b.customer_name), b.code, when(b)], b.id);
  const emp = await employeeProfile(previousEmployee ?? b.employee_id);
  const targets = [...(await adminProfileIds()), ...(emp?.profile_id ? [emp.profile_id] : [])];
  await pushToProfiles(targets, { title: "Booking cancelled", body: `${b.customer_name} · ${when(b)}`, url: "/staff", tag: `booking-${b.id}` });
}

export async function notifyCompleted(id: string) {
  const b = await load(id);
  if (!b) return;
  if (await optedIn(b)) await sendTemplate(b.customer_phone, "booking_completed", [first(b.customer_name)], b.id);
}

export async function notifyPayment(id: string, amount: number) {
  const b = await load(id);
  if (!b) return;
  if (await optedIn(b)) await sendTemplate(b.customer_phone, "payment_received", [first(b.customer_name), inr(amount), b.code], b.id);
}

export async function notifyReminder(b: Full) {
  if (await optedIn(b)) await sendTemplate(b.customer_phone, "booking_reminder", [first(b.customer_name), services(b), fmtTime(b.start_at)], b.id);
}
