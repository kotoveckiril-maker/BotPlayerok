"use client";

import { useEffect, useRef, type ReactNode } from "react";

export async function api<T = unknown>(
  url: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- редирект из общего API-хелпера
      window.location.assign("/login");
      throw new Error("Требуется вход");
    }
    throw new Error((json as { error?: string }).error ?? `Ошибка ${res.status}`);
  }
  return json as T;
}

export function usePoll(fn: () => void, ms: number) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    ref.current();
    const t = setInterval(() => ref.current(), ms);
    return () => clearInterval(t);
  }, [ms]);
}

/* ------------------------------- Форматирование ------------------------------- */

export function fmtDate(v: string | number | Date | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function fmtNum(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

export function fmtMoney(n: number | null | undefined, currency = "RUB") {
  if (n == null || !Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${fmtNum(n)} ₽`;
  }
}

export function fmtDur(sec: number | null | undefined) {
  if (sec == null || !Number.isFinite(sec)) return "—";
  if (sec < 60) return `${Math.round(sec)} с`;
  if (sec < 3600) return `${Math.floor(sec / 60)} мин ${Math.round(sec % 60)} с`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h} ч ${m} мин`;
}

export function fmtAgo(ts: number | null | undefined) {
  if (!ts) return "—";
  const diff = Math.max(0, Date.now() - ts) / 1000;
  if (diff < 5) return "только что";
  if (diff < 60) return `${Math.floor(diff)} с назад`;
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return `${Math.floor(diff / 86400)} дн назад`;
}

export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/* --------------------------------- Компоненты --------------------------------- */

export function Card({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-sm backdrop-blur-sm ${className}`}
    >
      {(title || right) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold text-white">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Btn({
  children,
  onClick,
  variant = "default",
  disabled,
  small,
  type = "button",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger" | "ghost" | "success";
  disabled?: boolean;
  small?: boolean;
  type?: "button" | "submit";
  title?: string;
}) {
  const styles = {
    default: "bg-slate-700/70 hover:bg-slate-600 text-white",
    primary: "bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/10",
    success: "bg-emerald-500 hover:bg-emerald-400 text-white",
    danger: "bg-rose-500/90 hover:bg-rose-400 text-white",
    ghost: "bg-transparent hover:bg-white/10 text-slate-300 border border-white/10",
  }[variant];
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={`rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
        small ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm"
      } ${styles}`}
    >
      {children}
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-1.5">
      <span>
        <span className="block text-sm text-slate-100">{label}</span>
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-indigo-500" : "bg-slate-600"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none";

export function Field({
  label,
  hint,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Badge({
  children,
  tone = "slate",
  title,
}: {
  children: ReactNode;
  tone?: "slate" | "green" | "red" | "amber" | "indigo" | "sky" | "violet";
  title?: string;
}) {
  const t = {
    slate: "bg-slate-500/20 text-slate-300",
    green: "bg-emerald-500/15 text-emerald-300",
    red: "bg-rose-500/15 text-rose-300",
    amber: "bg-amber-500/15 text-amber-300",
    indigo: "bg-indigo-500/20 text-indigo-300",
    sky: "bg-sky-500/15 text-sky-300",
    violet: "bg-violet-500/15 text-violet-300",
  }[tone];
  return (
    <span title={title} className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${t}`}>
      {children}
    </span>
  );
}

export function Kpi({
  label,
  value,
  sub,
  tone = "text-white",
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: string;
  icon?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-slate-400">{label}</div>
        {icon && <span className="text-base opacity-80">{icon}</span>}
      </div>
      <div className={`mt-1 truncate text-2xl font-semibold ${tone}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function Delta({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) return null;
  const up = value >= 0;
  return (
    <span className={up ? "text-emerald-400" : "text-rose-400"}>
      {up ? "▲" : "▼"} {Math.abs(value)}%
    </span>
  );
}

export function Progress({
  value,
  tone = "bg-indigo-500",
}: {
  value: number;
  tone?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Notice({
  tone = "amber",
  children,
}: {
  tone?: "amber" | "red" | "green" | "sky";
  children: ReactNode;
}) {
  const cls = {
    amber: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    red: "border-rose-400/30 bg-rose-400/10 text-rose-200",
    green: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    sky: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  }[tone];
  return (
    <div className={`rounded-lg border p-3 text-sm ${cls}`}>{children}</div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}
