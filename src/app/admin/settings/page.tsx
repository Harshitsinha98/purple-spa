"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Notice, PageHead, Panel, Toggle, refreshPublicSite } from "@/components/admin/ui";
import type { PaymentMode, Settings } from "@/lib/types";

const MODES: { id: PaymentMode; label: string }[] = [
  { id: "full", label: "Full payment online" },
  { id: "partial", label: "Advance online, rest at spa" },
  { id: "pay_at_spa", label: "Pay at the spa" },
];

export default function SettingsAdmin() {
  const [s, setS] = useState<Settings | null>(null);
  const [admins, setAdmins] = useState<string[]>([]);
  const [newAdmin, setNewAdmin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    const db = supabaseBrowser();
    db.from("settings").select("*").eq("id", 1).single().then(({ data }) => setS(data as Settings));
    db.from("admin_emails").select("email").then(({ data }) => setAdmins((data ?? []).map((r) => r.email as string)));
  }, []);

  if (!s) return <p className="flex items-center gap-2 text-muted"><Loader2 className="size-4 animate-spin" /> Loading…</p>;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });
  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Number(e.target.value) as never);

  const save = async () => {
    setMsg(null);
    if (!s.payment_modes.length) return setMsg({ kind: "error", text: "Keep at least one payment option on." });
    if (s.close_time <= s.open_time) return setMsg({ kind: "error", text: "Closing time must be after opening time." });
    setBusy(true);
    const { id: _id, ...row } = s;
    void _id;
    const { error } = await supabaseBrowser().from("settings").update({ ...row, updated_at: new Date().toISOString() }).eq("id", 1);
    setBusy(false);
    if (error) return setMsg({ kind: "error", text: error.message });
    await refreshPublicSite();
    setMsg({ kind: "ok", text: "Saved. The website and booking page now use these settings." });
  };

  const addAdmin = async () => {
    const email = newAdmin.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
    const db = supabaseBrowser();
    const { error } = await db.from("admin_emails").insert({ email });
    if (error) return setMsg({ kind: "error", text: error.message });
    await db.from("profiles").update({ role: "admin" }).eq("email", email);
    setAdmins([...admins, email]);
    setNewAdmin("");
  };

  const removeAdmin = async (email: string) => {
    if (admins.length <= 1) return setMsg({ kind: "error", text: "At least one admin is required." });
    if (!confirm(`Remove admin access for ${email}?`)) return;
    const db = supabaseBrowser();
    await db.from("admin_emails").delete().eq("email", email);
    const { data: emp } = await db.from("employees").select("id").eq("email", email).eq("is_active", true).maybeSingle();
    await db.from("profiles").update({ role: emp ? "employee" : "customer" }).eq("email", email);
    setAdmins(admins.filter((a) => a !== email));
  };

  const Field = ({ id, label, children, help }: { id: string; label: string; children: React.ReactNode; help?: string }) => (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {help && <p className="mt-1 text-xs text-muted">{help}</p>}
    </div>
  );

  return (
    <div className="max-w-3xl">
      <PageHead title="Settings" />
      <div className="space-y-6">
        <Panel className="space-y-4 p-5">
          <h2 className="font-display text-2xl">Business</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {Field({ id: "st-name", label: "Business name", children: <input id="st-name" className="field" value={s.business_name} onChange={(e) => set("business_name", e.target.value)} /> })}
            {Field({ id: "st-email", label: "Email", children: <input id="st-email" className="field" value={s.email} onChange={(e) => set("email", e.target.value)} /> })}
            {Field({ id: "st-phone", label: "Phone", children: <input id="st-phone" className="field" value={s.phone} onChange={(e) => set("phone", e.target.value)} /> })}
            {Field({ id: "st-wa", label: "WhatsApp (click-to-chat)", children: <input id="st-wa" className="field" value={s.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /> })}
          </div>
          {Field({ id: "st-addr", label: "Address", children: <textarea id="st-addr" className="field min-h-20" value={s.address} onChange={(e) => set("address", e.target.value)} /> })}
          <div className="grid gap-4 sm:grid-cols-2">
            {Field({ id: "st-map", label: "Google Maps search (plus code or name)", children: <input id="st-map" className="field" value={s.maps_query} onChange={(e) => set("maps_query", e.target.value)} /> })}
            {Field({ id: "st-ig", label: "Instagram URL", children: <input id="st-ig" className="field" value={s.instagram_url ?? ""} onChange={(e) => set("instagram_url", e.target.value || null)} /> })}
          </div>
        </Panel>

        <Panel className="space-y-4 p-5">
          <h2 className="font-display text-2xl">Hours & capacity</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {Field({ id: "st-open", label: "Opens", children: <input id="st-open" type="time" className="field" value={s.open_time.slice(0, 5)} onChange={(e) => set("open_time", e.target.value)} /> })}
            {Field({ id: "st-close", label: "Closes", children: <input id="st-close" type="time" className="field" value={s.close_time.slice(0, 5)} onChange={(e) => set("close_time", e.target.value)} />, help: "Last session must finish by this time." })}
            {Field({ id: "st-int", label: "Start times every (min)", children: <input id="st-int" className="field" inputMode="numeric" value={s.slot_interval_min} onChange={num("slot_interval_min")} /> })}
            {Field({ id: "st-beds", label: "Spa beds / rooms", children: <input id="st-beds" className="field" inputMode="numeric" value={s.bed_count} onChange={num("bed_count")} />, help: "Sessions that can run at the same time." })}
            {Field({ id: "st-chairs", label: "Salon chairs", children: <input id="st-chairs" className="field" inputMode="numeric" value={s.chair_count} onChange={num("chair_count")} /> })}
            {Field({ id: "st-buf", label: "Cleaning gap (min)", children: <input id="st-buf" className="field" inputMode="numeric" value={s.buffer_min} onChange={num("buffer_min")} />, help: "Between sessions in the same room." })}
            {Field({ id: "st-lead", label: "Minimum notice (min)", children: <input id="st-lead" className="field" inputMode="numeric" value={s.min_lead_min} onChange={num("min_lead_min")} /> })}
            {Field({ id: "st-win", label: "Bookable days ahead", children: <input id="st-win" className="field" inputMode="numeric" value={s.booking_window_days} onChange={num("booking_window_days")} /> })}
          </div>
        </Panel>

        <Panel className="space-y-2 p-5">
          <h2 className="font-display text-2xl">Booking rules</h2>
          <Toggle id="st-gender" label="Let customers choose therapist gender" checked={s.allow_gender_preference} onChange={(v) => set("allow_gender_preference", v)} />
          <Toggle id="st-auto" label="Assign a therapist automatically when a booking is confirmed" checked={s.auto_assign} onChange={(v) => set("auto_assign", v)} />
          <div className="grid gap-4 pt-2 sm:grid-cols-2">
            {Field({ id: "st-cancel", label: "Customers can cancel up to (hours before)", children: <input id="st-cancel" className="field" inputMode="numeric" value={s.cancellation_hours} onChange={num("cancellation_hours")} /> })}
            {Field({ id: "st-early", label: "Therapists can start a session (minutes before its time)", children: <input id="st-early" className="field" inputMode="numeric" value={s.staff_early_start_min ?? 0} onChange={num("staff_early_start_min")} />, help: "0 = only at the booked time. Admin can always start early." })}
          </div>
        </Panel>

        <Panel className="space-y-3 p-5">
          <h2 className="font-display text-2xl">Payment options shown to customers</h2>
          {MODES.map((m) => (
            <Toggle key={m.id} id={`pm-${m.id}`} label={m.label} checked={s.payment_modes.includes(m.id)} onChange={(v) => set("payment_modes", v ? [...s.payment_modes, m.id] : s.payment_modes.filter((x) => x !== m.id))} />
          ))}
          <div className="grid gap-4 sm:grid-cols-2">
            {Field({ id: "st-adv", label: "Advance amount (%)", children: <input id="st-adv" className="field" inputMode="numeric" value={s.advance_percent} onChange={num("advance_percent")} /> })}
            {Field({ id: "st-hold", label: "Hold slot while paying (min)", children: <input id="st-hold" className="field" inputMode="numeric" value={s.payment_hold_min} onChange={num("payment_hold_min")} /> })}
          </div>
        </Panel>

        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <button onClick={save} disabled={busy} className="btn btn-ink w-full sm:w-auto">{busy && <Loader2 className="size-4 animate-spin" />} Save settings</button>

        <Panel className="space-y-3 p-5">
          <h2 className="font-display text-2xl">Admins</h2>
          <p className="text-sm text-muted">These Gmail accounts can open this panel.</p>
          <ul className="divide-y divide-line">
            {admins.map((a) => (
              <li key={a} className="flex items-center justify-between py-2 text-sm">
                {a}
                <button onClick={() => removeAdmin(a)} className="grid size-9 cursor-pointer place-items-center rounded-full hover:bg-sand" aria-label={`Remove ${a}`}><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <label htmlFor="new-admin" className="sr-only">New admin Gmail</label>
            <input id="new-admin" className="field" placeholder="name@gmail.com" value={newAdmin} onChange={(e) => setNewAdmin(e.target.value)} />
            <button onClick={addAdmin} className="btn btn-ghost">Add</button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
