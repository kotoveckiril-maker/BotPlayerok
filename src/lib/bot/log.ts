import { db } from "@/db";
import { logs } from "@/db/schema";
import { lt, sql } from "drizzle-orm";

export type LogLevel = "info" | "success" | "warn" | "error";

const recent = new Map<string, number>();

export async function log(
  level: LogLevel,
  module: string,
  message: string,
  opts: { dedupeMs?: number } = {},
) {
  if (opts.dedupeMs) {
    const key = `${level}|${module}|${message}`;
    const last = recent.get(key) ?? 0;
    if (Date.now() - last < opts.dedupeMs) return;
    recent.set(key, Date.now());
    if (recent.size > 500) recent.clear();
  }
  try {
    await db.insert(logs).values({ level, module, message: message.slice(0, 2000) });
  } catch (e) {
    console.error("[log] failed", e);
  }
}

export async function pruneLogs() {
  try {
    await db.delete(logs).where(lt(logs.createdAt, sql`now() - interval '7 days'`));
  } catch {
    /* ignore */
  }
}
