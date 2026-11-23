import { getSession, verifyAdminPassword, sessionCookieHeader } from "@/lib/auth";
import { log } from "@/lib/bot/log";

export const dynamic = "force-dynamic";

const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string): boolean {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || rec.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + 5 * 60_000 });
    return false;
  }
  rec.count++;
  return rec.count > 8;
}

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  if (rateLimit(ip)) {
    return Response.json(
      { error: "Слишком много попыток. Подождите 5 минут." },
      { status: 429 },
    );
  }

  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!password) {
    return Response.json({ error: "Введите пароль" }, { status: 400 });
  }

  const ok = await verifyAdminPassword(password);
  if (!ok) {
    void log("warn", "auth", `Неудачная попытка входа с IP ${ip}`);
    return Response.json({ error: "Неверный пароль" }, { status: 401 });
  }

  const secure =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https" ||
    process.env.COOKIE_SECURE === "1";
  void log("success", "auth", "Успешный вход в админку");
  return Response.json(
    { ok: true },
    { headers: { "set-cookie": sessionCookieHeader(secure) } },
  );
}

export async function GET() {
  const session = await getSession();
  return session
    ? Response.json({ ok: true })
    : Response.json({ ok: false }, { status: 401 });
}
