"use client";

import { useState } from "react";
import { Badge, Btn, Card, api } from "./ui";
import { DEFAULT_UNIT_MESSAGE, type Product } from "./Products";

interface Item {
  id: string;
  name: string;
  status: string;
  price: number;
  priority?: string;
  viewsCounter?: number;
  dealsCounter?: number;
  likesCounter?: number;
  slug?: string;
}

const STATUS: Record<string, { label: string; tone: "green" | "slate" | "amber" | "red" | "sky" }> = {
  APPROVED: { label: "Активен", tone: "green" },
  SOLD: { label: "Продан", tone: "sky" },
  EXPIRED: { label: "Истёк", tone: "amber" },
  PENDING_APPROVAL: { label: "На проверке", tone: "slate" },
  PENDING_MODERATION: { label: "На модерации", tone: "slate" },
  DECLINED: { label: "Отклонён", tone: "red" },
  DRAFT: { label: "Черновик", tone: "slate" },
};

export default function PlayerokItems({ goTo }: { goTo: (t: string) => void }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [linked, setLinked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const [r, prods] = await Promise.all([
        api<{ ok: boolean; items?: Item[]; error?: string }>("/api/playerok/items"),
        api<Product[]>("/api/products"),
      ]);
      setLinked(new Set(prods.map((p) => p.playerokItemId).filter(Boolean)));
      if (r.ok) setItems(r.items ?? []);
      else setErr(r.error ?? "Ошибка");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  };

  const act = async (action: "raise" | "restore", it: Item) => {
    setBusy(`${action}:${it.id}`);
    setNote("");
    const r = await api<{ ok: boolean; error?: string }>("/api/playerok/items", {
      method: "POST",
      body: { action, itemId: it.id },
    });
    setNote(
      r.ok
        ? `«${it.name}»: ${action === "raise" ? "поднят" : "восстановлен"}`
        : `«${it.name}»: ${r.error ?? "ошибка"}`,
    );
    setBusy("");
    load();
  };

  const link = async (it: Item) => {
    await api("/api/products", {
      method: "POST",
      body: {
        title: it.name,
        mode: "unit",
        playerokItemId: it.id,
        message: DEFAULT_UNIT_MESSAGE,
      },
    });
    goTo("products");
  };

  return (
    <Card
      title="Лоты на Playerok"
      subtitle="Ваши товары с площадки: привязка к выдаче, ручное поднятие и восстановление"
      right={
        <Btn variant="primary" onClick={load} disabled={loading}>
          {loading ? "Загрузка…" : items ? "Обновить" : "Загрузить"}
        </Btn>
      }
    >
      {err && (
        <div className="mb-3 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">
          {err}
        </div>
      )}
      {note && (
        <div className="mb-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">{note}</div>
      )}
      {!items && !err && (
        <p className="text-sm text-slate-500">Нажмите «Загрузить», чтобы получить список лотов (нужен токен в настройках).</p>
      )}
      {items && items.length === 0 && <p className="text-sm text-slate-500">Лотов нет.</p>}
      {items && items.length > 0 && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
              <div className="text-[11px] text-slate-500">Всего лотов</div>
              <div className="text-lg font-semibold text-white">{items.length}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
              <div className="text-[11px] text-slate-500">Активных</div>
              <div className="text-lg font-semibold text-emerald-300">
                {items.filter((i) => i.status === "APPROVED").length}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
              <div className="text-[11px] text-slate-500">Просмотров</div>
              <div className="text-lg font-semibold text-white">
                {items.reduce((a, i) => a + (i.viewsCounter ?? 0), 0).toLocaleString("ru-RU")}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
              <div className="text-[11px] text-slate-500">Продаж по лотам</div>
              <div className="text-lg font-semibold text-sky-300">
                {items.reduce((a, i) => a + (i.dealsCounter ?? 0), 0).toLocaleString("ru-RU")}
              </div>
            </div>
          </div>
          <ul className="divide-y divide-white/5">
          {items.map((it) => {
            const st = STATUS[it.status] ?? { label: it.status, tone: "slate" as const };
            const isLinked = linked.has(it.id);
            return (
              <li key={it.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">{it.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <span>{it.price} ₽</span>
                    {it.priority && <span>{it.priority}</span>}
                    {typeof it.viewsCounter === "number" && <span title="Просмотры">👁 {it.viewsCounter}</span>}
                    {typeof it.dealsCounter === "number" && it.dealsCounter > 0 && (
                      <span title="Продажи">🛒 {it.dealsCounter}</span>
                    )}
                    {typeof it.likesCounter === "number" && it.likesCounter > 0 && (
                      <span title="Лайки">❤️ {it.likesCounter}</span>
                    )}
                    <code className="text-slate-500">{it.id}</code>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!isLinked ? (
                    <Btn small variant="ghost" onClick={() => link(it)}>
                      Привязать
                    </Btn>
                  ) : (
                    <Badge tone="indigo">привязан</Badge>
                  )}
                  {it.status === "APPROVED" && (
                    <Btn small disabled={!!busy} onClick={() => act("raise", it)}>
                      {busy === `raise:${it.id}` ? "…" : "⬆️ Поднять"}
                    </Btn>
                  )}
                  {(it.status === "SOLD" || it.status === "EXPIRED") && (
                    <Btn small disabled={!!busy} onClick={() => act("restore", it)}>
                      {busy === `restore:${it.id}` ? "…" : "♻️ Восстановить"}
                    </Btn>
                  )}
                </div>
              </li>
            );
          })}
          </ul>
        </>
      )}
    </Card>
  );
}
