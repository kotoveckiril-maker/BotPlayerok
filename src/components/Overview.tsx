"use client";

import { useState } from "react";
import { Badge, Btn, Card, api, fmtDate, usePoll } from "./ui";

interface Status {
  engine: {
    active: boolean;
    busy: boolean;
    startedAt: number | null;
    lastTickAt: number | null;
    lastTickMs: number | null;
    lastError: string | null;
    ticks: number;
  };
  account: string;
  stats: {
    products: number;
    stock: number;
    delivered: number;
    delivered24: number;
    noStock: number;
    errors24: number;
  };
}

interface PublicSettings {
  hasToken: boolean;
  autoDelivery: boolean;
  autoConfirm: boolean;
  autoRaise: boolean;
  autoRestore: boolean;
  aiEnabled: boolean;
  hasAiKey: boolean;
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

export default function Overview({ goTo }: { goTo: (t: string) => void }) {
  const [st, setSt] = useState<Status | null>(null);
  const [set, setSet] = useState<PublicSettings | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    try {
      const [a, b, c] = await Promise.all([
        api<Status>("/api/bot"),
        api<PublicSettings>("/api/settings"),
        api<LogRow[]>("/api/logs?limit=8"),
      ]);
      setSt(a);
      setSet(b);
      setLogs(c);
    } catch {
      /* ignore */
    }
  };
  usePoll(load, 4000);

  const act = async (action: string, label: string) => {
    setBusy(action);
    setMsg(null);
    try {
      const r = await api<{ ok: boolean; error?: string; info?: { username: string; balance: number } }>(
        "/api/bot",
        { method: "POST", body: { action } },
      );
      if (r.ok) {
        setMsg({
          ok: true,
          text:
            action === "test" && r.info
              ? `Подключено: ${r.info.username}, баланс ${r.info.balance} ₽`
              : `${label}: готово`,
        });
      } else setMsg({ ok: false, text: r.error ?? "Ошибка" });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
    setBusy("");
    load();
  };

  const running = st?.engine.active ?? false;

  const modules = set
    ? [
        { name: "Авто-выдача", icon: "🚀", on: set.autoDelivery },
        { name: "Авто-поднятие", icon: "⬆️", on: set.autoRaise },
        { name: "Восстановление", icon: "♻️", on: set.autoRestore },
        { name: "Авто-подтверждение", icon: "☑️", on: set.autoConfirm },
        { name: "ИИ-автоответ", icon: "🤖", on: set.aiEnabled },
      ]
    : [];

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
                Последний цикл: {st?.engine.lastTickAt ? fmtDate(st.engine.lastTickAt) : "—"}
                {st?.engine.lastTickMs != null ? ` (${(st.engine.lastTickMs / 1000).toFixed(1)} с)` : ""}
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
                disabled={!!busy || !set?.hasToken}
                onClick={() => act("start", "Запуск")}
              >
                ▶ Запустить
              </Btn>
            )}
            <Btn disabled={!!busy || !set?.hasToken} onClick={() => act("tick", "Цикл")}>
              {busy === "tick" ? "Выполняется…" : "⟳ Выполнить цикл сейчас"}
            </Btn>
            <Btn variant="ghost" disabled={!!busy || !set?.hasToken} onClick={() => act("test", "Проверка")}>
              Проверить подключение
            </Btn>
          </div>
        </div>
        {!set?.hasToken && set && (
          <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
            Сначала укажите токен Playerok в{" "}
            <button className="underline" onClick={() => goTo("settings")}>
              настройках
            </button>
            .
          </div>
        )}
        {msg && (
          <div
            className={`mt-4 rounded-lg border p-3 text-sm ${
              msg.ok
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : "border-rose-400/30 bg-rose-400/10 text-rose-200"
            }`}
          >
            {msg.text}
          </div>
        )}
        {st?.engine.lastError && (
          <div className="mt-4 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">
            Последняя ошибка: {st.engine.lastError}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { l: "Выдано за 24 ч", v: st?.stats.delivered24 ?? "—", c: "text-emerald-300" },
          { l: "Выдано всего", v: st?.stats.delivered ?? "—", c: "text-white" },
          { l: "Единиц на складе", v: st?.stats.stock ?? "—", c: "text-sky-300" },
          {
            l: "Ждут пополнения",
            v: st?.stats.noStock ?? "—",
            c: st && st.stats.noStock > 0 ? "text-rose-300" : "text-white",
          },
        ].map((x) => (
          <div key={x.l} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <div className="text-xs text-slate-400">{x.l}</div>
            <div className={`mt-1 text-2xl font-semibold ${x.c}`}>{x.v}</div>
          </div>
        ))}
      </div>

      <Card title="Модули" subtitle="Включаются в настройках">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <div
              key={m.name}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5"
            >
              <span className="text-sm text-slate-200">
                {m.icon} {m.name}
              </span>
              <Badge tone={m.on ? "green" : "slate"}>{m.on ? "вкл" : "выкл"}</Badge>
            </div>
          ))}
        </div>
        {set?.aiEnabled && !set.hasAiKey && (
          <p className="mt-3 text-sm text-amber-300">ИИ включён, но не указан API-ключ.</p>
        )}
      </Card>

      <Card
        title="Последние события"
        right={
          <Btn small variant="ghost" onClick={() => goTo("logs")}>
            Все логи
          </Btn>
        }
      >
        {logs.length === 0 ? (
          <p className="text-sm text-slate-500">Пока пусто.</p>
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
    </div>
  );
}
