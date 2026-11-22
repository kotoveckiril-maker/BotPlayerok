import { db } from "@/db";
import { products, stockItems } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { cleanProduct } from "@/lib/bot/product-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(products).orderBy(desc(products.id));
  const counts = await db
    .select({
      productId: stockItems.productId,
      available: sql<number>`count(*) filter (where ${stockItems.status} = 'available')::int`,
      sold: sql<number>`count(*) filter (where ${stockItems.status} = 'sold')::int`,
    })
    .from(stockItems)
    .groupBy(stockItems.productId);
  const map = new Map(counts.map((c) => [c.productId, c]));
  return Response.json(
    rows.map((p) => ({
      ...p,
      available: map.get(p.id)?.available ?? 0,
      sold: map.get(p.id)?.sold ?? 0,
    })),
  );
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data = cleanProduct(body);
  if (!data.title) {
    return Response.json({ error: "Укажите название" }, { status: 400 });
  }
  if (!data.playerokItemId && !data.keyword) {
    return Response.json(
      { error: "Укажите ID товара Playerok или ключевое слово в названии" },
      { status: 400 },
    );
  }
  const [row] = await db
    .insert(products)
    .values(data as typeof products.$inferInsert)
    .returning();
  return Response.json(row);
}
