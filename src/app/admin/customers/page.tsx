"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Ban, ChevronLeft, ChevronRight, Download, Loader2, MessageCircle, Phone, Plus, Search, Star, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { downloadCsv } from "@/lib/csv";
import { fmtDate, fmtTime, inr, prettyPhone, telHref, waHref } from "@/lib/format";
import { StatusBadge, holdExpired } from "@/components/booking/status-badge";
import { BookingDrawer, useStaffList } from "@/components/admin/booking-drawer";
import { Notice, PageHead, Panel, Toggle } from "@/components/admin/ui";
import type { Booking, CustomerSummary } from "@/lib/types";

const PAGE = 50;
const SUGGESTED_TAGS = ["VIP", "Regular", "Prefers female", "Prefers male", "Deep pressure", "Allergy", "Corporate"];

export default function CustomersPage() {
  return (
    <Suspense>
      <Customers />
    </Suspense>
  );
}

function Customers() {
  const params = useSearchParams();
  const router = useRouter();
  const key = params.get("key");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<CustomerSummary[] | null>(null);
  const [bump, setBump] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const id = setTimeout(async () => {
      const { data, error } = await supabaseBrowser().rpc("admin_customers", { p_search: q || null, p_limit: PAGE, p_offset: page * PAGE });
      if (!alive) return;
      if (error) setErr(error.message.includes("admin_customers") ? "Run supabase/migrations/0004_staff_privacy_crm.sql in Supabase to turn on customer records." : error.message);
      setRows((data as CustomerSummary[]) ?? []);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [q, page, bump]);

  const total = rows?.[0]?.total_count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const open = (k: string | null) => router.replace(k ? `/admin/customers?key=${k}` : "/admin/customers", { scroll: false });

  const exportCsv = async () => {
    const { data } = await supabaseBrowser().rpc("admin_customers", { p_search: q || null, p_limit: 200, p_offset: 0 });
    downloadCsv("customers.csv", [
      ["Name", "Phone", "Email", "Bookings", "Completed", "Cancelled", "No-shows", "Spent", "First visit", "Last visit", "Next visit", "Tags", "Blocked", "Note"],
      ...((data as CustomerSummary[]) ?? []).map((c) => [c.name, c.phone, c.email, c.bookings, c.completed, c.cancelled, c.no_show, c.spent, c.first_visit && fmtDate(c.first_visit), c.last_visit && fmtDate(c.last_visit), c.next_visit && fmtDate(c.next_visit), c.tags.join("; "), c.is_blocked ? "yes" : "", c.note]),
    ]);
  };

  return (
    <div>
      <PageHead
        title="Customers"
        sub="Everyone who has booked, grouped by phone number — online and walk-in."
        actions={<button onClick={exportCsv} className="btn btn-ghost h-10 text-sm"><Download className="size-4" /> CSV</button>}
      />
      {err && <div className="mb-4"><Notice kind="error">{err}</Notice></div>}
      <label className="relative mb-4 block max-w-md">
        <span className="sr-only">Search customers</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input className="field pl-9" placeholder="Name, phone, email or tag (e.g. VIP)" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
      </label>

      <Panel className="overflow-x-auto">
        {!rows ? (
          <p className="flex items-center gap-2 p-6 text-muted"><Loader2 className="size-4 animate-spin" /> Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-muted">No customers found.</p>
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              <tr><th className="p-3 pl-4">Customer</th><th className="p-3 text-right">Visits</th><th className="p-3 text-right">Spent</th><th className="p-3">Last visit</th><th className="p-3">Next</th><th className="p-3 pr-4">Tags</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => (
                <tr key={c.phone_key} onClick={() => open(c.phone_key)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && open(c.phone_key)} className="cursor-pointer hover:bg-sand/50">
                  <td className="p-3 pl-4">
                    <span className="flex items-center gap-1.5 font-semibold">
                      {c.name}
                      {c.tags.includes("VIP") && <Star className="size-3.5 text-gold" fill="currentColor" aria-label="VIP" />}
                      {c.is_blocked && <Ban className="size-3.5 text-magenta" aria-label="Blocked" />}
                    </span>
                    <span className="text-muted">{prettyPhone(c.phone)}{c.email && ` · ${c.email}`}</span>
                  </td>
                  <td className="p-3 text-right tabular-nums">{c.completed}<span className="text-muted"> / {c.bookings}</span></td>
                  <td className="p-3 text-right font-semibold tabular-nums">{inr(c.spent)}</td>
                  <td className="p-3">{c.last_visit ? fmtDate(c.last_visit) : <span className="text-muted">—</span>}</td>
                  <td className="p-3">{c.next_visit ? fmtDate(c.next_visit) : <span className="text-muted">—</span>}</td>
                  <td className="p-3 pr-4">
                    <span className="flex flex-wrap gap-1">{c.tags.map((t) => <span key={t} className="rounded-full bg-sand px-2 py-0.5 text-xs">{t}</span>)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="grid size-9 cursor-pointer place-items-center rounded-full border border-line bg-white disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="size-4" /></button>
          <span>Page {page + 1} of {pages}</span>
          <button onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} className="grid size-9 cursor-pointer place-items-center rounded-full border border-line bg-white disabled:opacity-40" aria-label="Next page"><ChevronRight className="size-4" /></button>
        </div>
      )}

      <CustomerPanel phoneKey={key} onClose={() => open(null)} onSaved={() => setBump((n) => n + 1)} />
    </div>
  );
}

function CustomerPanel({ phoneKey, onClose, onSaved }: { phoneKey: string | null; onClose: () => void; onSaved: () => void }) {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const staff = useStaffList();

  const load = useCallback(async () => {
    if (!phoneKey) return;
    const db = supabaseBrowser();
    const [b, n] = await Promise.all([
      db.from("bookings").select("*, booking_items(name_en, duration_min, price)").eq("customer_phone_key", phoneKey).order("start_at", { ascending: false }).limit(200),
      db.from("customer_notes").select("*").eq("phone_key", phoneKey).maybeSingle(),
    ]);
    setBookings((b.data as Booking[]) ?? []);
    setNote(n.data?.note ?? "");
    setTags(n.data?.tags ?? []);
    setBlocked(n.data?.is_blocked ?? false);
  }, [phoneKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when another customer opens
    setBookings(null);
    setMsg(null);
    load();
  }, [load]);

  const real = useMemo(() => (bookings ?? []).filter((b) => b.status !== "pending_payment" || !holdExpired(b)), [bookings]);
  const latest = real[0];
  const done = real.filter((b) => b.status === "completed");
  const stats = useMemo(() => {
    const svc: Record<string, number> = {};
    const thera: Record<string, number> = {};
    for (const b of done) {
      (b.booking_items ?? []).forEach((i) => (svc[i.name_en] = (svc[i.name_en] ?? 0) + 1));
      if (b.employee_name) thera[b.employee_name] = (thera[b.employee_name] ?? 0) + 1;
    }
    const top = (m: Record<string, number>) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const spent = done.reduce((n, b) => n + Number(b.total_amount), 0);
    const due = real.filter((b) => ["completed", "in_progress"].includes(b.status)).reduce((n, b) => n + Number(b.total_amount) - Number(b.amount_paid), 0);
    return { services: top(svc), therapists: top(thera), spent, avg: done.length ? spent / done.length : 0, due };
  }, [done, real]);

  const save = async () => {
    if (!phoneKey) return;
    setSaving(true);
    setMsg(null);
    const { data: auth } = await supabaseBrowser().auth.getUser();
    const { error } = await supabaseBrowser().from("customer_notes").upsert({ phone_key: phoneKey, note: note.trim() || null, tags, is_blocked: blocked, updated_at: new Date().toISOString(), updated_by: auth.user?.id ?? null });
    setSaving(false);
    if (error) return setMsg({ kind: "error", text: error.message });
    setMsg({ kind: "ok", text: blocked ? "Saved. This number can no longer book online." : "Saved." });
    onSaved();
  };
  const addTag = (t: string) => {
    const v = t.trim();
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setNewTag("");
  };

  return (
    <>
      <AnimatePresence>
        {phoneKey && (
          <motion.div className="fixed inset-0 z-40 flex justify-end bg-night/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.aside role="dialog" aria-modal="true" aria-label="Customer" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ duration: 0.25 }} onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-2xl overflow-y-auto bg-[#f6f3ef] shadow-2xl" data-lenis-prevent>
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-[#f6f3ef]/95 px-5 py-3 backdrop-blur">
                <p className="text-sm text-muted">Customer</p>
                <button onClick={onClose} className="grid size-10 cursor-pointer place-items-center rounded-full hover:bg-sand" aria-label="Close"><X className="size-5" /></button>
              </div>
              {!bookings ? (
                <p className="flex items-center gap-2 p-6 text-muted"><Loader2 className="size-4 animate-spin" /> Loading…</p>
              ) : !latest ? (
                <p className="p-6 text-muted">No bookings for this number.</p>
              ) : (
                <div className="space-y-5 p-5">
                  <div>
                    <h2 className="flex items-center gap-2 font-display text-4xl">
                      {latest.customer_name}
                      {tags.includes("VIP") && <Star className="size-5 text-gold" fill="currentColor" aria-label="VIP" />}
                    </h2>
                    <p className="mt-1 text-muted">{prettyPhone(latest.customer_phone)}{latest.customer_email && ` · ${latest.customer_email}`}{latest.customer_id ? " · Google account" : " · Walk-in / phone"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a href={telHref(latest.customer_phone)} className="btn btn-ink h-10 min-h-10 text-sm"><Phone className="size-4" /> Call</a>
                      <a href={waHref(latest.customer_phone)} target="_blank" rel="noreferrer" className="btn btn-ghost h-10 min-h-10 text-sm"><MessageCircle className="size-4" /> WhatsApp</a>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ["Visits", String(done.length)],
                      ["Spent", inr(stats.spent)],
                      ["Avg visit", inr(Math.round(stats.avg))],
                      ["Balance due", inr(stats.due)],
                      ["Bookings", String(real.length)],
                      ["Cancelled", String(real.filter((b) => b.status === "cancelled").length)],
                      ["No-shows", String(real.filter((b) => b.status === "no_show").length)],
                      ["Customer since", fmtDate(real[real.length - 1].created_at, "en", { weekday: undefined })],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-xl border border-line bg-white p-3">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted">{k}</p>
                        <p className="mt-1 font-display text-xl tabular-nums">{v}</p>
                      </div>
                    ))}
                  </div>

                  {(stats.services.length > 0 || stats.therapists.length > 0) && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Panel className="p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Favourite services</p>
                        <ul className="mt-2 space-y-1 text-sm">{stats.services.map(([n, c]) => <li key={n} className="flex justify-between"><span>{n}</span><span className="text-muted">{c}×</span></li>)}</ul>
                      </Panel>
                      <Panel className="p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Usual therapist</p>
                        <ul className="mt-2 space-y-1 text-sm">{stats.therapists.map(([n, c]) => <li key={n} className="flex justify-between"><span>{n}</span><span className="text-muted">{c}×</span></li>)}</ul>
                      </Panel>
                    </div>
                  )}

                  <Panel className="space-y-3 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">Private notes (only admins see this)</p>
                    <label htmlFor="c-note" className="sr-only">Note</label>
                    <textarea id="c-note" className="field min-h-24" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Preferences, health notes, anything the team should know" maxLength={2000} />
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((t) => (
                        <button key={t} onClick={() => setTags(tags.filter((x) => x !== t))} className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full bg-violet px-3 text-xs font-semibold text-white" aria-label={`Remove tag ${t}`}>
                          {t} <X className="size-3" />
                        </button>
                      ))}
                      {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).map((t) => (
                        <button key={t} onClick={() => addTag(t)} className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full border border-line px-3 text-xs hover:bg-sand">
                          <Plus className="size-3" /> {t}
                        </button>
                      ))}
                    </div>
                    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addTag(newTag); }}>
                      <label htmlFor="c-tag" className="sr-only">New tag</label>
                      <input id="c-tag" className="field" placeholder="Add your own tag" value={newTag} onChange={(e) => setNewTag(e.target.value)} maxLength={30} />
                      <button className="btn btn-ghost">Add</button>
                    </form>
                    <Toggle id="c-block" label="Block online booking for this number" checked={blocked} onChange={setBlocked} />
                    {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
                    <button onClick={save} disabled={saving} className="btn btn-ink w-full">{saving && <Loader2 className="size-4 animate-spin" />} Save</button>
                  </Panel>

                  <section>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">All bookings ({real.length})</p>
                    <ul className="mt-2 space-y-2">
                      {real.map((b) => (
                        <li key={b.id}>
                          <button onClick={() => setOpenId(b.id)} className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-line bg-white p-3 text-left text-sm hover:border-violet/40">
                            <span className="w-24 shrink-0"><span className="block font-semibold">{fmtDate(b.start_at)}</span><span className="text-muted">{fmtTime(b.start_at)}</span></span>
                            <span className="min-w-0 flex-1 truncate">{(b.booking_items ?? []).map((i) => i.name_en).join(", ")}{b.employee_name && <span className="text-muted"> · {b.employee_name}</span>}</span>
                            <span className="tabular-nums">{inr(b.total_amount)}</span>
                            <StatusBadge status={b.status} expired={holdExpired(b)} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
      <BookingDrawer id={openId} onClose={() => setOpenId(null)} onChanged={load} staff={staff} />
    </>
  );
}
