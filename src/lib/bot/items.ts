import { db } from "@/db";
import { products, stockItems } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type {
  ItemStatus,
  MyItem,
  PlayerokClient,
  PriorityStatus,
} from "@/lib/playerok/client";
import { log } from "./log";
import type { Settings } from "./settings";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Самый дешёвый статус приоритета (обычно бесплатный DEFAULT). */
function pickCheapest(list: PriorityStatus[], maxPrice: number) {
  return [...list]
    .filter((p) => p.price <= maxPrice)
    .sort((a, b) => a.price - b.price)[0];
}

/** Лучший статус для поднятия: самый дорогой из тех, что укладываются в лимит. */
function pickForRaise(list: PriorityStatus[], maxPrice: number) {
  const affordable = list.filter((p) => p.price <= maxPrice);
  const premium = affordable
    .filter((p) => p.type === "PREMIUM")
    .sort((a, b) => b.price - a.price)[0];
  return premium ?? affordable.sort((a, b) => b.price - a.price)[0];
}

export async function raiseOne(
  client: PlayerokClient,
  item: MyItem,
  maxPrice: number,
): Promise<"raised" | "skipped"> {
  const statuses = await client.getPriorityStatuses(item.id, item.price);
  const st = pickForRaise(statuses, maxPrice);
  if (!st) {
    await log(
      "warn",
      "raise",
      `«${item.name}»: нет подходящего статуса приоритета в рамках лимита ${maxPrice} ₽`,
      { dedupeMs: 3_600_000 },
    );
    return "skipped";
  }
  await client.increasePriority(item.id, st.id);
  await log(
    "success",
    "raise",
    `«${item.name}» поднят (${st.name}${st.price ? `, ${st.price} ₽` : ", бесплатно"})`,
  );
  return "raised";
}

export async function restoreOne(
  client: PlayerokClient,
  item: MyItem,
): Promise<"restored" | "skipped"> {
  const statuses = await client.getPriorityStatuses(item.id, item.price);
  // Восстанавливаем только бесплатным (самым дешёвым) приоритетом
  const st = pickCheapest(statuses, 0);
  if (!st) {
    await log(
      "warn",
      "restore",
      `«${item.name}»: бесплатный статус приоритета недоступен, восстановление пропущено`,
      { dedupeMs: 3_600_000 },
    );
    return "skipped";
  }
  await client.publishItem(item.id, st.id);
  await log("success", "restore", `«${item.name}» восстановлен и выставлен на продажу`);
  return "restored";
}

export async function runRaise(client: PlayerokClient, s: Settings) {
  const items = await client.getMyItems(["APPROVED"], 5);
  let n = 0;
  for (const it of items) {
    try {
      if ((await raiseOne(client, it, s.raiseMaxPrice)) === "raised") n++;
    } catch (e) {
      await log(
        "error",
        "raise",
        `«${it.name}»: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    await sleep(700);
  }
  if (!items.length) await log("info", "raise", "Нет активных товаров для поднятия", { dedupeMs: 3_600_000 });
  return n;
}

export async function runRestore(client: PlayerokClient, s: Settings) {
  const statuses: ItemStatus[] = [];
  if (s.restoreSold) statuses.push("SOLD");
  if (s.restoreExpired) statuses.push("EXPIRED");
  if (!statuses.length) return 0;

  const items = await client.getMyItems(statuses, 3);
  if (!items.length) return 0;

  const prods = await db.select().from(products).where(eq(products.enabled, true));
  const linked = new Map(prods.filter((p) => p.playerokItemId).map((p) => [p.playerokItemId, p]));

  let n = 0;
  for (const it of items) {
    const p = linked.get(it.id);
    if (!p && !s.restoreUnlinked) continue;

    // Для поштучных товаров не восстанавливаем, если склад пуст
    if (p && p.mode === "unit") {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(stockItems)
        .where(and(eq(stockItems.productId, p.id), eq(stockItems.status, "available")));
      if (count === 0) {
        await log(
          "warn",
          "restore",
          `«${it.name}»: склад пуст — восстановление отложено`,
          { dedupeMs: 3_600_000 },
        );
        continue;
      }
    }

    try {
      if ((await restoreOne(client, it)) === "restored") n++;
    } catch (e) {
      await log(
        "error",
        "restore",
        `«${it.name}»: ${e instanceof Error ? e.message : String(e)}`,
        { dedupeMs: 600_000 },
      );
    }
    await sleep(1000);
  }
  return n;
}
