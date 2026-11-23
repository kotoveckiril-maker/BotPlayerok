"use client";

import { useState } from "react";
import { Badge, Btn, Card, Field, Select, TextArea, TextInput, Toggle, api, fmtDate, usePoll } from "./ui";

export interface Product {
  id: number;
  title: string;
  mode: "unit" | "message";
  playerokItemId: string;
  keyword: string;
  message: string;
  description: string;
  enabled: boolean;
  available: number;
  sold: number;
}

interface Stock {
  id: number;
  content: string;
  status: string;
  dealId: string | null;
  soldAt: string | null;
}

export const DEFAULT_UNIT_MESSAGE =
  "Спасибо за покупку! ✅\n\nВаш товар:\n{data}\n\nПожалуйста, подтвердите получение и оставьте отзыв ❤️";

const empty = {
  title: "",
  mode: "unit" as "unit" | "message",
  playerokItemId: "",
  keyword: "",
  message: DEFAULT_UNIT_MESSAGE,
  description: "",
};

export default function Products() {
  const [list, setList] = useState<Product[]>([]);
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  const load = async () => {
    try {
      setList(await api<Product[]>("/api/products"));
    } catch {
      /* ignore */
    }
  };
  usePoll(load, 8000);

  const create = async () => {
    setErr("");
    try {
      await api("/api/products", { method: "POST", body: form });
      setForm(empty);
      setShowForm(false);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-5">
      <Card
        title="Товары"
        subtitle="Правила авто-выдачи: какой лот → что отправить покупателю"
        right={
          <Btn variant="primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Закрыть" : "+ Добавить товар"}
          </Btn>
        }
      >
        {showForm && (
          <ProductForm
            value={form}
            onChange={setForm}
            onSubmit={create}
            submitLabel="Создать"
            error={err}
          />
        )}
        {list.length === 0 && !showForm && (
          <p className="text-sm text-slate-500">
            Товаров пока нет. Добавьте товар вручную или привяжите лот на вкладке «Лоты Playerok».
          </p>
        )}
      </Card>

      {list.map((p) => (
        <ProductCard
          key={p.id}
          p={p}
          open={open === p.id}
          toggle={() => setOpen(open === p.id ? null : p.id)}
          reload={load}
        />
      ))}
    </div>
  );
}

function ProductForm({
  value,
  onChange,
  onSubmit,
  submitLabel,
  error,
}: {
  value: typeof empty;
  onChange: (v: typeof empty) => void;
  onSubmit: () => void;
  submitLabel: string;
  error?: string;
}) {
  const set = <K extends keyof typeof empty>(k: K, v: (typeof empty)[K]) =>
    onChange({ ...value, [k]: v });
  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-slate-950/40 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Название">
          <TextInput value={value.title} onChange={(e) => set("title", e.target.value)} placeholder="Например: Ключ Steam" />
        </Field>
        <Field label="Тип выдачи">
          <Select value={value.mode} onChange={(e) => set("mode", e.target.value as "unit" | "message")}>
            <option value="unit">Поштучная — каждая единица со склада</option>
            <option value="message">Сообщением — один и тот же текст</option>
          </Select>
        </Field>
        <Field label="ID лота на Playerok" hint="Точная привязка (см. вкладку «Лоты Playerok»)">
          <TextInput value={value.playerokItemId} onChange={(e) => set("playerokItemId", e.target.value)} />
        </Field>
        <Field label="или ключевое слово в названии лота" hint="Без учёта регистра">
          <TextInput value={value.keyword} onChange={(e) => set("keyword", e.target.value)} />
        </Field>
      </div>
      <Field
        label="Сообщение покупателю"
        hint={
          value.mode === "unit"
            ? "Плейсхолдеры: {data} — выдаваемая единица, {buyer} — ник покупателя, {item} — название лота"
            : "Плейсхолдеры: {buyer}, {item}"
        }
      >
        <TextArea rows={5} value={value.message} onChange={(e) => set("message", e.target.value)} />
      </Field>
      <Field label="Описание для ИИ-помощника (необязательно)" hint="Что отвечать покупателям про этот товар: сроки, условия, регион и т.д.">
        <TextArea rows={2} value={value.description} onChange={(e) => set("description", e.target.value)} />
      </Field>
      {error && <p className="text-sm text-rose-300">{error}</p>}
      <Btn variant="primary" onClick={onSubmit}>
        {submitLabel}
      </Btn>
    </div>
  );
}

