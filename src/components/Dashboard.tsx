"use client";

import { useState } from "react";
import Overview from "./Overview";
import Products from "./Products";
import PlayerokItems from "./PlayerokItems";
import Deliveries from "./Deliveries";
import SettingsPanel from "./SettingsPanel";
import Logs from "./Logs";

const TABS = [
  { id: "overview", label: "Обзор", icon: "📊" },
  { id: "products", label: "Товары и склад", icon: "📦" },
  { id: "items", label: "Лоты Playerok", icon: "🛒" },
  { id: "deliveries", label: "Выдачи", icon: "🚀" },
  { id: "settings", label: "Настройки", icon: "⚙️" },
  { id: "logs", label: "Логи", icon: "📜" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Dashboard() {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row">
      <aside className="md:w-56 md:shrink-0">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-lg">
            🤖
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight text-white">Playerok Bot</div>
            <div className="text-xs text-slate-400">автоматизация продаж</div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition ${
                tab === t.id
                  ? "bg-indigo-500/20 text-white ring-1 ring-indigo-400/40"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1">
        {tab === "overview" && <Overview goTo={(t) => setTab(t as TabId)} />}
        {tab === "products" && <Products />}
        {tab === "items" && <PlayerokItems goTo={(t) => setTab(t as TabId)} />}
        {tab === "deliveries" && <Deliveries />}
        {tab === "settings" && <SettingsPanel />}
        {tab === "logs" && <Logs />}
      </main>
    </div>
  );
}
