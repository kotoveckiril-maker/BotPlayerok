import { db } from "@/db";
import { aiUsage, deals, deliveries, logs, products, stockItems } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { isSold } from "./deals";
import { getSettings } from "./settings";

export interface DailyPoint {
  date: string;
  revenue: number;
  orders: number;
  delivered: number;
}

export interface TopRow {
  name: string;
  orders: number;
  revenue: number;
}

export interface StatsResult {
  rangeDays: number;
  currency: string;
  kpi: {
    revenue: number;
    revenuePrev: number;
    orders: number;
    ordersPrev: number;
    avgCheck: number;
    pending: number;
    rolledBack: number;
    delivered: number;
    deliveredPrev: number;
    failed: number;
    noStock: number;
    deliverySuccess: number;
    avgDeliverySec: number | null;
    stockUnits: number;
    outOfStock: number;
    lowStock: number;
    aiReplies: number;
    aiHandoffs: number;
    aiTokens: number;
    errors: number;
    warnings: number;
  };
  daily: DailyPoint[];
  topProducts: TopRow[];
  topBuyers: TopRow[];
  deliveryStatus: { status: string; count: number }[];
  moduleActivity: { module: string; total: number; errors: number }[];
  aiDaily: { date: string; replies: number; handoffs: number }[];
}

const DAY_MS = 24 * 3600 * 1000;

function dayKeyFormatter(timeZone: string): (d: Date) => string {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return (d: Date) => fmt.format(d);
  } catch {
    return (d: Date) => d.toISOString().slice(0, 10);
  }
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function shiftDayKey(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta, 12));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function emptyMap(keys: string[]) {
  const m = new Map<string, { revenue: number; orders: number; delivered: number }>();
  for (const k of keys) m.set(k, { revenue: 0, orders: 0, delivered: 0 });
  return m;
}

