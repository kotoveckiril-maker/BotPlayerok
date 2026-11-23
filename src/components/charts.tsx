"use client";

import type { ReactNode } from "react";

/** Колонки (HTML/CSS) — отзывчиво, без искажений текста. */
export function BarChart({
  data,
  height = 170,
  formatValue = (v) => String(v),
  color = "#6366f1",
  empty = "Нет данных за период",
}: {
  data: { label: string; value: number; secondary?: number }[];
  height?: number;
  formatValue?: (v: number) => string;
  color?: string;
  empty?: ReactNode;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const showEvery = data.length > 20 ? 5 : data.length > 10 ? 2 : 1;
  const hasData = data.some((d) => d.value > 0);

  if (!hasData) {
    return (
      <div
        className="grid place-items-center rounded-xl border border-dashed border-white/10 text-xs text-slate-500"
        style={{ height }}
      >
        {empty}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((d, i) => {
          const h = (d.value / max) * 100;
          return (
            <div key={`${d.label}-${i}`} className="group relative flex h-full flex-1 items-end">
              <div
                className="w-full rounded-t-md transition-all group-hover:brightness-125"
                style={{
                  height: `${Math.max(2, h)}%`,
                  background: `linear-gradient(180deg, ${color}, ${color}33)`,
                  minHeight: 3,
                }}
                title={`${d.label}: ${formatValue(d.value)}${
                  d.secondary != null ? ` · ${d.secondary}` : ""
                }`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1">
        {data.map((d, i) => (
          <div key={`l-${d.label}-${i}`} className="flex-1 text-center">
            <span className="text-[10px] leading-none text-slate-500">
              {i % showEvery === 0 || i === data.length - 1 ? d.label.slice(0, 5) : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Мини-график для «живых» метрик (длительность циклов). */
export function Sparkline({
  values,
  color = "#34d399",
  height = 36,
  className = "",
}: {
  values: number[];
  color?: string;
  height?: number;
  className?: string;
}) {
  if (values.length < 2) {
    return <div className={className} style={{ height }} />;
  }
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const w = 100;
  const h = 100;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 6) - 3;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={`w-full ${className}`}
      style={{ height }}
      aria-hidden
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Донат-диаграмма распределения. */
export function Donut({
  segments,
  size = 132,
  thickness = 16,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: ReactNode;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={thickness}
          />
          {total > 0 &&
            segments.map((s, i) => {
              const len = (s.value / total) * c;
              const el = (
                <circle
                  key={`${s.label}-${i}`}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  className="transition-all"
                />
              );
              offset += len;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-lg font-semibold text-white">{centerValue ?? total}</div>
            {centerLabel && <div className="text-[10px] text-slate-500">{centerLabel}</div>}
          </div>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {segments.map((s, i) => (
          <li key={`${s.label}-${i}`} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: s.color }}
            />
            <span className="min-w-0 flex-1 truncate text-slate-300">{s.label}</span>
            <span className="text-slate-500">
              {total ? Math.round((s.value / total) * 100) : 0}%
            </span>
            <span className="w-10 text-right text-slate-400">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
