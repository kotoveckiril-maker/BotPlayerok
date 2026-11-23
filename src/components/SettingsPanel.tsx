"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Btn, Card, Field, TextArea, TextInput, Toggle, api, fmtDate } from "./ui";

interface S {
  hasToken: boolean;
  tokenPreview: string;
  hasCookies: boolean;
  hasAiKey: boolean;
  hasTgToken: boolean;
  hasPassword: boolean;
  userAgent: string;
  accountUsername: string;
  pollIntervalSec: number;
  timezone: string;
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
  syncDeals: boolean;
  aiEnabled: boolean;
  aiBaseUrl: string;
  aiModel: string;
  aiTemperature: number;
  aiCooldownSec: number;
  aiHistoryLimit: number;
  aiMaxAgeMin: number;
  aiMaxTokens: number;
  aiSystemPrompt: string;
  notifySales: boolean;
  notifyErrors: boolean;
  notifyLowStock: boolean;
  lowStockThreshold: number;
  tgChatId: string;
  lastRaiseAt: string | null;
  lastRestoreAt: string | null;
  lastDealsSyncAt: string | null;
}

export default function SettingsPanel() {
  const [s, setS] = useState<S | null>(null);
  const [token, setToken] = useState("");
  const [cookies, setCookies] = useState("");
  const [aiKey, setAiKey] = useState("");
  const [tgToken, setTgToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passNote, setPassNote] = useState<{ ok: boolean; text: string } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [restoreNote, setRestoreNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api<S>("/api/settings").then(setS).catch(() => {});
  }, []);

  if (!s) return <Card>Загрузка…</Card>;

  const up = <K extends keyof S>(k: K, v: S[K]) => setS({ ...s, [k]: v });
  const num =
    (k: keyof S) => (e: React.ChangeEvent<HTMLInputElement>) =>
      up(k, Number(e.target.value) as never);

  const save = async () => {
    setSaving(true);
    setNote(null);
    try {
      const body: Record<string, unknown> = { ...s };
      body.playerokToken = token;
      body.playerokCookies = cookies;
      body.aiApiKey = aiKey;
      body.tgBotToken = tgToken;
      const r = await api<S>("/api/settings", { method: "PUT", body });
      setS(r);
      setToken("");
      setCookies("");
      setAiKey("");
      setTgToken("");
      setNote({ ok: true, text: "Настройки сохранены" });
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
    setSaving(false);
  };

  const clear = async (
    k: "playerokToken" | "playerokCookies" | "aiApiKey" | "tgBotToken",
  ) => {
    const r = await api<S>("/api/settings", { method: "PUT", body: { [k]: "__clear__" } });
    setS({ ...s, ...r });
    setNote({ ok: true, text: "Секрет удалён" });
  };

  const testAi = async () => {
    setNote(null);
    await save();
    try {
      const r = await api<{ ok: boolean; answer?: string; error?: string }>("/api/bot", {
        method: "POST",
        body: { action: "test-ai" },
      });
      setNote(
        r.ok
          ? {
              ok: true,
              text: `Тест ИИ. Вопрос: «Товар в наличии? Как быстро получу?» → ${r.answer}`,
            }
          : { ok: false, text: r.error ?? "Ошибка ИИ" },
      );
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  const testTg = async () => {
    await save();
    try {
      const r = await api<{ ok: boolean; error?: string }>("/api/bot", {
        method: "POST",
        body: { action: "test-telegram" },
      });
      setNote(
        r.ok
          ? { ok: true, text: "Telegram: тестовое сообщение отправлено" }
          : { ok: false, text: r.error ?? "Telegram: ошибка" },
      );
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  const changePassword = async () => {
    setPassNote(null);
    try {
      await api("/api/auth/password", {
        method: "POST",
        body: { current: curPass, next: newPass },
      });
      setCurPass("");
      setNewPass("");
      setPassNote({ ok: true, text: "Пароль изменён" });
    } catch (e) {
      setPassNote({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  const restore = async (file: File | null) => {
    if (!file) return;
    if (!confirm("Восстановить товары и склад из файла? Текущие товары и склад будут заменены.")) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text) as { products?: unknown; stock?: unknown };
      const r = await api<{ restoredProducts: number; restoredStock: number }>("/api/backup", {
        method: "POST",
        body: json,
      });
      setRestoreNote({
        ok: true,
        text: `Восстановлено товаров: ${r.restoredProducts}, единиц склада: ${r.restoredStock}`,
      });
    } catch (e) {
      setRestoreNote({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-5">
      <Card
        title="Аккаунт Playerok"
        subtitle="Токен берётся из браузера: playerok.com → F12 → Application → Cookies → token"
        right={s.accountUsername ? <Badge tone="green">{s.accountUsername}</Badge> : undefined}
      >
        <div className="grid gap-3">
          <Field
            label="Токен (cookie token)"
            hint={s.hasToken ? `Сохранён: ${s.tokenPreview}. Оставьте пустым, чтобы не менять.` : "Не задан"}
          >
            <TextInput
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={s.hasToken ? "••••••••" : "вставьте токен"}
            />
          </Field>
          <Field
            label="Полная строка Cookie (рекомендуется)"
            hint="Скопируйте заголовок Cookie из запроса в DevTools → Network. Нужен для обхода антибот-защиты (__ddg5_), запускать нужно с того же IP."
          >
            <TextArea
              rows={3}
              autoComplete="off"
              value={cookies}
              onChange={(e) => setCookies(e.target.value)}
              placeholder={
                s.hasCookies
                  ? "Сохранено (скрыто). Вставьте новое значение, чтобы заменить."
                  : "token=...; __ddg5_=...; ..."
              }
            />
          </Field>
          <Field
            label="User-Agent браузера (необязательно)"
            hint="Должен совпадать с браузером, из которого взяты cookie"
          >
            <TextInput value={s.userAgent} onChange={(e) => up("userAgent", e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
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
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Интервал опроса, сек" hint="Как часто бот проверяет сделки и чаты (5–3600)">
            <TextInput type="number" min={5} value={s.pollIntervalSec} onChange={num("pollIntervalSec")} />
          </Field>
          <Field label="Часовой пояс" hint="Для дневной группировки статистики, например Europe/Moscow">
            <TextInput value={s.timezone} onChange={(e) => up("timezone", e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card title="🚀 Авто-выдача и ☑️ подтверждение">
        <Toggle
          label="Авто-выдача товаров"
          hint="После оплаты отправляет покупателю товар со склада или сообщение"
          checked={s.autoDelivery}
          onChange={(v) => up("autoDelivery", v)}
        />
        <Toggle
          label="Авто-подтверждение сделок"
          hint="После выдачи автоматически отмечает сделку как выполненную"
          checked={s.autoConfirm}
          onChange={(v) => up("autoConfirm", v)}
        />
        <Toggle
          label="Синхронизировать сделки для статистики"
          hint="Бот периодически подтягивает сделки с Playerok, чтобы считать выручку, средний чек и топ товаров"
          checked={s.syncDeals}
          onChange={(v) => up("syncDeals", v)}
        />
        {s.lastDealsSyncAt && (
          <p className="mt-1 text-xs text-slate-500">Последняя синхронизация: {fmtDate(s.lastDealsSyncAt)}</p>
        )}
      </Card>

      <Card title="⬆️ Авто-поднятие товаров">
        <Toggle
          label="Включить авто-поднятие"
          hint="Периодически поднимает все активные лоты"
          checked={s.autoRaise}
          onChange={(v) => up("autoRaise", v)}
        />
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Field label="Интервал, мин">
            <TextInput type="number" min={5} value={s.raiseIntervalMin} onChange={num("raiseIntervalMin")} />
          </Field>
          <Field
            label="Макс. цена одного поднятия, ₽"
            hint="0 — только бесплатные статусы. Платный приоритет списывается с баланса кошелька."
          >
            <TextInput type="number" min={0} value={s.raiseMaxPrice} onChange={num("raiseMaxPrice")} />
          </Field>
        </div>
        {s.lastRaiseAt && <p className="mt-1 text-xs text-slate-500">Последнее поднятие: {fmtDate(s.lastRaiseAt)}</p>}
      </Card>

      <Card title="♻️ Восстановление товаров">
        <Toggle
          label="Авто-восстановление"
          hint="Повторно выставляет проданные и истёкшие лоты"
          checked={s.autoRestore}
          onChange={(v) => up("autoRestore", v)}
        />
        <Toggle label="Восстанавливать проданные" checked={s.restoreSold} onChange={(v) => up("restoreSold", v)} />
        <Toggle label="Восстанавливать истёкшие" checked={s.restoreExpired} onChange={(v) => up("restoreExpired", v)} />
        <Toggle
          label="Восстанавливать и непривязанные лоты"
          hint="По умолчанию — только лоты, привязанные к товарам (у поштучных — если есть остаток). Осторожно: включит всю историю продаж."
          checked={s.restoreUnlinked}
          onChange={(v) => up("restoreUnlinked", v)}
        />
        <div className="mt-2 max-w-xs">
          <Field label="Интервал проверки, мин">
            <TextInput type="number" min={1} value={s.restoreIntervalMin} onChange={num("restoreIntervalMin")} />
          </Field>
        </div>
        {s.lastRestoreAt && <p className="mt-1 text-xs text-slate-500">Последняя проверка: {fmtDate(s.lastRestoreAt)}</p>}
      </Card>

      <Card
        title="🤖 ИИ-автоответчик"
        subtitle="Отвечает покупателям в чатах через OpenAI-совместимый API (OpenAI, OpenRouter, DeepSeek, Groq, Ollama)"
      >
        <Toggle
          label="Включить ИИ-ответы"
          hint="Если ИИ не уверен — пишет [HANDOFF], и бот не отвечает (запись попадёт в логи)"
          checked={s.aiEnabled}
          onChange={(v) => up("aiEnabled", v)}
        />
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Field label="Base URL API">
            <TextInput value={s.aiBaseUrl} onChange={(e) => up("aiBaseUrl", e.target.value)} />
          </Field>
          <Field label="Модель">
            <TextInput value={s.aiModel} onChange={(e) => up("aiModel", e.target.value)} />
          </Field>
          <Field
            label="API-ключ"
            hint={s.hasAiKey ? "Ключ задан. Оставьте пустым, чтобы не менять." : "Не задан (можно также переменная OPENAI_API_KEY)"}
          >
            <TextInput
              type="password"
              autoComplete="off"
              value={aiKey}
              onChange={(e) => setAiKey(e.target.value)}
              placeholder={s.hasAiKey ? "••••••••" : "sk-..."}
            />
          </Field>
          <Field label={`Креативность: ${(s.aiTemperature / 10).toFixed(1)}`}>
            <input
              type="range"
              min={0}
              max={10}
              value={s.aiTemperature}
              onChange={num("aiTemperature")}
              className="w-full accent-indigo-500"
            />
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
          <Field label="Макс. токенов ответа">
            <TextInput type="number" min={50} max={4000} value={s.aiMaxTokens} onChange={num("aiMaxTokens")} />
          </Field>
        </div>
        <div className="mt-3">
          <Field
            label="Системная инструкция"
            hint="Каталог товаров (названия и описания) подставляется автоматически"
          >
            <TextArea rows={6} value={s.aiSystemPrompt} onChange={(e) => up("aiSystemPrompt", e.target.value)} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
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

      <Card title="💬 Telegram-уведомления" subtitle="Оповещения о продажах, ошибках и пустом складе">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Токен бота"
            hint={s.hasTgToken ? "Задан. Оставьте пустым, чтобы не менять." : "Получите у @BotFather командой /newbot"}
          >
            <TextInput
              type="password"
              autoComplete="off"
              value={tgToken}
              onChange={(e) => setTgToken(e.target.value)}
              placeholder={s.hasTgToken ? "••••••••" : "123456:ABC-DEF..."}
            />
          </Field>
          <Field label="Chat ID" hint="Например, -1001234567890 или ваш numeric ID">
            <TextInput value={s.tgChatId} onChange={(e) => up("tgChatId", e.target.value)} placeholder="-100... или 123456789" />
          </Field>
        </div>
        <div className="mt-2">
          <Toggle label="Уведомлять о продажах" checked={s.notifySales} onChange={(v) => up("notifySales", v)} />
          <Toggle label="Уведомлять об ошибках" checked={s.notifyErrors} onChange={(v) => up("notifyErrors", v)} />
          <Toggle
            label="Уведомлять о пустом складе"
            hint="Когда покупатель оплатил, а выдавать нечего"
            checked={s.notifyLowStock}
            onChange={(v) => up("notifyLowStock", v)}
          />
        </div>
        <div className="mt-2 max-w-xs">
          <Field label="Порог «мало на складе», шт">
            <TextInput type="number" min={0} value={s.lowStockThreshold} onChange={num("lowStockThreshold")} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn variant="ghost" onClick={testTg}>
            Отправить тестовое сообщение
          </Btn>
          {s.hasTgToken && (
            <Btn small variant="ghost" onClick={() => clear("tgBotToken")}>
              Удалить токен
            </Btn>
          )}
        </div>
      </Card>

      <Card title="🔐 Безопасность">
        <p className="mb-3 text-sm text-slate-400">
          Пароль админки {s.hasPassword ? "задан" : "не задан"}. Секреты (токены и ключи) хранятся в
          базе в зашифрованном виде (AES-256-GCM).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Текущий пароль">
            <TextInput
              type="password"
              autoComplete="current-password"
              value={curPass}
              onChange={(e) => setCurPass(e.target.value)}
            />
          </Field>
          <Field label="Новый пароль (мин. 8 символов)">
            <TextInput
              type="password"
              autoComplete="new-password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Btn variant="primary" onClick={changePassword} disabled={!curPass || newPass.length < 8}>
            Сменить пароль
          </Btn>
          {passNote && (
            <span className={`text-sm ${passNote.ok ? "text-emerald-300" : "text-rose-300"}`}>
              {passNote.text}
            </span>
          )}
        </div>
      </Card>

      <Card title="🗄 Данные и резервные копии">
        <p className="text-sm text-slate-400">
          Бэкап содержит товары, склад, историю выдач и сделок. Секреты в файл не попадают.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a href="/api/backup" download>
            <Btn variant="ghost">⬇ Скачать бэкап JSON</Btn>
          </a>
          <Btn variant="ghost" onClick={() => fileRef.current?.click()}>
            ⬆ Восстановить товары и склад
          </Btn>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void restore(e.target.files?.[0] ?? null)}
          />
          {restoreNote && (
            <span className={`text-sm ${restoreNote.ok ? "text-emerald-300" : "text-rose-300"}`}>
              {restoreNote.text}
            </span>
          )}
        </div>
      </Card>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/95 p-3 shadow-xl backdrop-blur">
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
