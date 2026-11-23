import { log } from "./log";
import type { Settings } from "./settings";

const recent = new Map<string, number>();

function dedupe(key: string, ms: number): boolean {
  const last = recent.get(key) ?? 0;
  if (Date.now() - last < ms) return true;
  recent.set(key, Date.now());
  if (recent.size > 300) recent.clear();
  return false;
}

/**
 * Отправляет сообщение в Telegram (если настроены tgBotToken и tgChatId).
 * Никогда не бросает исключений — уведомления не должны ломать бот.
 */
export async function notify(
  s: Settings,
  text: string,
  opts: { key?: string; dedupeMs?: number } = {},
): Promise<boolean> {
  if (!s.tgBotToken?.trim() || !s.tgChatId?.trim()) return false;
  if (opts.key && opts.dedupeMs && dedupe(`tg:${opts.key}`, opts.dedupeMs)) {
    return false;
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${s.tgBotToken.trim()}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: s.tgChatId.trim(),
          text: text.slice(0, 4000),
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      await log("warn", "notify", `Telegram ответил ${res.status}: ${body.slice(0, 200)}`, {
        dedupeMs: 600_000,
      });
      return false;
    }
    return true;
  } catch (e) {
    await log("warn", "notify", `Не удалось отправить уведомление: ${e instanceof Error ? e.message : String(e)}`, {
      dedupeMs: 600_000,
    });
    return false;
  }
}

export async function notifySale(
  s: Settings,
  deal: { id: string; item?: { name?: string } | null; user?: { username?: string } | null },
  productTitle: string,
  price = 0,
) {
  if (!s.notifySales) return;
  await notify(
    s,
    [
      "💰 Продажа на Playerok",
      `Товар: ${deal.item?.name ?? productTitle}`,
      `Покупатель: ${deal.user?.username ?? "—"}`,
      price ? `Сумма: ${price} ₽` : "",
      `Сделка: https://playerok.com/deal/${deal.id}`,
      "Товар выдан автоматически.",
    ]
      .filter(Boolean)
      .join("\n"),
    { key: `sale:${deal.id}`, dedupeMs: 3_600_000 },
  );
}

export async function notifyNoStock(
  s: Settings,
  productTitle: string,
  dealId: string,
) {
  if (!s.notifyLowStock) return;
  await notify(
    s,
    [
      "⚠️ Нет товара на складе",
      `Товар: ${productTitle}`,
      `Сделка: https://playerok.com/deal/${dealId}`,
      "Покупатель ждёт. Пополните склад — выдача повторится автоматически.",
    ].join("\n"),
    { key: `nostock:${productTitle}`, dedupeMs: 1_800_000 },
  );
}

export async function notifyError(s: Settings | null, title: string, message: string) {
  if (!s || !s.notifyErrors) return;
  await notify(s, `❌ ${title}\n${message}`.slice(0, 4000), {
    key: `err:${title}:${message.slice(0, 80)}`,
    dedupeMs: 1_800_000,
  });
}
