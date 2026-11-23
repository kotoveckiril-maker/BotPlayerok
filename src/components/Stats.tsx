"use client";

import { useMemo, useState } from "react";
import type { StatsResult } from "@/lib/bot/stats";
import {
  Badge,
  Btn,
  Card,
  Delta,
  Empty,
  Kpi,
  api,
  fmtMoney,
  fmtNum,
  usePoll,
} from "./ui";
import { BarChart, Donut } from "./charts";

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

const MODULE_LABEL: Record<string, string> = {
  delivery: "Выдача",
  confirm: "Подтверждение",
  ai: "ИИ",
  raise: "Поднятие",
  restore: "Восстановление",
  deals: "Сделки",
  bot: "Бот",
  auth: "Вход",
  system: "Система",
  notify: "Уведомления",
  prune: "Очистка",
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  delivered: { label: "Выдано", color: "#34d399" },
  processing: { label: "В процессе", color: "#fbbf24" },
  no_stock: { label: "Нет на складе", color: "#f87171" },
  failed: { label: "Ошибка", color: "#fb7185" },
};

function csv(stats: StatsResult): string {
  const lines = ["date,revenue,orders,delivered"];
  for (const d of stats.daily) lines.push(`${d.date},${d.revenue},${d.orders},${d.delivered}`);
  return lines.join("\n");
}

