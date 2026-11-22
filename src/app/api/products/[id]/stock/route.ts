import { db } from "@/db";
import { stockItems } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const rows = await db
    .select()
    .from(stockItems)
    .where(eq(stockItems.productId, Number(id)))
    .orderBy(desc(stockItems.id))
    .limit(500);
  return Response.json(rows);
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { lines, separator } = (await req.json().catch(() => ({}))) as {
    lines?: string;
    separator?: string;
  };
  const parts = (lines ?? "")
    .split(separator === "blank" ? /\n\s*\n/ : /\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!parts.length) return Response.json({ error: "Пусто" }, { status: 400 });
  await db
    .insert(stockItems)
    .values(parts.map((content) => ({ productId: Number(id), content })));
  return Response.json({ added: parts.length });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const stockId = url.searchParams.get("stockId");
  const scope = url.searchParams.get("scope"); // sold | available
  if (stockId) {
    await db
      .delete(stockItems)
      .where(and(eq(stockItems.id, Number(stockId)), eq(stockItems.productId, Number(id))));
  } else if (scope === "sold" || scope === "available") {
    await db
      .delete(stockItems)
      .where(and(eq(stockItems.productId, Number(id)), eq(stockItems.status, scope)));
  }
  return Response.json({ ok: true });
}
