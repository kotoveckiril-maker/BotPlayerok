import { apiAuth } from "@/lib/auth";
import { db } from "@/db";
import { deals } from "@/db/schema";
import { and, desc, eq, like, lt, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PAID: "Оплачена",
  PENDING: "Ожидает выдачи",
  SENT: "Подтверждена",
  CONFIRMED: "Завершена",
  CONFIRMED_AUTOMATICALLY: "Завершена автоматически",
  ROLLED_BACK: "Возврат",
};

export async function GET(req: Request) {
  const auth = await apiAuth(req);
  if (auth) return auth;

  const url = new URL(req.url);
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit")) || 300));
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q")?.trim();

  const conds = [];
  if (status) conds.push(eq(deals.status, status));
  if (q) {
    conds.push(
      or(
        like(deals.itemName, `%${q}%`),
        like(deals.buyerUsername, `%${q}%`),
        like(deals.id, `%${q}%`),
      )!,
    );
  }

  const rows = await db
    .select()
    .from(deals)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(deals.createdAt))
    .limit(limit);

  return Response.json({
    rows,
    labels: STATUS_LABEL,
    totals: {
      revenue: rows
        .filter((r) => ["PAID", "SENT", "CONFIRMED", "CONFIRMED_AUTOMATICALLY"].includes(r.status))
        .reduce((a, r) => a + r.price, 0),
      count: rows.length,
    },
  });
}

export async function DELETE(req: Request) {
  const auth = await apiAuth(req);
  if (auth) return auth;
  const before = new URL(req.url).searchParams.get("before");
  if (before) {
    await db.delete(deals).where(lt(deals.createdAt, new Date(before)));
    return Response.json({ ok: true });
  }
  await db.delete(deals);
  return Response.json({ ok: true });
}
