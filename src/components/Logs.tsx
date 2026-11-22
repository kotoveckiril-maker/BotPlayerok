"use client";

import { useState } from "react";
import { Badge, Btn, Card, api, fmtDate, usePoll } from "./ui";
import { levelTone } from "./Overview";

interface LogRow {
  id: number;
  level: string;
  module: string;
  message: string;
  createdAt: string;
}

export default function Logs() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    try {
      setRows(await api<LogRow[]>("/api/logs?limit=300"));
    } catch {
      /* ignore */
    }
  };
  usePoll(load, 4000);

  const shown = filter === "all" ? rows : rows.filter((r) => r.level === filter);

  return (
    <Card
      title="Журнал событий"
      subtitle="Хранится 7 дней"
      right={
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1 text-xs text-white"
          >
            <option value="all">Все</option>
            <option value="success">Успех</option>
            <option value="info">Инфо</option>
            <option value="warn">Предупреждения</option>
            <option value="error">Ошибки</option>
          </select>
          <Btn
            small
            variant="ghost"
            onClick={async () => {
              await api("/api/logs", { method: "DELETE" });
              load();
            }}
          >
            Очистить
          </Btn>
        </div>
      }
    >
      {shown.length === 0 ? (
        <p className="text-sm text-slate-500">Записей нет.</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {shown.map((l) => (
            <li key={l.id} className="flex items-start gap-3 py-2 text-sm">
              <span className="w-32 shrink-0 text-xs text-slate-500">{fmtDate(l.createdAt)}</span>
              <span className="w-24 shrink-0">
                <Badge tone={levelTone(l.level)}>{l.module}</Badge>
              </span>
              <span className="min-w-0 flex-1 break-words text-slate-300">{l.message}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
