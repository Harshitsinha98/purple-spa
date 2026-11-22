"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { BookingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ───────────── Time helpers (everything is shown in the spa's time zone) ───────────── */

const TZ = "Asia/Kolkata";
const IST_OFFSET = "+05:30";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hmFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export const istDay = (d: string | Date) => dayFmt.format(new Date(d));
export const istMinutes = (d: string | Date) => {
  const [h, m] = hmFmt.format(new Date(d)).split(":").map(Number);
  return h * 60 + m;
};
export const addDays = (day: string, n: number) => {
  const x = new Date(`${day}T12:00:00${IST_OFFSET}`);
  x.setUTCDate(x.getUTCDate() + n);
  return istDay(x);
};
const dow = (day: string) => new Date(`${day}T12:00:00${IST_OFFSET}`).getUTCDay(); // 0 = Sunday
const weekStart = (day: string) => addDays(day, -((dow(day) + 6) % 7)); // Monday
const monthStart = (day: string) => `${day.slice(0, 7)}-01`;
const startOfDayIso = (day: string) => new Date(`${day}T00:00:00${IST_OFFSET}`).toISOString();

export type CalView = "month" | "week" | "day";

/** The time window a view needs, for fetching bookings. */
export function calendarRange(view: CalView, day: string) {
  if (view === "day") return { from: startOfDayIso(day), to: startOfDayIso(addDays(day, 1)) };
  if (view === "week") {
    const s = weekStart(day);
    return { from: startOfDayIso(s), to: startOfDayIso(addDays(s, 7)) };
  }
  const s = weekStart(monthStart(day));
  return { from: startOfDayIso(s), to: startOfDayIso(addDays(s, 42)) };
}

const fmt = (day: string, o: Intl.DateTimeFormatOptions, locale = "en-IN") =>
  new Intl.DateTimeFormat(locale, { timeZone: TZ, ...o }).format(new Date(`${day}T12:00:00${IST_OFFSET}`));
const clock = (mins: number) => {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
};

/* ───────────── Styling per status ───────────── */

export const STATUS_STYLE: Record<BookingStatus, string> = {
  pending_payment: "border-gold/60 bg-[#fbf1dc] text-[#6b4d10]",
  confirmed: "border-cyan/60 bg-[#e3f7f9] text-[#0b5961]",
  assigned: "border-violet/50 bg-[#efe6f8] text-[#4a1f73]",
  in_progress: "border-orchid bg-[#f3dcff] text-[#5a1789]",
  completed: "border-emerald-300 bg-emerald-50 text-emerald-800",
  cancelled: "border-neutral-200 bg-neutral-50 text-neutral-500 line-through",
  no_show: "border-magenta/40 bg-[#fbe3ee] text-[#8f1f52]",
};

export type CalEvent = {
  id: string;
  start: string;
  end: string;
  title: string;
  subtitle?: string;
  status: BookingStatus;
  /** Column in the day view (e.g. therapist id). null = "Unassigned". */
  resourceId?: string | null;
};

type Props = {
  view: CalView;
  day: string;
  onViewChange: (v: CalView) => void;
  onDayChange: (d: string) => void;
  events: CalEvent[];
  loading?: boolean;
  onSelect: (id: string) => void;
  /** Day-view columns, like a team calendar. */
  resources?: { id: string; name: string }[];
  openMinutes?: number;
  closeMinutes?: number;
  dark?: boolean;
};

const PPM = 1.1; // pixels per minute in day/week views