export default function Stats() {
  const [range, setRange] = useState<Range>(7);
  const [stats, setStats] = useState<StatsResult | null>(null);

  const load = async () => {
    try {
      setStats(await api<StatsResult>(`/api/stats?range=${range}`));
    } catch {
      /* ignore */
    }
  };
  usePoll(load, 15000);

  const donutSegments = useMemo(
    () =>
      (stats?.deliveryStatus ?? []).map((s) => ({
        label: STATUS_META[s.status]?.label ?? s.status,
        value: s.count,
        color: STATUS_META[s.status]?.color ?? "#64748b",
      })),
    [stats],
  );

  const maxProductRevenue = Math.max(1, ...(stats?.topProducts ?? []).map((p) => p.revenue));
  const maxModule = Math.max(1, ...(stats?.moduleActivity ?? []).map((m) => m.total));

  const exportCsv = () => {
    if (!stats) return;
    const blob = new Blob([csv(stats)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `botplayerok-stats-${range}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!stats) {
    return (
      <div className="grid gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl border border-white/10 bg-slate-900/50" />
        ))}
      </div>
    );
  }

  const k = stats.kpi;

  return (
    <div className="space-y-5">
      <Card
        title="Статистика продаж"
        subtitle="Данные синхронизируются с Playerok и обновляются автоматически"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-white/10 bg-slate-950/50 p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`rounded-md px-3 py-1 text-xs transition ${
                    range === r
                      ? "bg-indigo-500 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {r} дн
                </button>
              ))}
            </div>
            <Btn small variant="ghost" onClick={exportCsv}>
              ⬇ CSV
            </Btn>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi
            label="Выручка"
            value={fmtMoney(k.revenue)}
            sub={<Delta value={pct(k.revenue, k.revenuePrev)} />}
            tone="text-emerald-300"
            icon="💰"
          />
          <Kpi
            label="Продажи"
            value={fmtNum(k.orders)}
            sub={<Delta value={pct(k.orders, k.ordersPrev)} />}
            icon="🛒"
          />
          <Kpi
            label="Средний чек"
            value={fmtMoney(k.avgCheck)}
            sub={k.orders ? "на сделку" : ""}
            icon="🧾"
          />
          <Kpi
            label="Успешность выдач"
            value={`${k.deliverySuccess}%`}
            sub={`${fmtNum(k.delivered)} выдано · ${fmtNum(k.failed)} ошибок`}
            tone={k.deliverySuccess >= 95 ? "text-emerald-300" : "text-amber-300"}
            icon="✅"
          />
          <Kpi
            label="ИИ-ответы"
            value={fmtNum(k.aiReplies)}
            sub={`${fmtNum(k.aiHandoffs)} передач продавцу`}
            tone="text-violet-300"
            icon="🤖"
          />
          <Kpi
            label="Ошибки"
            value={fmtNum(k.errors)}
            sub={`предупреждений: ${fmtNum(k.warnings)}`}
            tone={k.errors ? "text-rose-300" : "text-white"}
            icon="⚠️"
          />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Выручка по дням"
          subtitle={`Всего ${fmtMoney(k.revenue)} за ${range} дней · в скобках продажи`}
        >
          <BarChart
            data={stats.daily.map((d) => ({
              label: d.date.slice(5).split("-").reverse().join("."),
              value: d.revenue,
              secondary: d.orders,
            }))}
            formatValue={(v) => fmtMoney(v)}
            color="#34d399"
            height={200}
            empty="За период ещё нет продаж"
          />
        </Card>

        <Card title="Статусы выдач" subtitle="Все время">
          {donutSegments.length ? (
            <Donut
              segments={donutSegments}
              centerLabel="выдач"
              centerValue={fmtNum(k.delivered + k.failed + k.noStock)}
            />
          ) : (
            <Empty>Выдач пока не было</Empty>
          )}
          <div className="mt-4 space-y-1.5 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Среднее время выдачи</span>
              <span className="text-slate-200">{k.avgDeliverySec ?? "—"} с</span>
            </div>
            <div className="flex justify-between">
              <span>Ожидают оплаты</span>
              <span className="text-slate-200">{fmtNum(k.pending)}</span>
            </div>
            <div className="flex justify-between">
              <span>Нет на складе</span>
              <span className={k.noStock ? "text-rose-300" : "text-slate-200"}>{fmtNum(k.noStock)}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Топ товаров" subtitle="По выручке за выбранный период">
          {stats.topProducts.length === 0 ? (
            <Empty>Нет продаж за период</Empty>
          ) : (
            <ul className="space-y-3">
              {stats.topProducts.map((p) => (
                <li key={p.name}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-slate-200" title={p.name}>
                      {p.name}
                    </span>
                    <span className="shrink-0 text-slate-400">
                      {p.orders} шт · <span className="text-emerald-300">{fmtMoney(p.revenue)}</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${(p.revenue / maxProductRevenue) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Топ покупателей" subtitle="По количеству покупок">
          {stats.topBuyers.length === 0 ? (
            <Empty>Нет покупателей за период</Empty>
          ) : (
            <ul className="space-y-2">
              {stats.topBuyers.map((b, i) => (
                <li key={b.name} className="flex items-center gap-3 text-sm">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/5 text-xs text-slate-400">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-200">{b.name}</span>
                  <Badge tone="sky">{b.orders} покупок</Badge>
                  <span className="w-24 text-right text-emerald-300">{fmtMoney(b.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Активность модулей" subtitle="Количество записей в журнале за период">
          {stats.moduleActivity.length === 0 ? (
            <Empty>Журнал пуст</Empty>
          ) : (
            <ul className="space-y-2.5">
              {stats.moduleActivity.map((m) => (
                <li key={m.module}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-300">{MODULE_LABEL[m.module] ?? m.module}</span>
                    <span className="text-slate-500">
                      {m.total}
                      {m.errors > 0 && <span className="ml-2 text-rose-300">ошибок {m.errors}</span>}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div
                      className={`h-full rounded-full ${m.errors ? "bg-rose-500" : "bg-sky-500"}`}
                      style={{ width: `${(m.total / maxModule) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="ИИ-автоответчик" subtitle="Ответы и передача диалога продавцу по дням">
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge tone="violet">ответов {fmtNum(k.aiReplies)}</Badge>
            <Badge tone="amber">передач {fmtNum(k.aiHandoffs)}</Badge>
            <Badge tone="slate">токенов {fmtNum(k.aiTokens)}</Badge>
          </div>
          <BarChart
            data={stats.aiDaily.map((d) => ({
              label: d.date.slice(5).split("-").reverse().join("."),
              value: d.replies,
              secondary: d.handoffs,
            }))}
            formatValue={(v) => `${v} ответов`}
            color="#a78bfa"
            height={150}
            empty="ИИ ещё не отвечал"
          />
        </Card>
      </div>

      <Card title="Продажи по дням" subtitle="Количество сделок">
        <BarChart
          data={stats.daily.map((d) => ({
            label: d.date.slice(5).split("-").reverse().join("."),
            value: d.orders,
          }))}
          formatValue={(v) => `${v} сделок`}
          color="#38bdf8"
          height={130}
          empty="Нет сделок"
        />
      </Card>
    </div>
  );
}

function pct(a: number, b: number): number | null {
  if (!b) return null;
  return Math.round(((a - b) / b) * 1000) / 10;
}
