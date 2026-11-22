"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, Loader2, Pencil, Plus } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { prettyPhone } from "@/lib/format";
import { Modal, Notice, PageHead, Panel, Toggle } from "@/components/admin/ui";
import type { Category, Employee, Gender, Service } from "@/lib/types";
import { cn } from "@/lib/utils";

type Draft = Omit<Employee, "id" | "profile_id" | "created_at"> & { id?: string; profile_id?: string | null; skills: Set<string> };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function EmployeesAdmin() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [skills, setSkills] = useState<Record<string, Set<string>>>({});
  const [services, setServices] = useState<Service[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    const db = supabaseBrowser();
    const [e, es, s, c] = await Promise.all([
      db.from("employees").select("*").order("is_active", { ascending: false }).order("full_name"),
      db.from("employee_services").select("*"),
      db.from("services").select("*, service_variants(id)").order("sort"),
      db.from("service_categories").select("*").order("sort"),
    ]);
    setEmployees((e.data as Employee[]) ?? []);
    const map: Record<string, Set<string>> = {};
    for (const r of (es.data as { employee_id: string; service_id: string }[]) ?? []) (map[r.employee_id] ??= new Set()).add(r.service_id);
    setSkills(map);
    setServices((s.data as Service[]) ?? []);
    setCats((c.data as Category[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    load();
  }, [load]);

  if (loading) return <p className="flex items-center gap-2 text-muted"><Loader2 className="size-4 animate-spin" /> Loading…</p>;

  return (
    <div>
      <PageHead
        title="Employees"
        sub="Add a therapist with their Gmail. When they sign in with Google on their phone, they get the staff app automatically."
        actions={
          <button onClick={() => setDraft({ email: "", full_name: "", phone: "", gender: "female", title: "Therapist", commission_percent: 10, weekly_off: null, is_active: true, skills: new Set() })} className="btn btn-ink h-10 text-sm">
            <Plus className="size-4" /> Add employee
          </button>
        }
      />
      {employees.length === 0 ? (
        <Panel className="p-8 text-center text-muted">No employees yet. Add your first therapist to start taking bookings — customers can only book services that at least one active employee is assigned to.</Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {employees.map((e) => (
            <Panel key={e.id} className={cn("p-5", !e.is_active && "opacity-60")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-2xl">{e.full_name}</p>
                  <p className="text-sm text-muted">{e.title} · {e.gender} · {e.commission_percent}% commission</p>
                  <p className="text-sm text-muted">{e.email}{e.phone && ` · ${prettyPhone(e.phone)}`}</p>
                  {e.weekly_off != null && <p className="text-sm text-muted">Weekly off: {DAYS[e.weekly_off]}</p>}
                </div>
                <button onClick={() => setDraft({ ...e, skills: new Set(skills[e.id] ?? []) })} className="grid size-9 cursor-pointer place-items-center rounded-full hover:bg-sand" aria-label={`Edit ${e.full_name}`}><Pencil className="size-4" /></button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {e.profile_id ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700"><CheckCircle2 className="size-3.5" /> Signed in</span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 font-semibold text-[#7a5a17]"><Clock3 className="size-3.5" /> Waiting for first Google sign-in</span>
                )}
                {!e.is_active && <span className="rounded-full bg-neutral-200 px-2.5 py-1">Inactive</span>}
                <span className="text-muted">{skills[e.id]?.size ?? 0} services</span>
              </div>
            </Panel>
          ))}
        </div>
      )}
      <EmployeeModal draft={draft} services={services} cats={cats} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); load(); }} />
    </div>
  );
}

