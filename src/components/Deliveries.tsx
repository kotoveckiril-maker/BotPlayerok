"use client";

import { useState } from "react";
import { Badge, Btn, Card, Empty, api, fmtDate, fmtMoney, usePoll } from "./ui";

interface Row {
  id: number;
  dealId: string;
  itemName: string;
  buyer: string;
  status: string;
  delivered: string;
  error: string;
  attempts: number;
  confirmed: boolean;
  confirmedAt: string | null;
  price: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  product: string | null;
}

const TONE: Record<string, "green" | "amber" | "red" | "slate"> = {
  delivered: "green",
  processing: "amber",
  no_stock: "red",
  failed: "red",
};
const LABEL: Record<string, string> = {
  delivered: "выдано",
  processing: "в процессе",
  no_stock: "нет на складе",
  failed: "ошибка",
};

const FILTERS = ["all", "delivered", "processing", "no_stock", "failed"] as const;
type Filter = (typeof FILTERS)[number];

export default function Deliveries() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<Filter>("all");

  const load = async () => {
    try {
      setRows(await api<Row[]>(`/api/deliveries?limit=500${filter !== "all" ? `&status=${filter}` : ""}`));
    } catch {
      /* ignore */
    }
  };
  usePoll(load, 6000);

  const revenue = rows.filter((r) => r.status === "delivered").reduce((a, r) => a + r.price, 0);
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Card
      title="История выдач"
      subtitle="Последние сделки, обработанные ботом"
      right={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-white/10 bg-slate-950/50 p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-2.5 py-1 text-xs transition ${
                  filter === f ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {f === "all" ? "Все" : LABEL[f] ?? f}
                {f === "all" ? ` ${rows.length}` : ` ${counts[f] ?? 0}`}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <Badge tone="green">выручка в списке: {fmtMoney(revenue)}</Badge>
        <Badge tone="slate">сделок: {rows.length}</Badge>
      </div>

      {rows.length === 0 ? (
        <Empty>Выдач пока не было.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-slate-400">
              <tr>
                <th className="pb-2 pr-3 font-medium">Время</th>
                <th className="pb-2 pr-3 font-medium">Лот / покупатель</th>
                <th className="pb-2 pr-3 font-medium">Сумма</th>
                <th className="pb-2 pr-3 font-medium">Статус</th>
                <th className="pb-2 pr-3 font-medium">Подтверждена</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="py-2.5 pr-3 text-xs text-slate-400">{fmtDate(r.createdAt)}</td>
                  <td className="py-2.5 pr-3">
                    <div className="max-w-[280px] truncate text-slate-100" title={r.itemName || r.product || ""}>
                      {r.itemName || r.product}
                    </div>
                    <div className="text-xs text-slate-500">
                      {r.buyer} · <code>{r.dealId}</code>
                    </div>
                    {r.error && <div className="mt-0.5 max-w-[320px] text-xs text-rose-300">{r.error}</div>}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-200">{r.price ? fmtMoney(r.price, r.currency) : "—"}</td>
                  <td className="py-2.5 pr-3">
                    <Badge tone={TONE[r.status] ?? "slate"}>{LABEL[r.status] ?? r.status}</Badge>
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-slate-400">
                    {r.confirmed ? `✅ ${r.confirmedAt ? fmtDate(r.confirmedAt) : ""}` : "—"}
                  </td>
                  <td className="py-2.5 text-right">
                    {r.status !== "delivered" && (
                      <Btn
                        small
                        variant="ghost"
                        onClick={async () => {
                          if (!confirm("Сбросить сделку для повторной выдачи?")) return;
                          await api(`/api/deliveries?id=${r.id}`, { method: "DELETE" });
                          load();
                        }}
                      >
                        Сбросить
                      </Btn>
                    )}
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
