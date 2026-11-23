"use client";

import { useState } from "react";
import {
  Badge,
  Btn,
  Card,
  Delta,
  Empty,
  Kpi,
  Notice,
  api,
  fmtAgo,
  fmtDate,
  fmtDur,
  fmtMoney,
  fmtNum,
  usePoll,
} from "./ui";
import { Sparkline } from "./charts";
import type { StatsResult } from "@/lib/bot/stats";

interface ModuleMetrics {
  runs: number;
  ok: number;
  errors: number;
  lastRunAt: number | null;
  lastOkAt: number | null;
  lastMs: number | null;
  avgMs: number | null;
  lastError: string | null;
  lastResult: string;
}

interface Status {
  engine: {
    active: boolean;
    busy: boolean;
    startedAt: number | null;
    lastTickAt: number | null;
    lastTickMs: number | null;
    avgTickMs: number | null;
    lastError: string | null;
    ticks: number;
    uptimeSec: number;
    accountInfo: {
      username: string;
      balance: number;
      unreadChats: number;
      updatedAt: number;
    } | null;
    tickHistory: { at: number; ms: number; ok: boolean }[];
    modules: Record<string, ModuleMetrics>;
  };
  system: {
    node: string;
    rssMb: number;
    heapUsedMb: number;
    load1: number;
    platform: string;
  };
  account: string;
  settings: {
    hasToken: boolean;
    hasAiKey: boolean;
    hasTgToken: boolean;
    autoDelivery: boolean;
    autoConfirm: boolean;
    autoRaise: boolean;
    autoRestore: boolean;
    aiEnabled: boolean;
    syncDeals: boolean;
    notifySales: boolean;
    notifyErrors: boolean;
  };
  stats: {
    products: number;
    stock: number;
    delivered: number;
    delivered24: number;
    processing: number;
    noStock: number;
    errors24: number;
  };
}

interface LogRow {
  id: number;
  level: string;
  module: string;
  message: string;
  createdAt: string;
}

export const levelTone = (l: string) =>
  l === "error" ? "red" : l === "warn" ? "amber" : l === "success" ? "green" : "slate";

const MODULE_LABELS: Record<string, { label: string; icon: string; key?: keyof Status["settings"] }> = {
  delivery: { label: "Авто-выдача", icon: "🚀", key: "autoDelivery" },
  confirm: { label: "Авто-подтверждение", icon: "☑️", key: "autoConfirm" },
  ai: { label: "ИИ-автоответ", icon: "🤖", key: "aiEnabled" },
  raise: { label: "Авто-поднятие", icon: "⬆️", key: "autoRaise" },
  restore: { label: "Восстановление", icon: "♻️", key: "autoRestore" },
  deals: { label: "Синхронизация сделок", icon: "🔄", key: "syncDeals" },
};

