import { db } from "@/db";
import { deliveries, products } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select({
      id: deliveries.id,
      dealId: deliveries.dealId,
      itemName: deliveries.itemName,
      buyer: deliveries.buyer,
      status: deliveries.status,
      delivered: deliveries.delivered,
      error: deliveries.error,
      attempts: deliveries.attempts,
      confirmed: deliveries.confirmed,
      createdAt: deliveries.createdAt,
      product: products.title,
    })
    .from(deliveries)
    .leftJoin(products, eq(products.id, deliveries.productId))
    .orderBy(desc(deliveries.id))
    .limit(200);
  return Response.json(rows);
}

/** Сбросить сделку для повторной выдачи. */
export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (id) await db.delete(deliveries).where(eq(deliveries.id, id));
  return Response.json({ ok: true });
}
