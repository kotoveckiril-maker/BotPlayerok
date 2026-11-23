"use client";

import { useMemo, useState } from "react";
import { Badge, Btn, Card, Empty, api, fmtAgo, fmtDate, usePoll } from "./ui";
import { levelTone } from "./Overview";

interface LogRow {
  id: number;
  level: string;
  module: string;
  message: string;
  createdAt: string;
}

const LEVELS = [
  { id: "all", label: "Все" },
  { id: "error", label: "Ошибки" },
  { id: "warn", label: "Предупреждения" },
  { id: "success", label: "Успех" },
  { id: "info", label: "Инфо" },
];

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

export default function Logs() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [level, setLevel] = useState("all");
  const [module, setModule] = useState("all");
  const [search, setSearch] = useState("");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const load = async () => {
    try {
      const params = new URLSearchParams({ limit: "500" });
      if (level !== "all") params.set("level", level);
      if (module !== "all") params.set("module", module);
      setRows(await api<LogRow[]>(`/api/logs?${params}`));
      setUpdatedAt(Date.now());
    } catch {
      /* ignore */
    }
  };
  usePoll(load, 4000);

  const modules = useMemo(() => {
    const set = new Set(rows.map((r) => r.module));
    return [...set].sort();
  }, [rows]);

  const shown = search
    ? rows.filter((r) => r.message.toLowerCase().includes(search.toLowerCase()))
    : rows;

  return (
    <Card
      title="Журнал событий"
      subtitle="Хранится 7 дней · автообновление"
      right={
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск…"
            className="w-32 rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1 text-xs text-white placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none"
          />
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1 text-xs text-white"
          >
            {LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <select
            value={module}
            onChange={(e) => setModule(e.target.value)}
            className="max-w-[140px] rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1 text-xs text-white"
          >
            <option value="all">Все модули</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {MODULE_LABEL[m] ?? m}
              </option>
            ))}
          </select>
          <Btn
            small
            variant="ghost"
            onClick={async () => {
              if (!confirm("Очистить весь журнал?")) return;
              await api("/api/logs", { method: "DELETE" });
              load();
            }}
          >
            Очистить
          </Btn>
        </div>
      }
    >
      <div className="mb-2 text-[11px] text-slate-600">
        Записей: {shown.length} {updatedAt ? `· обновлено ${fmtAgo(updatedAt)}` : ""}
      </div>
      {shown.length === 0 ? (
        <Empty>Записей нет.</Empty>
      ) : (
        <ul className="divide-y divide-white/5">
          {shown.map((l) => (
            <li key={l.id} className="flex items-start gap-3 py-2 text-sm">
              <span className="hidden w-32 shrink-0 text-xs text-slate-500 sm:block">
                {fmtDate(l.createdAt)}
              </span>
              <span className="w-24 shrink-0">
                <Badge tone={levelTone(l.level)}>{MODULE_LABEL[l.module] ?? l.module}</Badge>
              </span>
              <span className="min-w-0 flex-1 break-words text-slate-300">{l.message}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
