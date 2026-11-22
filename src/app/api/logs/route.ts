import { db } from "@/db";
import { logs } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limit = Math.min(500, Number(new URL(req.url).searchParams.get("limit")) || 100);
  const rows = await db.select().from(logs).orderBy(desc(logs.id)).limit(limit);
  return Response.json(rows);
}

export async function DELETE() {
  await db.delete(logs);
  return Response.json({ ok: true });
}
