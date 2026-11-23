import { db } from "@/db";
import { products } from "@/db/schema";
import { apiAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { cleanProduct } from "@/lib/bot/product-utils";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await apiAuth(req);
  if (auth) return auth;

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data = cleanProduct(body);
  if (!Object.keys(data).length) return Response.json({ error: "Нет данных" }, { status: 400 });
  const [row] = await db
    .update(products)
    .set(data)
    .where(eq(products.id, Number(id)))
    .returning();
  return Response.json(row ?? null);
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await apiAuth(req);
  if (auth) return auth;

  const { id } = await ctx.params;
  await db.delete(products).where(eq(products.id, Number(id)));
  return Response.json({ ok: true });
}
