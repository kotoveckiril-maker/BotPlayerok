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
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Ошибка ${res.status}`);
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

export function Card({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-slate-900/70 p-5 ${className}`}>
      {(title || right) && (
        <header className="mb-4 flex items-start justify-between gap-3">
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
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger" | "ghost" | "success";
  disabled?: boolean;
  small?: boolean;
  type?: "button" | "submit";
}) {
  const styles = {
    default: "bg-slate-700/70 hover:bg-slate-600 text-white",
    primary: "bg-indigo-500 hover:bg-indigo-400 text-white",
    success: "bg-emerald-500 hover:bg-emerald-400 text-white",
    danger: "bg-rose-500/90 hover:bg-rose-400 text-white",
    ghost: "bg-transparent hover:bg-white/10 text-slate-300 border border-white/10",
  }[variant];
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
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
  label: string;
  hint?: string;
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
}: {
  children: ReactNode;
  tone?: "slate" | "green" | "red" | "amber" | "indigo" | "sky";
}) {
  const t = {
    slate: "bg-slate-500/20 text-slate-300",
    green: "bg-emerald-500/15 text-emerald-300",
    red: "bg-rose-500/15 text-rose-300",
    amber: "bg-amber-500/15 text-amber-300",
    indigo: "bg-indigo-500/20 text-indigo-300",
    sky: "bg-sky-500/15 text-sky-300",
  }[tone];
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${t}`}>
      {children}
    </span>
  );
}

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
