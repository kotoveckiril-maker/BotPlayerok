import { db } from "@/db";
import { deliveries, logs, products, stockItems } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { apiAuth, getSession } from "@/lib/auth";
import { testAi } from "@/lib/bot/ai";
import {
  createClient,
  engineStatus,
  moduleStatus,
  startEngine,
  stopEngine,
  syncDealsNow,
  systemInfo,
  tick,
} from "@/lib/bot/engine";
import { notify } from "@/lib/bot/notify";
import { getSettings, publicSettings } from "@/lib/bot/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) {
    return Response.json({ error: "Требуется вход в админку" }, { status: 401 });
  }

  const s = await getSettings();
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [[prod], [stock], [delTotal], [del24], [noStock], [errors24], [pendingDel]] =
    await Promise.all([
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
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(deliveries)
        .where(eq(deliveries.status, "processing")),
    ]);

  return Response.json({
    engine: engineStatus(),
    modules: moduleStatus(),
    system: systemInfo(),
    enabled: s.botEnabled,
    account: s.accountUsername,
    settings: publicSettings(s),
    stats: {
      products: prod.n,
      stock: stock.n,
      delivered: delTotal.n,
      delivered24: del24.n,
      processing: pendingDel.n,
      noStock: noStock.n,
      errors24: errors24.n,
    },
  });
}

export async function POST(req: Request) {
  const auth = await apiAuth(req);
  if (auth) return auth;

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
        return Response.json({ ...r, ok: !r.error });
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
      case "sync-deals": {
        const r = await syncDealsNow();
        return Response.json({ ok: true, ...r });
      }
      case "test-telegram": {
        const s = await getSettings();
        const ok = await notify(s, "✅ Проверка связи: уведомления BotPlayerok работают.");
        return Response.json(
          ok
            ? { ok: true }
            : { ok: false, error: "Не отправлено. Проверьте токен бота и chat_id." },
        );
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
