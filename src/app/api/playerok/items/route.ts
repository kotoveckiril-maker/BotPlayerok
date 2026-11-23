import { apiAuth } from "@/lib/auth";
import { createClient } from "@/lib/bot/engine";
import { raiseOne, restoreOne } from "@/lib/bot/items";
import { getSettings } from "@/lib/bot/settings";
import type { ItemStatus } from "@/lib/playerok/client";

export const dynamic = "force-dynamic";

const ALL: ItemStatus[] = [
  "APPROVED",
  "SOLD",
  "EXPIRED",
  "PENDING_APPROVAL",
  "PENDING_MODERATION",
  "DECLINED",
  "DRAFT",
];

export async function GET(req: Request) {
  const auth = await apiAuth(req);
  if (auth) return auth;
  try {
    const s = await getSettings();
    const client = createClient(s);
    await client.init();
    const items = await client.getMyItems(ALL, 4);
    return Response.json({ ok: true, items });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

export async function POST(req: Request) {
  const auth = await apiAuth(req);
  if (auth) return auth;

  const { action, itemId } = (await req.json().catch(() => ({}))) as {
    action?: "raise" | "restore";
    itemId?: string;
  };
  try {
    const s = await getSettings();
    const client = createClient(s);
    await client.init();
    const items = await client.getMyItems(ALL, 4);
    const item = items.find((i) => i.id === itemId);
    if (!item) throw new Error("Товар не найден на Playerok");
    if (action === "raise") {
      const r = await raiseOne(client, item, s.raiseMaxPrice);
      return Response.json({
        ok: r === "raised",
        error: r === "skipped" ? `Нет статуса приоритета в рамках лимита ${s.raiseMaxPrice} ₽ (см. настройки)` : undefined,
      });
    }
    if (action === "restore") {
      const r = await restoreOne(client, item);
      return Response.json({
        ok: r === "restored",
        error: r === "skipped" ? "Бесплатный статус приоритета недоступен" : undefined,
      });
    }
    throw new Error("Неизвестное действие");
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}
