import { db } from "@/db";
import { deliveries, products } from "@/db/schema";
import { apiAuth } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await apiAuth(req);
  if (auth) return auth;

  const url = new URL(req.url);
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit")) || 200));
  const status = url.searchParams.get("status");

  const rows = await db
    .select({
      id: deliveries.id,
      dealId: deliveries.dealId,
      itemName: deliveries.itemName,
      buyer: deliveries.buyer,
      buyerId: deliveries.buyerId,
      status: deliveries.status,
      delivered: deliveries.delivered,
      error: deliveries.error,
      attempts: deliveries.attempts,
      confirmed: deliveries.confirmed,
      confirmedAt: deliveries.confirmedAt,
      price: deliveries.price,
      currency: deliveries.currency,
      createdAt: deliveries.createdAt,
      updatedAt: deliveries.updatedAt,
      product: products.title,
    })
    .from(deliveries)
    .leftJoin(products, eq(products.id, deliveries.productId))
    .where(status ? eq(deliveries.status, status) : undefined)
    .orderBy(desc(deliveries.id))
    .limit(limit);
  return Response.json(rows);
}

/** Сбросить сделку для повторной выдачи. */
export async function DELETE(req: Request) {
  const auth = await apiAuth(req);
  if (auth) return auth;

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (id) await db.delete(deliveries).where(eq(deliveries.id, id));
  return Response.json({ ok: true });
}
