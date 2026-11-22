import { db } from "@/db";
import { deliveries, products, stockItems } from "@/db/schema";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import type { Deal, PlayerokClient } from "@/lib/playerok/client";
import { log } from "./log";
import type { Settings } from "./settings";

type Product = typeof products.$inferSelect;

const MAX_ATTEMPTS = 5;
const warnedUnmatched = new Set<string>();

export function renderTemplate(
  tpl: string,
  vars: { data?: string; buyer?: string; item?: string },
) {
  return tpl
    .replaceAll("{data}", vars.data ?? "")
    .replaceAll("{buyer}", vars.buyer ?? "")
    .replaceAll("{item}", vars.item ?? "");
}

function matchProduct(list: Product[], deal: Deal): Product | undefined {
  const itemId = deal.item?.id;
  const name = (deal.item?.name ?? "").toLowerCase();
  if (itemId) {
    const byId = list.find((p) => p.playerokItemId && p.playerokItemId === itemId);
    if (byId) return byId;
  }
  return list.find(
    (p) => p.keyword.trim() && name.includes(p.keyword.trim().toLowerCase()),
  );
}

/** Атомарно забирает одну единицу со склада. */
async function claimStock(productId: number, dealId: string) {
  const res = await db.execute(sql`
    UPDATE stock_items
    SET status = 'sold', deal_id = ${dealId}, sold_at = now()
    WHERE id = (
      SELECT id FROM stock_items
      WHERE product_id = ${productId} AND status = 'available'
      ORDER BY id
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, content
  `);
  const row = res.rows[0] as { id: number; content: string } | undefined;
  return row;
}

async function releaseStock(id: number) {
  await db
    .update(stockItems)
    .set({ status: "available", dealId: null, soldAt: null })
    .where(eq(stockItems.id, id));
}

export async function runDelivery(client: PlayerokClient, s: Settings) {
  const deals = await client.getDeals(["PAID", "PENDING"], "OUT", 24);
  if (!deals.length) return 0;

  const productList = await db
    .select()
    .from(products)
    .where(eq(products.enabled, true));

  const existing = await db
    .select()
    .from(deliveries)
    .where(
      inArray(
        deliveries.dealId,
        deals.map((d) => d.id),
      ),
    );
  const byDeal = new Map(existing.map((e) => [e.dealId, e]));

  let done = 0;
  for (const deal of deals) {
    const prev = byDeal.get(deal.id);
    if (prev) {
      if (prev.status === "delivered" || prev.status === "processing") continue;
      if (prev.attempts >= MAX_ATTEMPTS) continue;
    }

    const product = matchProduct(productList, deal);
    if (!product) {
      if (!warnedUnmatched.has(deal.id)) {
        warnedUnmatched.add(deal.id);
        await log(
          "warn",
          "delivery",
          `Сделка ${deal.id}: «${deal.item?.name ?? "?"}» не привязана ни к одному товару — выдача пропущена`,
        );
      }
      continue;
    }

    const chatId = deal.chat?.id ?? "";
    if (!chatId) {
      await log("warn", "delivery", `Сделка ${deal.id}: нет chat.id, пропуск`, {
        dedupeMs: 600_000,
      });
      continue;
    }

    // Захватываем сделку (защита от двойной выдачи)
    if (!prev) {
      const ins = await db
        .insert(deliveries)
        .values({
          dealId: deal.id,
          productId: product.id,
          itemName: deal.item?.name ?? "",
          buyer: deal.user?.username ?? "",
          chatId,
          status: "processing",
          attempts: 1,
        })
        .onConflictDoNothing()
        .returning({ id: deliveries.id });
      if (!ins.length) continue;
    } else {
      const upd = await db
        .update(deliveries)
        .set({
          status: "processing",
          attempts: sql`${deliveries.attempts} + 1`,
          updatedAt: new Date(),
          productId: product.id,
          chatId,
        })
        .where(
          and(
            eq(deliveries.dealId, deal.id),
            inArray(deliveries.status, ["no_stock", "failed"]),
          ),
        )
        .returning({ id: deliveries.id });
      if (!upd.length) continue;
    }

    let claimed: { id: number; content: string } | undefined;
    try {
      let data = "";
      if (product.mode === "unit") {
        claimed = await claimStock(product.id, deal.id);
        if (!claimed) {
          await db
            .update(deliveries)
            .set({
              status: "no_stock",
              error: "Склад пуст",
              updatedAt: new Date(),
              attempts: 0,
            })
            .where(eq(deliveries.dealId, deal.id));
          await log(
            "error",
            "delivery",
            `Сделка ${deal.id}: на складе «${product.title}» нет товара! Пополните склад — выдача повторится автоматически`,
            { dedupeMs: 300_000 },
          );
          continue;
        }
        data = claimed.content;
      }

      const tpl = product.message.trim() || (product.mode === "unit" ? "{data}" : "");
      if (!tpl) {
        throw new Error("У товара не задано сообщение для выдачи");
      }
      const text = renderTemplate(tpl, {
        data,
        buyer: deal.user?.username ?? "",
        item: deal.item?.name ?? product.title,
      });

      await client.sendMessage(chatId, text);

      await db
        .update(deliveries)
        .set({
          status: "delivered",
          delivered: product.mode === "unit" ? data : "(сообщение)",
          error: "",
          updatedAt: new Date(),
        })
        .where(eq(deliveries.dealId, deal.id));
      await log(
        "success",
        "delivery",
        `Сделка ${deal.id}: выдан «${product.title}» покупателю ${deal.user?.username ?? "?"}`,
      );
      done++;
    } catch (e) {
      if (claimed) await releaseStock(claimed.id);
      const msg = e instanceof Error ? e.message : String(e);
      await db
        .update(deliveries)
        .set({ status: "failed", error: msg.slice(0, 500), updatedAt: new Date() })
        .where(eq(deliveries.dealId, deal.id));
      await log("error", "delivery", `Сделка ${deal.id}: ошибка выдачи — ${msg}`);
    }
  }
  return done;
}

/** Авто-подтверждение: помечаем сделки как «Выполнено» (SENT) после выдачи. */
export async function runConfirm(client: PlayerokClient, _s: Settings) {
  void _s;
  const pending = await db
    .select()
    .from(deliveries)
    .where(
      and(
        eq(deliveries.status, "delivered"),
        eq(deliveries.confirmed, false),
        lt(deliveries.confirmAttempts, MAX_ATTEMPTS),
      ),
    )
    .limit(20);

  let n = 0;
  for (const d of pending) {
    try {
      await client.updateDeal(d.dealId, "SENT");
      await db
        .update(deliveries)
        .set({ confirmed: true, updatedAt: new Date() })
        .where(eq(deliveries.id, d.id));
      await log("success", "confirm", `Сделка ${d.dealId}: подтверждена как выполненная`);
      n++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const attempts = d.confirmAttempts + 1;
      // Если статус уже сменился (покупатель подтвердил / возврат) — считаем завершённым
      const already = /status|статус|already|не может|cannot/i.test(msg);
      await db
        .update(deliveries)
        .set({
          confirmAttempts: attempts,
          confirmed: already ? true : d.confirmed,
          updatedAt: new Date(),
        })
        .where(eq(deliveries.id, d.id));
      await log(
        "warn",
        "confirm",
        `Сделка ${d.dealId}: не удалось подтвердить (${attempts}/${MAX_ATTEMPTS}) — ${msg}`,
      );
    }
  }
  return n;
}
