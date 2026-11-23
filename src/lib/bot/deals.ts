import { db } from "@/db";
import { deals } from "@/db/schema";
import type { Deal, DealStatus, PlayerokClient } from "@/lib/playerok/client";
import { eq } from "drizzle-orm";
import { log } from "./log";

/** Статусы, при которых сделка считается оплаченной/проданной. */
export const SOLD_STATUSES: DealStatus[] = [
  "PAID",
  "SENT",
  "CONFIRMED",
  "CONFIRMED_AUTOMATICALLY",
];

/** Все статусы, которые имеет смысл зеркалировать в БД. */
export const TRACKED_STATUSES: DealStatus[] = [
  ...SOLD_STATUSES,
  "PENDING",
  "ROLLED_BACK",
];

export function isSold(status: string): boolean {
  return (SOLD_STATUSES as string[]).includes(status);
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Зеркалирует сделки с Playerok в локальную БД — на их основе строится
 * вся статистика продаж (выручка, средний чек, топ товаров и покупателей).
 */
export async function syncDeals(
  client: PlayerokClient,
  opts: { maxPages?: number } = {},
): Promise<{ synced: number; total: number }> {
  const list = await client.getAllDeals(
    TRACKED_STATUSES,
    "OUT",
    Math.min(10, Math.max(1, opts.maxPages ?? 4)),
  );

  let synced = 0;
  for (const d of list) {
    if (!d?.id) continue;
    const price = num(d.item?.price);
    const currency = d.transaction?.currency || "RUB";
    try {
      await db
        .insert(deals)
        .values({
          id: d.id,
          status: d.status,
          direction: d.direction ?? "OUT",
          buyerId: d.user?.id ?? "",
          buyerUsername: d.user?.username ?? "",
          itemId: d.item?.id ?? "",
          itemName: d.item?.name ?? "",
          price,
          currency,
          chatId: d.chat?.id ?? "",
          createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
          completedAt: d.completedAt ? new Date(d.completedAt) : null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: deals.id,
          set: {
            status: d.status,
            direction: d.direction ?? "OUT",
            buyerId: d.user?.id ?? "",
            buyerUsername: d.user?.username ?? "",
            itemId: d.item?.id ?? "",
            itemName: d.item?.name ?? "",
            price,
            currency,
            chatId: d.chat?.id ?? "",
            completedAt: d.completedAt ? new Date(d.completedAt) : null,
            updatedAt: new Date(),
          },
        });
      synced++;
    } catch (e) {
      await log(
        "error",
        "deals",
        `Не удалось сохранить сделку ${d.id}: ${e instanceof Error ? e.message : String(e)}`,
        { dedupeMs: 300_000 },
      );
    }
  }

  return { synced, total: list.length };
}

/** Помечает сделку подтверждённой продавцом после авто-подтверждения. */
export async function markDealConfirmed(dealId: string): Promise<void> {
  await db
    .update(deals)
    .set({ status: "SENT", completedAt: new Date(), updatedAt: new Date() })
    .where(eq(deals.id, dealId));
}

export type { Deal };
