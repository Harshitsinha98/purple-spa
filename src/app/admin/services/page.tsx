"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { inr } from "@/lib/format";
import { Modal, Notice, PageHead, Panel, Toggle, refreshPublicSite } from "@/components/admin/ui";
import type { Category, ResourceKind, Service } from "@/lib/types";
import { cn } from "@/lib/utils";

type VariantDraft = { id?: string; duration_min: number; price: number; is_active: boolean };
type ServiceDraft = Omit<Service, "id" | "service_variants" | "commission_percent"> & { id?: string; commission_percent: string; variants: VariantDraft[] };

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function ServicesAdmin() {
  const [cats, setCats] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ServiceDraft | null>(null);
  const [editCat, setEditCat] = useState<Partial<Category> | null>(null);

  const load = useCallback(async () => {
    const db = supabaseBrowser();
    const [c, s] = await Promise.all([
      db.from("service_categories").select("*").order("sort"),
      db.from("services").select("*, service_variants(*)").order("sort"),
    ]);
    setCats((c.data as Category[]) ?? []);
    setServices((s.data as Service[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    load();
  }, [load]);

  const newService = (category_id: string, kind: "spa" | "salon"): ServiceDraft => ({
    category_id, slug: "", name_en: "", name_hi: "", description_en: null, description_hi: null, tag_en: null, tag_hi: null,
    resource: kind === "spa" ? "bed" : "chair", commission_percent: "", sort: 99, is_active: true, created_at: "",
    variants: [{ duration_min: 60, price: 1000, is_active: true }],
  } as unknown as ServiceDraft);

  const editService = (s: Service): ServiceDraft => ({
    ...s,
    commission_percent: s.commission_percent == null ? "" : String(s.commission_percent),
    variants: [...s.service_variants].sort((a, b) => a.duration_min - b.duration_min).map((v) => ({ id: v.id, duration_min: v.duration_min, price: Number(v.price), is_active: v.is_active })),
  });

  if (loading) return <p className="flex items-center gap-2 text-muted"><Loader2 className="size-4 animate-spin" /> Loading…</p>;

  return (
    <div>
      <PageHead
        title="Services & rates"
        sub="Everything here shows on the website menu and in booking. Inactive items are hidden from customers."
        actions={<button onClick={() => setEditCat({ kind: "spa", sort: 99, is_active: true })} className="btn btn-ghost h-10 text-sm"><Plus className="size-4" /> Category</button>}
      />
      <div className="space-y-8">
        {cats.map((c) => (
          <Panel key={c.id} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-sand/50 px-5 py-3">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-2xl">{c.name_en}</h2>
                <span className="text-sm text-muted">{c.name_hi} · {c.kind}</span>
                {!c.is_active && <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs">hidden</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditCat(c)} className="grid size-9 cursor-pointer place-items-center rounded-full hover:bg-white" aria-label={`Edit ${c.name_en}`}><Pencil className="size-4" /></button>
                <button onClick={() => setEditing(newService(c.id, c.kind))} className="btn btn-ink h-9 min-h-9 text-xs"><Plus className="size-3.5" /> Service</button>
              </div>
            </div>
            <ul className="divide-y divide-line">
              {services.filter((s) => s.category_id === c.id).map((s) => (
                <li key={s.id} className={cn("flex flex-wrap items-center gap-4 px-5 py-3", !s.is_active && "opacity-50")}>
                  <div className="min-w-48 flex-1">
                    <p className="font-semibold">{s.name_en} {!s.is_active && <span className="text-xs font-normal">(inactive)</span>}</p>
                    <p className="text-sm text-muted">{s.name_hi}{s.tag_en && ` · ${s.tag_en}`} · {s.resource}{s.commission_percent != null && ` · ${s.commission_percent}% commission`}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[...s.service_variants].sort((a, b) => a.duration_min - b.duration_min).map((v) => (
                      <span key={v.id} className={cn("rounded-full border border-line px-2.5 py-1 text-xs tabular-nums", !v.is_active && "line-through opacity-60")}>{v.duration_min}m · {inr(v.price)}</span>
                    ))}
                  </div>
                  <button onClick={() => setEditing(editService(s))} className="grid size-9 cursor-pointer place-items-center rounded-full hover:bg-sand" aria-label={`Edit ${s.name_en}`}><Pencil className="size-4" /></button>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>

      <ServiceModal draft={editing} cats={cats} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); refreshPublicSite(); }} />
      <CategoryModal draft={editCat} onClose={() => setEditCat(null)} onSaved={() => { setEditCat(null); load(); refreshPublicSite(); }} />
    </div>
  );
}

function ServiceModal({ draft, cats, onClose, onSaved }: { draft: ServiceDraft | null; cats: Category[]; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<ServiceDraft | null>(draft);
  const [removed, setRemoved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form when a new item is opened
  useEffect(() => { setD(draft); setRemoved([]); setErr(null); }, [draft]);
  if (!d) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;

  const set = <K extends keyof ServiceDraft>(k: K, v: ServiceDraft[K]) => setD({ ...d, [k]: v });
  const setV = (i: number, patch: Partial<VariantDraft>) => set("variants", d.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  const save = async () => {
    setErr(null);
    if (!d.name_en.trim() || !d.name_hi.trim()) return setErr("English and Hindi names are required.");
    if (!d.variants.length) return setErr("Add at least one duration and price.");
    const durations = d.variants.map((v) => v.duration_min);
    if (new Set(durations).size !== durations.length) return setErr("Each duration can appear only once.");
    if (d.variants.some((v) => !(v.duration_min >= 5 && v.duration_min <= 480) || !(v.price >= 0))) return setErr("Duration must be 5–480 minutes and price 0 or more.");
    setBusy(true);
    const db = supabaseBrowser();
    const row = {
      category_id: d.category_id, name_en: d.name_en.trim(), name_hi: d.name_hi.trim(),
      slug: d.slug || slugify(d.name_en), tag_en: d.tag_en || null, tag_hi: d.tag_hi || null,
      description_en: d.description_en || null, description_hi: d.description_hi || null,
      resource: d.resource, sort: Number(d.sort) || 0, is_active: d.is_active,
      commission_percent: d.commission_percent === "" ? null : Number(d.commission_percent),
    };
    const res = d.id ? await db.from("services").update(row).eq("id", d.id).select().single() : await db.from("services").insert(row).select().single();
    if (res.error) { setBusy(false); return setErr(res.error.message.includes("duplicate") ? "A service with this name already exists." : res.error.message); }
    const sid = res.data.id as string;
    // Variants used in past bookings are deactivated instead of deleted, so history stays intact.
    for (const id of removed) {
      const del = await db.from("service_variants").delete().eq("id", id);
      if (del.error) await db.from("service_variants").update({ is_active: false }).eq("id", id);
    }
    for (const v of d.variants) {
      const vr = { service_id: sid, duration_min: v.duration_min, price: v.price, is_active: v.is_active };
      const r = v.id ? await db.from("service_variants").update(vr).eq("id", v.id) : await db.from("service_variants").insert(vr);
      if (r.error) { setBusy(false); return setErr(r.error.message); }
    }
    setBusy(false);
    onSaved();
  };

  return (
    <Modal open={!!draft} onClose={onClose} title={d.id ? `Edit ${d.name_en}` : "New service"} wide>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="s-en">Name (English)</label><input id="s-en" className="field" value={d.name_en} onChange={(e) => set("name_en", e.target.value)} /></div>
          <div><label className="label" htmlFor="s-hi">Name (Hindi)</label><input id="s-hi" className="field" value={d.name_hi} onChange={(e) => set("name_hi", e.target.value)} /></div>
          <div><label className="label" htmlFor="s-ten">Tag (English, optional)</label><input id="s-ten" className="field" placeholder="e.g. Medium pressure" value={d.tag_en ?? ""} onChange={(e) => set("tag_en", e.target.value)} /></div>
          <div><label className="label" htmlFor="s-thi">Tag (Hindi, optional)</label><input id="s-thi" className="field" value={d.tag_hi ?? ""} onChange={(e) => set("tag_hi", e.target.value)} /></div>
          <div>
            <label className="label" htmlFor="s-cat">Category</label>
            <select id="s-cat" className="field" value={d.category_id} onChange={(e) => set("category_id", e.target.value)}>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name_en}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="s-res">Uses</label>
            <select id="s-res" className="field" value={d.resource} onChange={(e) => set("resource", e.target.value as ResourceKind)}>
              <option value="bed">Spa bed / room</option>
              <option value="chair">Salon chair</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="s-com">Commission % (blank = employee default)</label>
            <input id="s-com" className="field" inputMode="decimal" value={d.commission_percent} onChange={(e) => set("commission_percent", e.target.value)} />
          </div>
          <div><label className="label" htmlFor="s-sort">Order on menu</label><input id="s-sort" className="field" inputMode="numeric" value={d.sort} onChange={(e) => set("sort", Number(e.target.value))} /></div>
        </div>
        <Toggle id="s-active" label="Show to customers" checked={d.is_active} onChange={(v) => set("is_active", v)} />

        <div>
          <p className="label">Durations & prices</p>
          <ul className="space-y-2">
            {d.variants.map((v, i) => (
              <li key={v.id ?? `new-${i}`} className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`v-d-${i}`}>Minutes</label>
                <input id={`v-d-${i}`} className="field w-24" inputMode="numeric" value={v.duration_min} onChange={(e) => setV(i, { duration_min: Number(e.target.value) })} />
                <span className="text-sm text-muted">min · ₹</span>
                <label className="sr-only" htmlFor={`v-p-${i}`}>Price</label>
                <input id={`v-p-${i}`} className="field w-28" inputMode="decimal" value={v.price} onChange={(e) => setV(i, { price: Number(e.target.value) })} />
                <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={v.is_active} onChange={(e) => setV(i, { is_active: e.target.checked })} /> active</label>
                <button type="button" onClick={() => { if (v.id) setRemoved([...removed, v.id]); set("variants", d.variants.filter((_, j) => j !== i)); }} className="grid size-9 cursor-pointer place-items-center rounded-full hover:bg-sand" aria-label="Remove duration"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => set("variants", [...d.variants, { duration_min: 90, price: 0, is_active: true }])} className="mt-2 inline-flex min-h-10 cursor-pointer items-center gap-1 text-sm font-semibold text-violet"><Plus className="size-4" /> Add duration</button>
        </div>
        {err && <Notice kind="error">{err}</Notice>}
        <button onClick={save} disabled={busy} className="btn btn-ink w-full">{busy && <Loader2 className="size-4 animate-spin" />} Save</button>
      </div>
    </Modal>
  );
}

function CategoryModal({ draft, onClose, onSaved }: { draft: Partial<Category> | null; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Partial<Category> | null>(draft);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form when opened
  useEffect(() => { setD(draft); setErr(null); }, [draft]);
  if (!d) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;

  const save = async () => {
    if (!d.name_en?.trim() || !d.name_hi?.trim()) return setErr("English and Hindi names are required.");
    setBusy(true);
    const row = { name_en: d.name_en.trim(), name_hi: d.name_hi.trim(), kind: d.kind ?? "spa", slug: d.slug || slugify(d.name_en), description_en: d.description_en || null, description_hi: d.description_hi || null, sort: Number(d.sort) || 0, is_active: d.is_active ?? true };
    const db = supabaseBrowser();
    const r = d.id ? await db.from("service_categories").update(row).eq("id", d.id) : await db.from("service_categories").insert(row);
    setBusy(false);
    if (r.error) return setErr(r.error.message);
    onSaved();
  };

  return (
    <Modal open={!!draft} onClose={onClose} title={d.id ? "Edit category" : "New category"}>
      <div className="space-y-4">
        <div><label className="label" htmlFor="c-en">Name (English)</label><input id="c-en" className="field" value={d.name_en ?? ""} onChange={(e) => setD({ ...d, name_en: e.target.value })} /></div>
        <div><label className="label" htmlFor="c-hi">Name (Hindi)</label><input id="c-hi" className="field" value={d.name_hi ?? ""} onChange={(e) => setD({ ...d, name_hi: e.target.value })} /></div>
        <div><label className="label" htmlFor="c-den">Short description (English)</label><input id="c-den" className="field" value={d.description_en ?? ""} onChange={(e) => setD({ ...d, description_en: e.target.value })} /></div>
        <div><label className="label" htmlFor="c-dhi">Short description (Hindi)</label><input id="c-dhi" className="field" value={d.description_hi ?? ""} onChange={(e) => setD({ ...d, description_hi: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="c-kind">Section</label>
            <select id="c-kind" className="field" value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as "spa" | "salon" })}><option value="spa">Spa</option><option value="salon">Salon</option></select>
          </div>
          <div><label className="label" htmlFor="c-sort">Order</label><input id="c-sort" className="field" inputMode="numeric" value={d.sort ?? 0} onChange={(e) => setD({ ...d, sort: Number(e.target.value) })} /></div>
        </div>
        <Toggle id="c-active" label="Show on website" checked={d.is_active ?? true} onChange={(v) => setD({ ...d, is_active: v })} />
        {err && <Notice kind="error">{err}</Notice>}
        <button onClick={save} disabled={busy} className="btn btn-ink w-full">{busy && <Loader2 className="size-4 animate-spin" />} Save</button>
      </div>
    </Modal>
  );
}

