"use client";

import { useState } from "react";
import { Badge, Btn, Card, api, fmtDate, usePoll } from "./ui";

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
  createdAt: string;
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

export default function Deliveries() {
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    try {
      setRows(await api<Row[]>("/api/deliveries"));
    } catch {
      /* ignore */
    }
  };
  usePoll(load, 5000);

  return (
    <Card title="История выдач" subtitle="Последние 200 сделок, обработанных ботом">
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Выдач пока не было.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-slate-400">
              <tr>
                <th className="pb-2 pr-3 font-medium">Время</th>
                <th className="pb-2 pr-3 font-medium">Лот / покупатель</th>
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
                    <div className="text-slate-100">{r.itemName || r.product}</div>
                    <div className="text-xs text-slate-500">
                      {r.buyer} · <code>{r.dealId}</code>
                    </div>
                    {r.error && <div className="mt-0.5 text-xs text-rose-300">{r.error}</div>}
                  </td>
                  <td className="py-2.5 pr-3">
                    <Badge tone={TONE[r.status] ?? "slate"}>{LABEL[r.status] ?? r.status}</Badge>
                  </td>
                  <td className="py-2.5 pr-3">{r.confirmed ? "✅" : "—"}</td>
                  <td className="py-2.5 text-right">
                    {r.status !== "delivered" && (
                      <Btn
                        small
                        variant="ghost"
                        onClick={async () => {
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