function EmployeeModal({ draft, services, cats, onClose, onSaved }: { draft: Draft | null; services: Service[]; cats: Category[]; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft | null>(draft);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form when opened
  useEffect(() => { setD(draft); setErr(null); }, [draft]);
  if (!d) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;

  const toggleSkill = (id: string) => {
    const next = new Set(d.skills);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setD({ ...d, skills: next });
  };
  const toggleCat = (catId: string, on: boolean) => {
    const next = new Set(d.skills);
    services.filter((s) => s.category_id === catId).forEach((s) => (on ? next.add(s.id) : next.delete(s.id)));
    setD({ ...d, skills: next });
  };

  const save = async () => {
    setErr(null);
    const email = d.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setErr("Enter the employee's Gmail address.");
    if (d.full_name.trim().length < 2) return setErr("Enter the employee's name.");
    if (d.phone && !/^\+?[0-9]{10,13}$/.test(d.phone.replace(/[\s-]/g, ""))) return setErr("Phone number looks wrong.");
    if (!(d.commission_percent >= 0 && d.commission_percent <= 100)) return setErr("Commission must be between 0 and 100.");
    setBusy(true);
    const db = supabaseBrowser();
    const row = { email, full_name: d.full_name.trim(), phone: d.phone ? d.phone.replace(/[\s-]/g, "") : null, gender: d.gender, title: d.title.trim() || "Therapist", commission_percent: d.commission_percent, weekly_off: d.weekly_off, is_active: d.is_active };
    const res = d.id ? await db.from("employees").update(row).eq("id", d.id).select().single() : await db.from("employees").insert(row).select().single();
    if (res.error) {
      setBusy(false);
      return setErr(res.error.message.includes("duplicate") ? "An employee with this email already exists." : res.error.message);
    }
    const id = res.data.id as string;
    const del = await db.from("employee_services").delete().eq("employee_id", id);
    if (del.error) { setBusy(false); return setErr(del.error.message); }
    if (d.skills.size) {
      const ins = await db.from("employee_services").insert([...d.skills].map((service_id) => ({ employee_id: id, service_id })));
      if (ins.error) { setBusy(false); return setErr(ins.error.message); }
    }
    setBusy(false);
    onSaved();
  };

  return (
    <Modal open={!!draft} onClose={onClose} title={d.id ? `Edit ${d.full_name}` : "Add employee"} wide>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="e-name">Full name</label><input id="e-name" className="field" value={d.full_name} onChange={(e) => setD({ ...d, full_name: e.target.value })} /></div>
          <div>
            <label className="label" htmlFor="e-email">Gmail (used for Google sign-in)</label>
            <input id="e-email" className="field" type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} disabled={!!d.profile_id} />
            {d.profile_id && <p className="mt-1 text-xs text-muted">Locked after first sign-in.</p>}
          </div>
          <div><label className="label" htmlFor="e-phone">Phone (WhatsApp)</label><input id="e-phone" className="field" inputMode="tel" value={d.phone ?? ""} onChange={(e) => setD({ ...d, phone: e.target.value })} /></div>
          <div>
            <label className="label" htmlFor="e-gender">Gender</label>
            <select id="e-gender" className="field" value={d.gender} onChange={(e) => setD({ ...d, gender: e.target.value as Gender })}>
              <option value="female">Female</option><option value="male">Male</option><option value="other">Other</option>
            </select>
          </div>
          <div><label className="label" htmlFor="e-title">Role</label><input id="e-title" className="field" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Therapist / Stylist" /></div>
          <div><label className="label" htmlFor="e-com">Commission % (default)</label><input id="e-com" className="field" inputMode="decimal" value={d.commission_percent} onChange={(e) => setD({ ...d, commission_percent: Number(e.target.value) })} /></div>
          <div>
            <label className="label" htmlFor="e-off">Weekly off</label>
            <select id="e-off" className="field" value={d.weekly_off ?? ""} onChange={(e) => setD({ ...d, weekly_off: e.target.value === "" ? null : Number(e.target.value) })}>
              <option value="">None</option>
              {DAYS.map((x, i) => <option key={x} value={i}>{x}</option>)}
            </select>
          </div>
        </div>
        <Toggle id="e-active" label="Active (can receive bookings and sign in to the staff app)" checked={d.is_active} onChange={(v) => setD({ ...d, is_active: v })} />

        <div>
          <p className="label">Services this person can do</p>
          <div className="space-y-4 rounded-xl border border-line p-4">
            {cats.map((c) => {
              const list = services.filter((s) => s.category_id === c.id);
              if (!list.length) return null;
              const all = list.every((s) => d.skills.has(s.id));
              return (
                <div key={c.id}>
                  <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={all} onChange={(e) => toggleCat(c.id, e.target.checked)} /> {c.name_en}</label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {list.map((s) => (
                      <button key={s.id} type="button" onClick={() => toggleSkill(s.id)} aria-pressed={d.skills.has(s.id)} className={cn("min-h-8 cursor-pointer rounded-full border px-3 text-xs", d.skills.has(s.id) ? "border-violet bg-violet text-white" : "border-line")}>
                        {s.name_en}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {err && <Notice kind="error">{err}</Notice>}
        <button onClick={save} disabled={busy} className="btn btn-ink w-full">{busy && <Loader2 className="size-4 animate-spin" />} Save</button>
      </div>
    </Modal>
  );
}