export default function Overview({ goTo }: { goTo: (t: string) => void }) {
  const [st, setSt] = useState<Status | null>(null);
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadFast = async () => {
    try {
      const [a, c] = await Promise.all([
        api<Status>("/api/bot"),
        api<LogRow[]>("/api/logs?limit=10"),
      ]);
      setSt(a);
      setLogs(c);
    } catch {
      /* ignore */
    }
  };
  const loadStats = async () => {
    try {
      setStats(await api<StatsResult>("/api/stats?range=7"));
    } catch {
      /* ignore */
    }
  };
  usePoll(loadFast, 5000);
  usePoll(loadStats, 20000);

  const act = async (action: string, label: string) => {
    setBusy(action);
    setMsg(null);
    try {
      const r = await api<{
        ok: boolean;
        error?: string;
        info?: { username: string; balance: number };
      }>("/api/bot", { method: "POST", body: { action } });
      if (r.ok) {
        setMsg({
          ok: true,
          text:
            action === "test" && r.info
              ? `Подключено: ${r.info.username}, баланс ${fmtMoney(r.info.balance)}`
              : `${label}: готово`,
        });
      } else setMsg({ ok: false, text: r.error ?? "Ошибка" });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
    setBusy("");
    loadFast();
    loadStats();
  };

  const running = st?.engine.active ?? false;
  const today = stats?.daily[stats.daily.length - 1];
  const tickValues = st?.engine.tickHistory.map((t) => t.ms) ?? [];
  const account = st?.engine.accountInfo;

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span
              className={`relative flex h-4 w-4 ${running ? "" : "opacity-60"}`}
              aria-hidden
            >
              {running && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              )}
              <span
                className={`relative inline-flex h-4 w-4 rounded-full ${
                  running ? "bg-emerald-400" : "bg-slate-500"
                }`}
              />
            </span>
            <div>
              <div className="text-lg font-semibold text-white">
                {running ? "Бот работает" : "Бот остановлен"}
              </div>
              <div className="text-sm text-slate-400">
                {st?.account ? `Аккаунт: ${st.account} · ` : ""}
                Аптайм: {fmtDur(st?.engine.uptimeSec ?? 0)} · Циклов:{" "}
                {fmtNum(st?.engine.ticks ?? 0)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {running ? (
              <Btn variant="danger" disabled={!!busy} onClick={() => act("stop", "Остановка")}>
                ⏹ Остановить
              </Btn>
            ) : (
              <Btn
                variant="success"
                disabled={!!busy || !st?.settings.hasToken}
                onClick={() => act("start", "Запуск")}
              >
                ▶ Запустить
              </Btn>
            )}
            <Btn
              disabled={!!busy || !st?.settings.hasToken}
              onClick={() => act("tick", "Цикл")}
            >
              {busy === "tick" ? "Выполняется…" : "⟳ Выполнить цикл"}
            </Btn>
            <Btn
              variant="ghost"
              disabled={!!busy || !st?.settings.hasToken}
              onClick={() => act("test", "Проверка")}
            >
              Проверить подключение
            </Btn>
          </div>
        </div>

        {st && !st.settings.hasToken && (
          <div className="mt-4">
            <Notice tone="amber">
              Сначала укажите токен Playerok в{" "}
              <button className="underline" onClick={() => goTo("settings")}>
                настройках
              </button>
              . Без него бот не сможет работать.
            </Notice>
          </div>
        )}

        {msg && (
          <div className="mt-4">
            <Notice tone={msg.ok ? "green" : "red"}>{msg.text}</Notice>
          </div>
        )}

        {st?.engine.lastError && (
          <div className="mt-4">
            <Notice tone="red">Последняя ошибка: {st.engine.lastError}</Notice>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Mini label="Баланс Playerok" value={fmtMoney(account?.balance ?? null)} icon="💳" />
          <Mini label="Непрочитанных чатов" value={fmtNum(account?.unreadChats ?? null)} icon="💬" />
          <Mini
            label="Последний цикл"
            value={st?.engine.lastTickMs != null ? `${(st.engine.lastTickMs / 1000).toFixed(2)} с` : "—"}
            sub={st?.engine.lastTickAt ? fmtAgo(st.engine.lastTickAt) : ""}
            icon="⚡"
          />
          <Mini
            label="Память"
            value={`${fmtNum(st?.system.rssMb ?? null)} МБ`}
            sub={`Node ${st?.system.node.replace("v", "") ?? ""}`}
            icon="🧠"
          />
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/40 p-3">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>Длительность последних циклов</span>
            <span>{tickValues.length} замеров</span>
          </div>
          <Sparkline values={tickValues} color="#6366f1" height={42} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="Выручка за 7 дней"
          value={fmtMoney(stats?.kpi.revenue)}
          sub={<Delta value={stats ? pct(stats.kpi.revenue, stats.kpi.revenuePrev) : null} />}
          tone="text-emerald-300"
          icon="💰"
        />
        <Kpi
          label="Продажи за 7 дней"
          value={fmtNum(stats?.kpi.orders)}
          sub={<Delta value={stats ? pct(stats.kpi.orders, stats.kpi.ordersPrev) : null} />}
          icon="🛒"
        />
        <Kpi
          label="Средний чек"
          value={fmtMoney(stats?.kpi.avgCheck)}
          sub={stats?.kpi.orders ? `${stats.kpi.orders} сделок` : ""}
          icon="🧾"
        />
        <Kpi
          label="Выдачи за 24 ч"
          value={fmtNum(st?.stats.delivered24)}
          sub={`всего ${fmtNum(st?.stats.delivered)}`}
          tone="text-sky-300"
          icon="🚀"
        />
        <Kpi
          label="Единиц на складе"
          value={fmtNum(st?.stats.stock)}
          sub={
            stats && (stats.kpi.outOfStock > 0 || stats.kpi.lowStock > 0)
              ? `${stats.kpi.outOfStock} пусто · ${stats.kpi.lowStock} мало`
              : "всё в порядке"
          }
          tone={stats && stats.kpi.outOfStock > 0 ? "text-rose-300" : "text-white"}
          icon="📦"
        />
        <Kpi
          label="Ошибки за 24 ч"
          value={fmtNum(st?.stats.errors24)}
          sub={stats ? `предупреждений: ${stats.kpi.warnings}` : ""}
          tone={st && st.stats.errors24 > 0 ? "text-rose-300" : "text-white"}
          icon="⚠️"
        />
      </div>

      <Card title="Модули" subtitle="Состояние и последняя активность каждого модуля">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {Object.entries(MODULE_LABELS).map(([id, meta]) => {
            const m = st?.engine.modules[id];
            const enabled = meta.key ? !!st?.settings[meta.key] : true;
            return (
              <div
                key={id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm text-slate-200">
                    <span>{meta.icon}</span>
                    <span className="truncate">{meta.label}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-slate-500">
                    {m?.lastRunAt
                      ? `${fmtAgo(m.lastRunAt)} · ${m.avgMs != null ? `${m.avgMs} мс` : ""} · ошибок ${m.errors}`
                      : "ещё не запускался"}
                  </div>
                  {m?.lastError && (
                    <div className="mt-0.5 truncate text-[11px] text-rose-300" title={m.lastError}>
                      {m.lastError}
                    </div>
                  )}
                </div>
                <Badge tone={!enabled ? "slate" : m?.lastError ? "red" : m?.lastRunAt ? "green" : "indigo"}>
                  {!enabled ? "выкл" : m?.lastError ? "ошибка" : m?.lastRunAt ? "ок" : "готов"}
                </Badge>
              </div>
            );
          })}
        </div>
        {st?.settings.aiEnabled && !st.settings.hasAiKey && (
          <p className="mt-3 text-sm text-amber-300">
            ИИ включён, но не указан API-ключ — ответы отправляться не будут.
          </p>
        )}
        {st && !st.settings.hasTgToken && (
          <p className="mt-2 text-xs text-slate-500">
            💬 Telegram-уведомления не настроены — можно включить в настройках.
          </p>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="Последние события"
          right={
            <Btn small variant="ghost" onClick={() => goTo("logs")}>
              Все логи
            </Btn>
          }
        >
          {logs.length === 0 ? (
            <Empty>Пока пусто. Запустите бота или выполните цикл.</Empty>
          ) : (
            <ul className="space-y-2">
              {logs.map((l) => (
                <li key={l.id} className="flex items-start gap-2 text-sm">
                  <Badge tone={levelTone(l.level)}>{l.module}</Badge>
                  <span className="min-w-0 flex-1 break-words text-slate-300">{l.message}</span>
                  <span className="shrink-0 text-xs text-slate-500">{fmtDate(l.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Быстрая сводка" subtitle="Сегодня и за последние 7 дней">
          <div className="space-y-2 text-sm">
            <Row label="Выручка сегодня" value={fmtMoney(today?.revenue ?? null)} />
            <Row label="Продажи сегодня" value={fmtNum(today?.orders ?? null)} />
            <Row label="Выдачи за 24 ч" value={fmtNum(st?.stats.delivered24)} />
            <Row label="Ожидают выдачи" value={fmtNum(st?.stats.processing)} tone={st?.stats.processing ? "text-amber-300" : undefined} />
            <Row label="Нет на складе" value={fmtNum(st?.stats.noStock)} tone={st?.stats.noStock ? "text-rose-300" : undefined} />
            <Row label="Успешность выдач" value={`${stats?.kpi.deliverySuccess ?? 100}%`} />
            <Row label="Среднее время выдачи" value={`${stats?.kpi.avgDeliverySec ?? "—"} с`} />
          </div>
          <div className="mt-4">
            <Btn small variant="ghost" onClick={() => goTo("stats")}>
              Открыть полную статистику →
            </Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Mini({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span className="truncate">{label}</span>
        {icon && <span>{icon}</span>}
      </div>
      <div className="mt-0.5 truncate text-lg font-semibold text-white">{value}</div>
      {sub && <div className="truncate text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-1.5 last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className={`font-medium ${tone ?? "text-slate-100"}`}>{value}</span>
    </div>
  );
}

function pct(a: number, b: number): number | null {
  if (!b) return null;
  return Math.round(((a - b) / b) * 1000) / 10;
}
