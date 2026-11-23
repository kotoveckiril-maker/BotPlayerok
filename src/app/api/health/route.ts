import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Публичный health-check: без секретов, подходит для Docker/Caddy. */
export async function GET() {
  const t0 = Date.now();
  try {
    await db.execute(sql`select 1`);
    return Response.json({
      ok: true,
      db: "ok",
      dbMs: Date.now() - t0,
      uptimeSec: Math.floor(process.uptime()),
      version: process.env.APP_VERSION || "2.0.0",
      ts: new Date().toISOString(),
    });
  } catch {
    return Response.json(
      { ok: false, db: "error", ts: new Date().toISOString() },
      { status: 500 },
    );
  }
}