function ProductCard({
  p,
  open,
  toggle,
  reload,
}: {
  p: Product;
  open: boolean;
  toggle: () => void;
  reload: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    title: p.title,
    mode: p.mode,
    playerokItemId: p.playerokItemId,
    keyword: p.keyword,
    message: p.message,
    description: p.description,
  });
  const [err, setErr] = useState("");

  const save = async () => {
    setErr("");
    try {
      await api(`/api/products/${p.id}`, { method: "PATCH", body: form });
      setEdit(false);
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-white">{p.title}</h3>
            <Badge tone={p.mode === "unit" ? "indigo" : "sky"}>
              {p.mode === "unit" ? "поштучно" : "сообщением"}
            </Badge>
            {!p.enabled && <Badge tone="amber">отключён</Badge>}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {p.playerokItemId ? `ID: ${p.playerokItemId}` : ""}
            {p.playerokItemId && p.keyword ? " · " : ""}
            {p.keyword ? `ключ: «${p.keyword}»` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {p.mode === "unit" && (
            <Badge tone={p.available > 0 ? (p.available <= 3 ? "amber" : "green") : "red"}>
              на складе: {p.available}
            </Badge>
          )}
          <Btn small variant="ghost" onClick={toggle}>
            {open ? "Свернуть" : p.mode === "unit" ? "Склад" : "Подробнее"}
          </Btn>
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
          <Toggle
            label="Товар активен"
            hint="Отключённый товар не участвует в выдаче и восстановлении"
            checked={p.enabled}
            onChange={async (v) => {
              await api(`/api/products/${p.id}`, { method: "PATCH", body: { enabled: v } });
              reload();
            }}
          />
          {edit ? (
            <>
              <ProductForm value={form} onChange={setForm} onSubmit={save} submitLabel="Сохранить" error={err} />
            </>
          ) : (
            <div className="rounded-xl bg-slate-950/40 p-3 text-sm">
              <div className="mb-1 text-xs text-slate-400">Сообщение покупателю:</div>
              <pre className="whitespace-pre-wrap break-words font-sans text-slate-200">{p.message || "—"}</pre>
            </div>
          )}
          <div className="flex gap-2">
            <Btn small variant="ghost" onClick={() => setEdit((v) => !v)}>
              {edit ? "Отмена" : "Редактировать"}
            </Btn>
            <Btn
              small
              variant="danger"
              onClick={async () => {
                if (!confirm(`Удалить «${p.title}» вместе со складом?`)) return;
                await api(`/api/products/${p.id}`, { method: "DELETE" });
                reload();
              }}
            >
              Удалить
            </Btn>
          </div>
          {p.mode === "unit" && <StockManager productId={p.id} onChange={reload} />}
        </div>
      )}
    </Card>
  );
}

function StockManager({ productId, onChange }: { productId: number; onChange: () => void }) {
  const [rows, setRows] = useState<Stock[]>([]);
  const [text, setText] = useState("");
  const [sep, setSep] = useState<"line" | "blank">("line");
  const [msg, setMsg] = useState("");

  const load = async () => {
    try {
      setRows(await api<Stock[]>(`/api/products/${productId}/stock`));
    } catch {
      /* ignore */
    }
  };
  usePoll(load, 10000);

  const add = async () => {
    setMsg("");
    try {
      const r = await api<{ added: number }>(`/api/products/${productId}/stock`, {
        method: "POST",
        body: { lines: text, separator: sep },
      });
      setText("");
      setMsg(`Добавлено: ${r.added}`);
      load();
      onChange();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const del = async (qs: string) => {
    await api(`/api/products/${productId}/stock?${qs}`, { method: "DELETE" });
    load();
    onChange();
  };

  const available = rows.filter((r) => r.status === "available");
  const sold = rows.filter((r) => r.status === "sold");

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <Field label="Пополнить склад" hint="Каждая строка (или блок через пустую строку) — одна единица товара: ключ, логин:пароль и т.д.">
          <TextArea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={"XXXX-XXXX-XXXX\nYYYY-YYYY-YYYY"} />
        </Field>
        <div className="flex flex-col gap-2 md:w-48">
          <Field label="Разделитель">
            <Select value={sep} onChange={(e) => setSep(e.target.value as "line" | "blank")}>
              <option value="line">Новая строка</option>
              <option value="blank">Пустая строка</option>
            </Select>
          </Field>
          <Btn variant="primary" onClick={add} disabled={!text.trim()}>
            Добавить на склад
          </Btn>
          {msg && <span className="text-xs text-slate-400">{msg}</span>}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
            <span>Доступно ({available.length})</span>
            {available.length > 0 && (
              <button className="text-rose-300 hover:underline" onClick={() => confirm("Очистить весь доступный склад?") && del("scope=available")}>
                очистить
              </button>
            )}
          </div>
          <ul className="max-h-56 space-y-1 overflow-auto rounded-lg bg-slate-950/40 p-2">
            {available.length === 0 && <li className="text-xs text-slate-500">Пусто</li>}
            {available.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                <code className="min-w-0 flex-1 truncate text-slate-200">{r.content}</code>
                <button className="text-slate-500 hover:text-rose-300" onClick={() => del(`stockId=${r.id}`)} aria-label="Удалить">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
            <span>Продано ({sold.length})</span>
            {sold.length > 0 && (
              <button className="text-rose-300 hover:underline" onClick={() => del("scope=sold")}>
                очистить
              </button>
            )}
          </div>
          <ul className="max-h-56 space-y-1 overflow-auto rounded-lg bg-slate-950/40 p-2">
            {sold.length === 0 && <li className="text-xs text-slate-500">Пусто</li>}
            {sold.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                <code className="min-w-0 flex-1 truncate text-slate-400">{r.content}</code>
                <span className="shrink-0 text-slate-500">{fmtDate(r.soldAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