export async function getStats(rangeDaysInput = 7): Promise<StatsResult> {
  const rangeDays = Math.min(365, Math.max(1, Math.round(rangeDaysInput)));
  const s = await getSettings();
  const tz = s.timezone || "UTC";
  const toKey = dayKeyFormatter(tz);
  const today = toKey(new Date());
  const keys: string[] = [];
  for (let i = rangeDays - 1; i >= 0; i--) keys.push(shiftDayKey(today, -i));
  const firstKey = keys[0];

  const since = new Date(Date.now() - rangeDays * DAY_MS);
  const sincePrev = new Date(Date.now() - rangeDays * 2 * DAY_MS);

  /* ------------------------------ Сделки ------------------------------ */
  const dealRows = await db
    .select({
      id: deals.id,
      status: deals.status,
      createdAt: deals.createdAt,
      price: deals.price,
      itemName: deals.itemName,
      buyerUsername: deals.buyerUsername,
    })
    .from(deals)
    .where(and(eq(deals.direction, "OUT"), gte(deals.createdAt, sincePrev)))
    .limit(50_000);

  let revenue = 0;
  let revenuePrev = 0;
  let orders = 0;
  let ordersPrev = 0;
  let pending = 0;
  let rolledBack = 0;
  const daily = emptyMap(keys);
  const productAgg = new Map<string, { orders: number; revenue: number }>();
  const buyerAgg = new Map<string, { orders: number; revenue: number }>();

  for (const d of dealRows) {
    const createdAt = new Date(d.createdAt);
    const inRange = createdAt >= since;
    const sold = isSold(d.status);
    if (inRange && d.status === "PENDING") pending++;
    if (inRange && d.status === "ROLLED_BACK") rolledBack++;
    if (!sold) continue;

    const price = Number(d.price) || 0;
    const key = toKey(createdAt);
    const bucket = daily.get(key);
    if (bucket) {
      bucket.orders++;
      bucket.revenue += price;
    }
    if (inRange) {
      orders++;
      revenue += price;
      if (d.itemName) {
        const a = productAgg.get(d.itemName) ?? { orders: 0, revenue: 0 };
        a.orders++;
        a.revenue += price;
        productAgg.set(d.itemName, a);
      }
      if (d.buyerUsername) {
        const a = buyerAgg.get(d.buyerUsername) ?? { orders: 0, revenue: 0 };
        a.orders++;
        a.revenue += price;
        buyerAgg.set(d.buyerUsername, a);
      }
    } else {
      ordersPrev++;
      revenuePrev += price;
    }
  }

  /* ------------------------------ Выдачи ------------------------------ */
  const sinceTs = since.toISOString();
  const deliveryRows = await db
    .select({
      status: deliveries.status,
      count: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${deliveries.price}), 0)::float`,
      avgSec: sql<number | null>`avg(extract(epoch from (${deliveries.updatedAt} - ${deliveries.createdAt})))::float`,
    })
    .from(deliveries)
    .groupBy(deliveries.status);

  let delivered = 0;
  let failed = 0;
  let noStock = 0;
  let processing = 0;
  let deliveryRevenue = 0;
  let avgDeliverySec: number | null = null;
  for (const r of deliveryRows) {
    if (r.status === "delivered") {
      delivered = r.count;
      deliveryRevenue = Number(r.revenue) || 0;
      avgDeliverySec = r.avgSec == null ? null : Number(r.avgSec);
    } else if (r.status === "failed") failed = r.count;
    else if (r.status === "no_stock") noStock = r.count;
    else if (r.status === "processing") processing = r.count;
  }

  const deliveredPrev = (
    await db
      .select({ n: sql<number>`count(*)::int` })
      .from(deliveries)
      .where(
        and(
          eq(deliveries.status, "delivered"),
          gte(deliveries.createdAt, sincePrev),
          sql`${deliveries.createdAt} < ${since}`,
        ),
      )
  )[0]?.n ?? 0;

  const completed = delivered + failed + noStock;
  const deliverySuccess = completed ? (delivered / completed) * 100 : 100;

  // Выдачи по дням (для графика)
  const deliveredRows = await db
    .select({ createdAt: deliveries.createdAt })
    .from(deliveries)
    .where(and(eq(deliveries.status, "delivered"), gte(deliveries.createdAt, since)));
  for (const r of deliveredRows) {
    const bucket = daily.get(toKey(new Date(r.createdAt)));
    if (bucket) bucket.delivered++;
  }

  // Выручка: если сделки ещё не синхронизированы, берём из выдач.
  if (!revenue && deliveryRevenue) revenue = Math.round(deliveryRevenue);

  /* ------------------------------ Склад ------------------------------ */
  const [prodRows, stockByProduct, stockCounts] = await Promise.all([
    db
      .select({
        id: products.id,
        mode: products.mode,
        enabled: products.enabled,
        title: products.title,
      })
      .from(products),
    db
      .select({
        productId: stockItems.productId,
        available: sql<number>`count(*) filter (where ${stockItems.status} = 'available')::int`,
      })
      .from(stockItems)
      .groupBy(stockItems.productId),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(stockItems)
      .where(eq(stockItems.status, "available")),
  ]);

  const availableMap = new Map(stockByProduct.map((r) => [r.productId, r.available]));
  let outOfStock = 0;
  let lowStock = 0;
  for (const p of prodRows) {
    if (p.mode !== "unit" || !p.enabled) continue;
    const available = availableMap.get(p.id) ?? 0;
    if (available <= 0) outOfStock++;
    else if (available <= s.lowStockThreshold) lowStock++;
  }

  /* ------------------------------- ИИ ------------------------------- */
  const aiRows = await db
    .select({
      day: aiUsage.day,
      requests: aiUsage.requests,
      replies: aiUsage.replies,
      handoffs: aiUsage.handoffs,
      tokensIn: aiUsage.tokensIn,
      tokensOut: aiUsage.tokensOut,
    })
    .from(aiUsage)
    .where(gte(aiUsage.day, firstKey));

  const aiDaily = new Map<string, { replies: number; handoffs: number }>();
  for (const k of keys) aiDaily.set(k, { replies: 0, handoffs: 0 });
  let aiReplies = 0;
  let aiHandoffs = 0;
  let aiTokens = 0;
  for (const r of aiRows) {
    aiReplies += r.replies;
    aiHandoffs += r.handoffs;
    aiTokens += r.tokensIn + r.tokensOut;
    const b = aiDaily.get(String(r.day));
    if (b) {
      b.replies += r.replies;
      b.handoffs += r.handoffs;
    }
  }

  /* ------------------------------- Логи ------------------------------- */
  const moduleActivity = await db
    .select({
      module: logs.module,
      total: sql<number>`count(*)::int`,
      errors: sql<number>`count(*) filter (where ${logs.level} = 'error')::int`,
    })
    .from(logs)
    .where(gte(logs.createdAt, since))
    .groupBy(logs.module)
    .orderBy(sql`count(*) desc`)
    .limit(20);

  const errorCounts = await db
    .select({
      level: logs.level,
      n: sql<number>`count(*)::int`,
    })
    .from(logs)
    .where(and(gte(logs.createdAt, since), sql`${logs.level} in ('error','warn')`))
    .groupBy(logs.level);

  const errors = errorCounts.find((r) => r.level === "error")?.n ?? 0;
  const warnings = errorCounts.find((r) => r.level === "warn")?.n ?? 0;

  const top = (agg: Map<string, { orders: number; revenue: number }>): TopRow[] =>
    [...agg.entries()]
      .map(([name, v]) => ({ name, orders: v.orders, revenue: Math.round(v.revenue) }))
      .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders)
      .slice(0, 8);

  return {
    rangeDays,
    currency: "RUB",
    kpi: {
      revenue: Math.round(revenue),
      revenuePrev: Math.round(revenuePrev),
      orders,
      ordersPrev,
      avgCheck: orders ? Math.round(revenue / orders) : 0,
      pending,
      rolledBack,
      delivered,
      deliveredPrev,
      failed,
      noStock,
      deliverySuccess: Math.round(deliverySuccess * 10) / 10,
      avgDeliverySec:
        avgDeliverySec == null ? null : Math.round(avgDeliverySec * 10) / 10,
      stockUnits: stockCounts[0]?.n ?? 0,
      outOfStock,
      lowStock,
      aiReplies,
      aiHandoffs,
      aiTokens,
      errors,
      warnings,
    },
    daily: keys.map((date) => ({ date, ...daily.get(date)! })),
    topProducts: top(productAgg),
    topBuyers: top(buyerAgg),
    deliveryStatus: deliveryRows
      .filter((r) => r.count > 0)
      .map((r) => ({ status: r.status, count: r.count })),
    moduleActivity: moduleActivity.map((r) => ({
      module: r.module,
      total: r.total,
      errors: r.errors,
    })),
    aiDaily: keys.map((date) => ({ date, ...aiDaily.get(date)! })),
  };
}
