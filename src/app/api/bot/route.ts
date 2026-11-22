import { db } from "@/db";
import { deliveries, logs, products, stockItems } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { testAi } from "@/lib/bot/ai";
import { createClient, engineStatus, startEngine, stopEngine, tick } from "@/lib/bot/engine";
import { getSettings } from "@/lib/bot/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSettings();
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [[prod], [stock], [delTotal], [del24], [noStock], [errors24]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(products),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(stockItems)
      .where(eq(stockItems.status, "available")),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(deliveries)
      .where(eq(deliveries.status, "delivered")),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(deliveries)
      .where(and(eq(deliveries.status, "delivered"), gte(deliveries.createdAt, since))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(deliveries)
      .where(eq(deliveries.status, "no_stock")),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(logs)
      .where(and(eq(logs.level, "error"), gte(logs.createdAt, since))),
  ]);
  return Response.json({
    engine: engineStatus(),
    enabled: s.botEnabled,
    account: s.accountUsername,
    stats: {
      products: prod.n,
      stock: stock.n,
      delivered: delTotal.n,
      delivered24: del24.n,
      noStock: noStock.n,
      errors24: errors24.n,
    },
  });
}

export async function POST(req: Request) {
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  try {
    switch (action) {
      case "start":
        await startEngine();
        return Response.json({ ok: true });
      case "stop":
        await stopEngine();
        return Response.json({ ok: true });
      case "tick": {
        const r = await tick({ force: true });
        return Response.json({ ok: !("error" in r && r.error), ...r });
      }
      case "test": {
        const s = await getSettings();
        const client = createClient(s);
        const info = await client.init();
        return Response.json({ ok: true, info });
      }
      case "test-ai": {
        const s = await getSettings();
        const answer = await testAi(s);
        return Response.json({ ok: true, answer });
      }
      default:
        return Response.json({ ok: false, error: "Неизвестное действие" }, { status: 400 });
    }
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 200 },
    );
  }
}
