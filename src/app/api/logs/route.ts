import { apiAuth } from "@/lib/auth";
import { db } from "@/db";
import { logs } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await apiAuth(req);
  if (auth) return auth;

  const url = new URL(req.url);
  const limit = Math.min(1000, Number(url.searchParams.get("limit")) || 100);
  const level = url.searchParams.get("level");
  const moduleName = url.searchParams.get("module");

  const conds = [];
  if (level) conds.push(eq(logs.level, level));
  if (moduleName) conds.push(eq(logs.module, moduleName));

  const rows = await db
    .select()
    .from(logs)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(logs.id))
    .limit(limit);
  return Response.json(rows);
}

export async function DELETE(req: Request) {
  const auth = await apiAuth(req);
  if (auth) return auth;

  await db.delete(logs);
  return Response.json({ ok: true });
}
