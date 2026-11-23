import { db } from "@/db";
import { aiUsage, deals, deliveries, products, settings, stockItems } from "@/db/schema";
import { apiAuth } from "@/lib/auth";
import { publicSettings } from "@/lib/bot/settings";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Скачивает полный бэкап (без секретов) в JSON. */
export async function GET(req: Request) {
  const auth = await apiAuth(req);
  if (auth) return auth;

  const [prodRows, stockRows, deliveryRows, dealRows, usageRows, settingsRows] =
    await Promise.all([
      db.select().from(products).orderBy(desc(products.id)),
      db.select().from(stockItems).limit(100_000),
      db.select().from(deliveries).orderBy(desc(deliveries.id)).limit(50_000),
      db.select().from(deals).orderBy(desc(deals.createdAt)).limit(50_000),
      db.select().from(aiUsage),
      db.select().from(settings).where(eq(settings.id, 1)),
    ]);

  const payload = {
    app: "BotPlayerok",
    version: 2,
    exportedAt: new Date().toISOString(),
    settings: settingsRows[0] ? publicSettings(settingsRows[0]) : null,
    products: prodRows,
    stock: stockRows,
    deliveries: deliveryRows,
    deals: dealRows,
    aiUsage: usageRows,
  };

  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="botplayerok-backup-${date}.json"`,
    },
  });
}

/** Восстанавливает товары и склад из бэкапа (секреты не восстанавливаются). */
export async function POST(req: Request) {
  const auth = await apiAuth(req);
  if (auth) return auth;

  const body = (await req.json().catch(() => null)) as {
    products?: unknown;
    stock?: unknown;
  } | null;
  if (!body || !Array.isArray(body.products) || !Array.isArray(body.stock)) {
    return Response.json({ error: "Некорректный файл бэкапа" }, { status: 400 });
  }

  const prodRows = body.products.filter(
    (p): p is { title: string; mode?: string; playerokItemId?: string; keyword?: string; message?: string; description?: string; enabled?: boolean } =>
      !!p && typeof p === "object" && typeof (p as { title?: unknown }).title === "string",
  );
  const stockRows = body.stock.filter(
    (s): s is { productId: number; content: string; status?: string; dealId?: string | null } =>
      !!s &&
      typeof s === "object" &&
      typeof (s as { content?: unknown }).content === "string" &&
      typeof (s as { productId?: unknown }).productId === "number",
  );

  let restoredProducts = 0;
  let restoredStock = 0;

  await db.transaction(async (tx) => {
    await tx.delete(stockItems);
    await tx.delete(products);
    const idMap = new Map<number, number>();
    for (const p of prodRows) {
      const [row] = await tx
        .insert(products)
        .values({
          title: p.title,
          mode: p.mode === "message" ? "message" : "unit",
          playerokItemId: p.playerokItemId ?? "",
          keyword: p.keyword ?? "",
          message: p.message ?? "",
          description: p.description ?? "",
          enabled: p.enabled ?? true,
        })
        .returning({ id: products.id });
      const oldId = (p as { id?: unknown }).id;
      if (typeof oldId === "number") idMap.set(oldId, row.id);
      restoredProducts++;
    }
    for (const s of stockRows) {
      const newId = idMap.get(s.productId) ?? s.productId;
      await tx.insert(stockItems).values({
        productId: newId,
        content: s.content,
        status: s.status === "sold" ? "sold" : "available",
        dealId: s.dealId ?? null,
      });
      restoredStock++;
    }
  });

  return Response.json({ ok: true, restoredProducts, restoredStock });
}
