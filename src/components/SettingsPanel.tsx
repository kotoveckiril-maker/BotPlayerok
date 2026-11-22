"use client";

import { useEffect, useState } from "react";
import { Badge, Btn, Card, Field, TextArea, TextInput, Toggle, api } from "./ui";

interface S {
  hasToken: boolean;
  tokenPreview: string;
  hasCookies: boolean;
  hasAiKey: boolean;
  userAgent: string;
  accountUsername: string;
  pollIntervalSec: number;
  autoDelivery: boolean;
  autoConfirm: boolean;
  autoRaise: boolean;
  raiseIntervalMin: number;
  raiseMaxPrice: number;
  autoRestore: boolean;
  restoreIntervalMin: number;
  restoreSold: boolean;
  restoreExpired: boolean;
  restoreUnlinked: boolean;
  aiEnabled: boolean;
  aiBaseUrl: string;
  aiModel: string;
  aiTemperature: number;
  aiCooldownSec: number;
  aiHistoryLimit: number;
  aiMaxAgeMin: number;
  aiSystemPrompt: string;
}

export default function SettingsPanel() {
  const [s, setS] = useState<S | null>(null);
  const [token, setToken] = useState("");
  const [cookies, setCookies] = useState("");
  const [aiKey, setAiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api<S>("/api/settings").then(setS);
  }, []);

  if (!s) return <Card>Загрузка…</Card>;

  const up = <K extends keyof S>(k: K, v: S[K]) => setS({ ...s, [k]: v });
  const num = (k: keyof S) => (e: React.ChangeEvent<HTMLInputElement>) =>
    up(k, Number(e.target.value) as never);

  const save = async () => {
    setSaving(true);
    setNote(null);
    try {
      const body: Record<string, unknown> = { ...s };
      body.playerokToken = token;
      body.playerokCookies = cookies;
      body.aiApiKey = aiKey;
      const r = await api<S>("/api/settings", { method: "PUT", body });
      setS(r);
      setToken("");
      setCookies("");
      setAiKey("");
      setNote({ ok: true, text: "Настройки сохранены" });
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
    setSaving(false);
  };

  const clear = async (k: "playerokToken" | "playerokCookies" | "aiApiKey") => {
    const r = await api<S>("/api/settings", { method: "PUT", body: { [k]: "__clear__" } });
    setS({ ...s, hasToken: r.hasToken, tokenPreview: r.tokenPreview, hasCookies: r.hasCookies, hasAiKey: r.hasAiKey });
  };

  const testAi = async () => {
    setNote(null);
    await save();
    const r = await api<{ ok: boolean; answer?: string; error?: string }>("/api/bot", {
      method: "POST",
      body: { action: "test-ai" },
    });
    setNote(
      r.ok
        ? { ok: true, text: `Тест ИИ. Вопрос: «Товар в наличии? Как быстро получу?» → ${r.answer}` }
        : { ok: false, text: r.error ?? "Ошибка ИИ" },
    );
  };

  return (
    <div className="space-y-5">
      <Card
        title="Аккаунт Playerok"
        subtitle="Токен берётся из браузера: playerok.com → F12 → Application → Cookies → token"
        right={s.accountUsername ? <Badge tone="green">{s.accountUsername}</Badge> : undefined}
      >
        <div className="grid gap-3">
          <Field label="Токен (cookie token)" hint={s.hasToken ? `Сохранён: ${s.tokenPreview}. Оставьте пустым, чтобы не менять.` : "Не задан"}>
            <TextInput type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder={s.hasToken ? "••••••••" : "вставьте токен"} />
          </Field>
          <Field label="Полная строка Cookie (рекомендуется)" hint="Скопируйте заголовок Cookie из запроса в DevTools → Network. Нужен для обхода антибот-защиты (__ddg*), запускать нужно с того же IP.">
            <TextArea rows={3} autoComplete="off" value={cookies} onChange={(e) => setCookies(e.target.value)} placeholder={s.hasCookies ? "Сохранено (скрыто). Вставьте новое значение, чтобы заменить." : "token=...; __ddg1_=...; ..."} />
          </Field>
          <Field label="User-Agent браузера (необязательно)" hint="Должен совпадать с браузером, из которого взяты cookie">
            <TextInput value={s.userAgent} onChange={(e) => up("userAgent", e.target.value)} />
          </Field>
          <div className="flex gap-2">
            {s.hasToken && (
              <Btn small variant="ghost" onClick={() => clear("playerokToken")}>
                Удалить токен
              </Btn>
            )}
            {s.hasCookies && (
              <Btn small variant="ghost" onClick={() => clear("playerokCookies")}>
                Удалить cookie
              </Btn>
            )}
          </div>
        </div>
      </Card>

      <Card title="Общие">
        <div className="max-w-xs">
          <Field label="Интервал опроса, сек" hint="Как часто бот проверяет сделки и чаты (5–3600)">
            <TextInput type="number" min={5} value={s.pollIntervalSec} onChange={num("pollIntervalSec")} />
          </Field>
        </div>
      </Card>

      <Card title="🚀 Авто-выдача и ☑️ подтверждение">
        <Toggle label="Авто-выдача товаров" hint="После оплаты отправляет покупателю товар со склада или сообщение" checked={s.autoDelivery} onChange={(v) => up("autoDelivery", v)} />
        <Toggle label="Авто-подтверждение сделок" hint="После выдачи автоматически отмечает сделку как выполненную (статус «Продавец подтвердил»)" checked={s.autoConfirm} onChange={(v) => up("autoConfirm", v)} />
      </Card>

      <Card title="⬆️ Авто-поднятие товаров">
        <Toggle label="Включить авто-поднятие" hint="Периодически поднимает все активные лоты" checked={s.autoRaise} onChange={(v) => up("autoRaise", v)} />
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Field label="Интервал, мин">
            <TextInput type="number" min={5} value={s.raiseIntervalMin} onChange={num("raiseIntervalMin")} />
          </Field>
          <Field label="Макс. цена одного поднятия, ₽" hint="0 — только бесплатные статусы. Платный приоритет Playerok списывается с баланса кошелька.">
            <TextInput type="number" min={0} value={s.raiseMaxPrice} onChange={num("raiseMaxPrice")} />
          </Field>
        </div>
      </Card>

      <Card title="♻️ Восстановление товаров">
        <Toggle label="Авто-восстановление" hint="Повторно выставляет проданные и истёкшие лоты" checked={s.autoRestore} onChange={(v) => up("autoRestore", v)} />
        <Toggle label="Восстанавливать проданные" checked={s.restoreSold} onChange={(v) => up("restoreSold", v)} />
        <Toggle label="Восстанавливать истёкшие" checked={s.restoreExpired} onChange={(v) => up("restoreExpired", v)} />
        <Toggle label="Восстанавливать и непривязанные лоты" hint="По умолчанию — только лоты, привязанные к товарам (у поштучных — если есть остаток на складе). Осторожно: включит всю историю продаж." checked={s.restoreUnlinked} onChange={(v) => up("restoreUnlinked", v)} />
        <div className="mt-2 max-w-xs">
          <Field label="Интервал проверки, мин">
            <TextInput type="number" min={1} value={s.restoreIntervalMin} onChange={num("restoreIntervalMin")} />
          </Field>
        </div>
      </Card>

      <Card title="🤖 ИИ-автоответчик" subtitle="Отвечает покупателям в чатах через OpenAI-совместимый API (OpenAI, OpenRouter, DeepSeek, Groq и др.)">
        <Toggle label="Включить ИИ-ответы" hint="Если ИИ не уверен — пишет [HANDOFF], и бот не отвечает (запись попадёт в логи)" checked={s.aiEnabled} onChange={(v) => up("aiEnabled", v)} />
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Field label="Base URL API">
            <TextInput value={s.aiBaseUrl} onChange={(e) => up("aiBaseUrl", e.target.value)} />
          </Field>
          <Field label="Модель">
            <TextInput value={s.aiModel} onChange={(e) => up("aiModel", e.target.value)} />
          </Field>
          <Field label="API-ключ" hint={s.hasAiKey ? "Ключ задан. Оставьте пустым, чтобы не менять." : "Не задан (можно также переменная окружения OPENAI_API_KEY)"}>
            <TextInput type="password" autoComplete="off" value={aiKey} onChange={(e) => setAiKey(e.target.value)} placeholder={s.hasAiKey ? "••••••••" : "sk-..."} />
          </Field>
          <Field label={`Креативность: ${(s.aiTemperature / 10).toFixed(1)}`}>
            <input type="range" min={0} max={10} value={s.aiTemperature} onChange={num("aiTemperature")} className="w-full accent-indigo-500" />
          </Field>
          <Field label="Пауза между ответами в чате, сек">
            <TextInput type="number" min={0} value={s.aiCooldownSec} onChange={num("aiCooldownSec")} />
          </Field>
          <Field label="Сообщений истории в контексте">
            <TextInput type="number" min={1} max={40} value={s.aiHistoryLimit} onChange={num("aiHistoryLimit")} />
          </Field>
          <Field label="Не отвечать на сообщения старше, мин">
            <TextInput type="number" min={1} value={s.aiMaxAgeMin} onChange={num("aiMaxAgeMin")} />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Системная инструкция" hint="Каталог товаров (названия и описания) подставляется автоматически">
            <TextArea rows={6} value={s.aiSystemPrompt} onChange={(e) => up("aiSystemPrompt", e.target.value)} />
          </Field>
        </div>
        <div className="mt-3 flex gap-2">
          <Btn variant="ghost" onClick={testAi}>
            Проверить ИИ
          </Btn>
          {s.hasAiKey && (
            <Btn small variant="ghost" onClick={() => clear("aiApiKey")}>
              Удалить ключ
            </Btn>
          )}
        </div>
      </Card>

      <div className="sticky bottom-4 z-10 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/95 p-3 shadow-xl backdrop-blur">
        <Btn variant="primary" onClick={save} disabled={saving}>
          {saving ? "Сохранение…" : "Сохранить настройки"}
        </Btn>
        {note && (
          <span className={`min-w-0 flex-1 break-words text-sm ${note.ok ? "text-emerald-300" : "text-rose-300"}`}>
            {note.text}
          </span>
        )}
      </div>
    </div>
  );
}
