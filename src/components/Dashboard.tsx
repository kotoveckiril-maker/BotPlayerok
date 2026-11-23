"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, api, fmtAgo, fmtDur, fmtMoney, usePoll } from "./ui";
import Overview from "./Overview";
import Stats from "./Stats";
import Products from "./Products";
import PlayerokItems from "./PlayerokItems";
import Deliveries from "./Deliveries";
import Deals from "./Deals";
import SettingsPanel from "./SettingsPanel";
import Logs from "./Logs";

const TABS = [
  { id: "overview", label: "Обзор", icon: "📊" },
  { id: "stats", label: "Статистика", icon: "📈" },
  { id: "products", label: "Товары и склад", icon: "📦" },
  { id: "items", label: "Лоты Playerok", icon: "🛒" },
  { id: "deals", label: "Сделки", icon: "🧾" },
  { id: "deliveries", label: "Выдачи", icon: "🚀" },
  { id: "settings", label: "Настройки", icon: "⚙️" },
  { id: "logs", label: "Логи", icon: "📜" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface Top {
  engine: {
    active: boolean;
    busy: boolean;
    uptimeSec: number;
    avgTickMs: number | null;
    lastTickAt: number | null;
    lastError: string | null;
    accountInfo: { username: string; balance: number; unreadChats: number } | null;
  };
  account: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("overview");
  const [top, setTop] = useState<Top | null>(null);
  const [menu, setMenu] = useState(false);

  const load = async () => {
    try {
      setTop(await api<Top>("/api/bot"));
    } catch {
      /* ignore */
    }
  };
  usePoll(load, 5000);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  const running = top?.engine.active ?? false;
  const account = top?.engine.accountInfo?.username || top?.account || "";

  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col gap-6 px-4 py-5 md:flex-row md:px-6">
      <aside className="md:w-60 md:shrink-0">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-xl shadow-lg shadow-indigo-500/20">
            🤖
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight text-white">BotPlayerok</div>
            <div className="text-xs text-slate-400">автоматизация продаж</div>
          </div>
        </div>

        <button
          className="mb-2 w-full rounded-lg border border-white/10 px-3 py-2 text-left text-sm text-slate-300 md:hidden"
          onClick={() => setMenu((v) => !v)}
        >
          {TABS.find((t) => t.id === tab)?.icon} {TABS.find((t) => t.id === tab)?.label} ▾
        </button>

        <nav
          className={`${menu ? "flex" : "hidden"} gap-1 overflow-x-auto pb-1 md:flex md:flex-col md:overflow-visible`}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setMenu(false);
              }}
              className={`flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition ${
                tab === t.id
                  ? "bg-indigo-500/20 text-white ring-1 ring-indigo-400/40"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              }`}
            >
              <span className="text-base">{t.icon}</span>
              {t.label}
            </button>
          ))}
          <div className="mt-3 hidden border-t border-white/10 pt-3 md:block">
            <div className="px-3 text-[10px] font-medium uppercase tracking-wide text-slate-600">
              Статус
            </div>
            <div className="mt-2 space-y-1 px-3 text-xs text-slate-500">
              <div>Аптайм: {fmtDur(top?.engine.uptimeSec ?? 0)}</div>
              <div>Цикл: {top?.engine.avgTickMs != null ? `${(top.engine.avgTickMs / 1000).toFixed(2)} с` : "—"}</div>
              <div>Баланс: {fmtMoney(top?.engine.accountInfo?.balance ?? null)}</div>
              <div>Чатов: {top?.engine.accountInfo?.unreadChats ?? "—"}</div>
            </div>
          </div>
        </nav>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${running ? "animate-dot bg-emerald-400" : "bg-slate-500"}`}
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">
                {running ? "Бот работает" : top ? "Бот остановлен" : "Подключение…"}
              </div>
              <div className="truncate text-xs text-slate-500">
                {account ? `@${account}` : "аккаунт не подключён"}
                {top?.engine.lastTickAt ? ` · последний цикл ${fmtAgo(top.engine.lastTickAt)}` : ""}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {top?.engine.busy && <Badge tone="indigo">цикл…</Badge>}
            {top?.engine.lastError ? (
              <Badge tone="red" title={top.engine.lastError}>
                ошибка
              </Badge>
            ) : (
              running && <Badge tone="green">online</Badge>
            )}
            <button
              onClick={logout}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
            >
              Выйти
            </button>
          </div>
        </div>

        {tab === "overview" && <Overview goTo={(t) => setTab(t as TabId)} />}
        {tab === "stats" && <Stats />}
        {tab === "products" && <Products />}
        {tab === "items" && <PlayerokItems goTo={(t) => setTab(t as TabId)} />}
        {tab === "deals" && <Deals />}
        {tab === "deliveries" && <Deliveries />}
        {tab === "settings" && <SettingsPanel />}
        {tab === "logs" && <Logs />}
      </main>
    </div>
  );
}