/** Month / week / day calendar for bookings. */
export function BookingCalendar(props: Props) {
  const { view, day, onViewChange, onDayChange, loading, dark } = props;
  const today = istDay(new Date());

  const title =
    view === "month"
      ? fmt(day, { month: "long", year: "numeric" })
      : view === "week"
        ? `${fmt(weekStart(day), { day: "numeric", month: "short" })} – ${fmt(addDays(weekStart(day), 6), { day: "numeric", month: "short", year: "numeric" })}`
        : fmt(day, { weekday: "long", day: "numeric", month: "long" });

  const step = (dir: 1 | -1) => {
    if (view === "day") onDayChange(addDays(day, dir));
    else if (view === "week") onDayChange(addDays(day, 7 * dir));
    else {
      const [y, m] = day.split("-").map(Number);
      const d = new Date(Date.UTC(y, m - 1 + dir, 1));
      onDayChange(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`);
    }
  };

  return (
    <div className={cn("overflow-hidden rounded-2xl border", dark ? "border-ivory/10 bg-ivory text-ink" : "border-line bg-white")}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-3 md:px-4">
        <div className="flex items-center">
          <button onClick={() => step(-1)} className="grid size-10 cursor-pointer place-items-center rounded-full hover:bg-sand" aria-label="Previous">
            <ChevronLeft className="size-4" />
          </button>
          <button onClick={() => step(1)} className="grid size-10 cursor-pointer place-items-center rounded-full hover:bg-sand" aria-label="Next">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <button onClick={() => onDayChange(today)} className="min-h-9 cursor-pointer rounded-full border border-line px-3 text-sm font-medium hover:bg-sand">
          Today
        </button>
        <h2 className="ml-1 font-display text-xl md:text-2xl">{title}</h2>
        {loading && <Loader2 className="size-4 animate-spin text-muted" aria-label="Loading" />}
        <div role="tablist" aria-label="Calendar view" className="ml-auto inline-flex rounded-full border border-line bg-sand/50 p-0.5">
          {(["day", "week", "month"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => onViewChange(v)}
              className={cn("min-h-9 cursor-pointer rounded-full px-3.5 text-sm font-semibold capitalize transition-colors", view === v ? "bg-ink text-ivory" : "text-muted hover:text-ink")}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      {view === "month" ? <MonthGrid {...props} today={today} /> : <TimeGrid {...props} today={today} />}
    </div>
  );
}

function MonthGrid({ day, events, onSelect, onDayChange, onViewChange, today }: Props & { today: string }) {
  const start = weekStart(monthStart(day));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const byDay = useMemo(() => {
    const m: Record<string, CalEvent[]> = {};
    for (const e of [...events].sort((a, b) => a.start.localeCompare(b.start))) (m[istDay(e.start)] ??= []).push(e);
    return m;
  }, [events]);
  const month = day.slice(0, 7);
  const open = (d: string) => {
    onDayChange(d);
    onViewChange("day");
  };

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-line text-center text-[0.7rem] font-semibold uppercase tracking-wider text-muted">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const list = byDay[d] ?? [];
          const active = list.filter((e) => e.status !== "cancelled");
          return (
            <div key={d} className={cn("min-h-20 border-b border-line p-1 md:min-h-28 md:p-1.5", i % 7 !== 6 && "border-r", d.slice(0, 7) !== month && "bg-sand/30 text-muted")}>
              <button onClick={() => open(d)} className={cn("mb-1 grid size-7 cursor-pointer place-items-center rounded-full text-xs font-semibold", d === today ? "bg-violet text-white" : "hover:bg-sand")} aria-label={`Open ${d}`}>
                {Number(d.slice(8))}
              </button>
              {/* Phones get a count; larger screens show the first bookings. */}
              {active.length > 0 && (
                <button onClick={() => open(d)} className="block w-full cursor-pointer rounded-md bg-violet/10 px-1 py-0.5 text-[0.7rem] font-semibold text-violet md:hidden">
                  {active.length}
                </button>
              )}
              <ul className="hidden space-y-0.5 md:block">
                {list.slice(0, 3).map((e) => (
                  <li key={e.id}>
                    <button onClick={() => onSelect(e.id)} className={cn("block w-full cursor-pointer truncate rounded-md border-l-2 px-1.5 py-0.5 text-left text-[0.72rem]", STATUS_STYLE[e.status])}>
                      <span className="font-semibold tabular-nums">{clock(istMinutes(e.start))}</span> {e.title}
                    </button>
                  </li>
                ))}
                {list.length > 3 && (
                  <li>
                    <button onClick={() => open(d)} className="cursor-pointer px-1 text-[0.72rem] font-semibold text-violet">+{list.length - 3} more</button>
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Places overlapping events side by side. */
function lanes(list: CalEvent[]) {
  const sorted = [...list].sort((a, b) => a.start.localeCompare(b.start));
  const out: { e: CalEvent; lane: number; of: number }[] = [];
  let group: { e: CalEvent; lane: number }[] = [];
  let groupEnd = "";
  const flush = () => {
    const of = Math.max(1, ...group.map((g) => g.lane + 1));
    group.forEach((g) => out.push({ ...g, of }));
    group = [];
  };
  for (const e of sorted) {
    if (group.length && e.start >= groupEnd) flush();
    const used = new Set(group.filter((g) => g.e.end > e.start).map((g) => g.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    group.push({ e, lane });
    groupEnd = e.end > groupEnd || !groupEnd ? e.end : groupEnd;
  }
  flush();
  return out;
}

function TimeGrid({ view, day, events, onSelect, resources, openMinutes = 600, closeMinutes = 1290, today, onDayChange, onViewChange }: Props & { today: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // Grid spans opening hours, widened if a booking falls outside them.
  const visibleDays = new Set(view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(weekStart(day), i)) : [day]);
  const shown = events.filter((e) => visibleDays.has(istDay(e.start)));
  const startMin = Math.floor(Math.min(openMinutes, ...shown.map((e) => istMinutes(e.start))) / 60) * 60;
  const endMin = Math.ceil(Math.max(closeMinutes, ...shown.map((e) => Math.min(1440, istMinutes(e.end) || 1440))) / 60) * 60;
  const hours = Array.from({ length: (endMin - startMin) / 60 }, (_, i) => startMin + i * 60);
  const height = (endMin - startMin) * PPM;

  type Col = { key: string; label: string; sub?: string; day: string; filter: (e: CalEvent) => boolean; today?: boolean };
  const cols: Col[] =
    view === "week"
      ? Array.from({ length: 7 }, (_, i) => {
          const d = addDays(weekStart(day), i);
          return { key: d, label: fmt(d, { weekday: "short" }), sub: fmt(d, { day: "numeric" }), day: d, filter: (e) => istDay(e.start) === d, today: d === today };
        })
      : resources?.length
        ? [
            ...resources.map((r) => ({ key: r.id, label: r.name, day, today: day === today, filter: (e: CalEvent) => istDay(e.start) === day && e.resourceId === r.id })),
            { key: "_none", label: "Unassigned", day, today: day === today, filter: (e: CalEvent) => istDay(e.start) === day && (!e.resourceId || !resources.some((r) => r.id === e.resourceId)) },
          ]
        : [{ key: day, label: fmt(day, { weekday: "long" }), sub: fmt(day, { day: "numeric", month: "short" }), day, filter: (e: CalEvent) => istDay(e.start) === day, today: day === today }];

  const nowLine = now !== null ? istMinutes(new Date(now)) : null;
  const minColW = view === "week" ? 110 : resources?.length ? 170 : 0;

  return (
    <div ref={scroller} className="overflow-x-auto" data-lenis-prevent>
      <div style={{ minWidth: minColW ? 56 + cols.length * minColW : undefined }}>
        <div className="sticky top-0 z-10 flex border-b border-line bg-white">
          <div className="w-14 shrink-0" />
          {cols.map((c) => (
            <div key={c.key} className="flex-1 border-l border-line px-2 py-2 text-center">
              {view === "week" ? (
                <button onClick={() => { onDayChange(c.day); onViewChange("day"); }} className="cursor-pointer">
                  <span className="block text-[0.7rem] font-semibold uppercase tracking-wider text-muted">{c.label}</span>
                  <span className={cn("mx-auto mt-0.5 grid size-8 place-items-center rounded-full font-display text-lg", c.today && "bg-violet text-white")}>{c.sub}</span>
                </button>
              ) : (
                <span className="block truncate text-sm font-semibold">{c.label}{c.sub && <span className="ml-1 font-normal text-muted">{c.sub}</span>}</span>
              )}
            </div>
          ))}
        </div>
        <div className="flex">
          <div className="relative w-14 shrink-0" style={{ height }}>
            {hours.map((h) => (
              <span key={h} className={cn("absolute right-2 text-[0.68rem] text-muted tabular-nums", h === startMin ? "translate-y-0.5" : "-translate-y-1/2")} style={{ top: (h - startMin) * PPM }}>
                {clock(h)}
              </span>
            ))}
          </div>
          {cols.map((c) => {
            const placed = lanes(events.filter((e) => e.status !== "cancelled" && c.filter(e)));
            const isToday = c.day === today;
            return (
              <div key={c.key} className={cn("relative flex-1 border-l border-line", isToday && view === "week" && "bg-violet/[0.03]")} style={{ height }}>
                {hours.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-line/70" style={{ top: (h - startMin) * PPM }} />
                ))}
                {isToday && nowLine !== null && nowLine >= startMin && nowLine <= endMin && (
                  <div className="absolute inset-x-0 z-[5] flex items-center" style={{ top: (nowLine - startMin) * PPM }} aria-hidden>
                    <span className="-ml-1 size-2 rounded-full bg-magenta" />
                    <span className="h-px flex-1 bg-magenta" />
                  </div>
                )}
                {placed.map(({ e, lane, of }) => {
                  const s = istMinutes(e.start);
                  const len = Math.max(20, (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000);
                  return (
                    <button
                      key={e.id}
                      onClick={() => onSelect(e.id)}
                      className={cn("absolute z-[6] cursor-pointer overflow-hidden rounded-lg border-l-[3px] px-1.5 py-1 text-left text-[0.72rem] leading-tight shadow-sm transition-shadow hover:shadow-md", STATUS_STYLE[e.status])}
                      style={{ top: (s - startMin) * PPM + 1, height: len * PPM - 2, left: `calc(${(lane / of) * 100}% + 2px)`, width: `calc(${100 / of}% - 4px)` }}
                    >
                      <span className="block truncate font-semibold">{e.title}</span>
                      <span className="block truncate tabular-nums opacity-80">{clock(s)} – {clock(istMinutes(e.end))}</span>
                      {e.subtitle && len >= 50 && <span className="block truncate opacity-80">{e.subtitle}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
