"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-4xl text-ink">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-line bg-white", className)}>{children}</div>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Panel className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 font-display text-4xl tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Panel>
  );
}

export function Toggle({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id: string }) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
      <span className="text-sm font-medium text-ink">{label}</span>
      <span className="relative inline-flex">
        <input id={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-line transition-colors peer-checked:bg-violet peer-focus-visible:ring-2 peer-focus-visible:ring-orchid" />
        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} className={cn("m-auto w-[calc(100%-2rem)] rounded-2xl bg-white p-0 text-ink backdrop:bg-night/60", wide ? "max-w-3xl" : "max-w-lg")}>
      {open && (
        <div className="max-h-[85svh] overflow-y-auto p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="font-display text-2xl">{title}</h2>
            <button onClick={onClose} className="grid size-10 cursor-pointer place-items-center rounded-full hover:bg-sand" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Notice({ kind = "info", children }: { kind?: "info" | "error" | "ok"; children: ReactNode }) {
  return (
    <p role={kind === "error" ? "alert" : "status"} className={cn("rounded-xl px-4 py-3 text-sm", kind === "error" ? "bg-magenta/10 text-magenta" : kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-sand text-ink")}>
      {children}
    </p>
  );
}

export async function refreshPublicSite() {
  await fetch("/api/admin/revalidate", { method: "POST" }).catch(() => undefined);
}
