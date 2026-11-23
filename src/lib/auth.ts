import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import {
  hashPassword,
  hmacSign,
  hmacVerify,
  randomPassword,
  randomToken,
  verifyPassword,
} from "./crypto";

export const SESSION_COOKIE = "bp_session";
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000; // 30 дней

export interface Session {
  authenticated: true;
  issuedAt: number;
}

function signSession(issuedAt: number): string {
  const payload = `${issuedAt}.${randomToken(18)}`;
  return `${payload}.${hmacSign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): Session | null {
  if (!token) return null;
  const idx = token.lastIndexOf(".");
  if (idx <= 0) return null;
  const payload = token.slice(0, idx);
  const signature = token.slice(idx + 1);
  if (!payload || !signature || !hmacVerify(payload, signature)) return null;
  const issuedAt = Number(payload.split(".")[0]);
  if (!Number.isFinite(issuedAt) || issuedAt + SESSION_TTL_MS < Date.now()) {
    return null;
  }
  return { authenticated: true, issuedAt };
}

/** Читает сессию из cookies (server components / route handlers). */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export function sessionCookieHeader(secure: boolean): string {
  const issuedAt = Date.now();
  const token = signSession(issuedAt);
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(
    SESSION_TTL_MS / 1000,
  )}${secure ? "; Secure" : ""}`;
}

export function clearCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/**
 * Защита API: проверяет сессию и (для мутирующих запросов) Origin.
 * Возвращает Response, если запрос нужно отклонить, иначе null.
 */
export async function apiAuth(req: Request): Promise<Response | null> {
  if (!(await getSession())) {
    return Response.json({ error: "Требуется вход в админку" }, { status: 401 });
  }
  const method = req.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const origin = req.headers.get("origin");
    if (origin) {
      try {
        const originHost = new URL(origin).host;
        const hosts = [
          req.headers.get("host"),
          ...(req.headers.get("x-forwarded-host")?.split(",") ?? []),
        ]
          .map((h) => h?.trim().toLowerCase())
          .filter(Boolean);
        if (!hosts.includes(originHost.toLowerCase())) {
          return Response.json({ error: "Запрос отклонён (origin)" }, { status: 403 });
        }
      } catch {
        return Response.json({ error: "Запрос отклонён (origin)" }, { status: 403 });
      }
    }
  }
  return null;
}

/* --------------------------- Пароль админки --------------------------- */

/**
 * Гарантирует, что пароль админки существует.
 * Приоритет: ADMIN_PASSWORD из env → сохранённый хэш → сгенерированный пароль.
 * Возвращает сгенерированный пароль ровно один раз (его нужно показать в логе).
 */
export async function ensureAdminPassword(): Promise<{ generated?: string }> {
  let rows = await db.select().from(settings).where(eq(settings.id, 1));
  if (!rows[0]) {
    await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
    rows = await db.select().from(settings).where(eq(settings.id, 1));
  }
  const row = rows[0];
  const envPassword = process.env.ADMIN_PASSWORD?.trim();

  if (envPassword) {
    if (!row.adminPasswordHash || !verifyPassword(envPassword, row.adminPasswordHash)) {
      await db
        .update(settings)
        .set({ adminPasswordHash: hashPassword(envPassword), updatedAt: new Date() })
        .where(eq(settings.id, 1));
    }
    return {};
  }

  if (row.adminPasswordHash) return {};

  const generated = randomPassword(14);
  await db
    .update(settings)
    .set({ adminPasswordHash: hashPassword(generated), updatedAt: new Date() })
    .where(eq(settings.id, 1));
  return { generated };
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const rows = await db.select().from(settings).where(eq(settings.id, 1));
  return !!rows[0]?.adminPasswordHash && verifyPassword(password, rows[0].adminPasswordHash);
}

export async function setAdminPassword(password: string): Promise<void> {
  await db
    .update(settings)
    .set({ adminPasswordHash: hashPassword(password), updatedAt: new Date() })
    .where(eq(settings.id, 1));
}
