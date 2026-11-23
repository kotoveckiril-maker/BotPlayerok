import { apiAuth, setAdminPassword, verifyAdminPassword } from "@/lib/auth";
import { log } from "@/lib/bot/log";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await apiAuth(req);
  if (auth) return auth;

  const { current, next } = (await req.json().catch(() => ({}))) as {
    current?: string;
    next?: string;
  };

  if (!current || !next) {
    return Response.json({ error: "Заполните оба поля" }, { status: 400 });
  }
  if (next.length < 8) {
    return Response.json({ error: "Новый пароль должен быть не короче 8 символов" }, { status: 400 });
  }
  if (!(await verifyAdminPassword(current))) {
    return Response.json({ error: "Текущий пароль неверен" }, { status: 400 });
  }

  await setAdminPassword(next);
  void log("success", "auth", "Пароль админки изменён");
  return Response.json({ ok: true });
}
