"use client";

import { useCallback, useState } from "react";
import { Badge, Btn, Card, Empty, api, fmtDate, fmtMoney, usePoll } from "./ui";

interface DealRow {
  id: string;
  status: string;
  direction: string;
  buyerId: string;
  buyerUsername: string;
  itemId: string;
  itemName: string;
  price: number;
  currency: string;
  chatId: string;
  createdAt: string;
  completedAt: string | null;
  updatedAt: string;
}

interface Resp {
  rows: DealRow[];
  labels: Record<string, string>;
  totals: { revenue: number; count: number };
}

const TONE: Record<string, "green" | "amber" | "red" | "sky" | "slate"> = {
  PAID: "sky",
  PENDING: "amber",
  SENT: "green",
  CONFIRMED: "green",
  CONFIRMED_AUTOMATICALLY: "green",
  ROLLED_BACK: "red",
};

const FILTERS = ["all", "PAID", "PENDING", "SENT", "CONFIRMED", "CONFIRMED_AUTOMATICALLY", "ROLLED_BACK"] as const;

export default function Deals() {
  const [data, setData] = useState<Resp | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async (f = filter, query = q) => {
    try {
      const params = new URLSearchParams({ limit: "500" });
      if (f !== "all") params.set("status", f);
      if (query.trim()) params.set("q", query.trim());
      setData(await api<Resp>(`/api/deals?${params}`));
    } catch {
      /* ignore */
    }
  }, [filter, q]);

  usePoll(() => {
    void load();
  }, 8000);

  const sync = async () => {
    setBusy(true);
    setNote("");
    try {
      const r = await api<{ ok: boolean; synced?: number; total?: number; error?: string }>(
        "/api/bot",
        { method: "POST", body: { action: "sync-deals" } },
      );
      setNote(
        r.ok
          ? `Синхронизировано сделок: ${r.synced ?? 0} (получено ${r.total ?? 0})`
          : (r.error ?? "Ошибка"),
      );
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
    load();
  };

  return (
    <Card
      title="Сделки Playerok"
      subtitle="Зеркало сделок с площадки — источник данных для статистики"
      right={
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              void load(filter, e.target.value);
            }}
            placeholder="Поиск…"
            className="w-32 rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1 text-xs text-white placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none"
          />
          <Btn small variant="ghost" onClick={sync} disabled={busy}>
            {busy ? "Синхронизация…" : "⟳ Синхронизировать"}
          </Btn>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f);
              void load(f, q);
            }}
            className={`rounded-md px-2 py-1 text-xs transition ${
              filter === f ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {f === "all" ? "Все" : data?.labels[f] ?? f}
          </button>
        ))}
      </div>

      {note && <div className="mb-3 rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-slate-300">{note}</div>}

      <div className="mb-2 flex flex-wrap gap-2 text-xs">
        <Badge tone="green">выручка в списке: {fmtMoney(data?.totals.revenue ?? 0)}</Badge>
        <Badge tone="slate">сделок: {data?.totals.count ?? 0}</Badge>
      </div>

      {!data || data.rows.length === 0 ? (
        <Empty>
          Сделок пока нет. Нажмите «Синхронизировать» — бот подтянет историю с Playerok.
        </Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-slate-400">
              <tr>
                <th className="pb-2 pr-3 font-medium">Дата</th>
                <th className="pb-2 pr-3 font-medium">Товар / покупатель</th>
                <th className="pb-2 pr-3 font-medium">Сумма</th>
                <th className="pb-2 pr-3 font-medium">Статус</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="py-2.5 pr-3 text-xs text-slate-400">{fmtDate(r.createdAt)}</td>
                  <td className="py-2.5 pr-3">
                    <div className="max-w-[300px] truncate text-slate-100" title={r.itemName}>
                      {r.itemName || "—"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {r.buyerUsername || "—"} · <code>{r.id}</code>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-slate-200">
                    {r.price ? fmtMoney(r.price, r.currency) : "—"}
                  </td>
                  <td className="py-2.5 pr-3">
                    <Badge tone={TONE[r.status] ?? "slate"}>
                      {data.labels[r.status] ?? r.status}
                    </Badge>
                  </td>
                  <td className="py-2.5 text-right">
                    <a
                      href={`https://playerok.com/deal/${r.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-indigo-300 hover:underline"
                    >
                      Открыть →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
