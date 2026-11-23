import { apiAuth, getSession } from "@/lib/auth";
import { getSettings, patchSettings, publicSettings, type Settings } from "@/lib/bot/settings";

export const dynamic = "force-dynamic";

const BOOLS = [
  "autoDelivery",
  "autoConfirm",
  "autoRaise",
  "autoRestore",
  "restoreSold",
  "restoreExpired",
  "restoreUnlinked",
  "aiEnabled",
  "syncDeals",
  "notifySales",
  "notifyErrors",
  "notifyLowStock",
] as const;

const INTS: Record<string, [number, number]> = {
  pollIntervalSec: [5, 3600],
  raiseIntervalMin: [5, 10080],
  raiseMaxPrice: [0, 100000],
  restoreIntervalMin: [1, 10080],
  aiTemperature: [0, 10],
  aiCooldownSec: [0, 3600],
  aiHistoryLimit: [1, 40],
  aiMaxAgeMin: [1, 10080],
  aiMaxTokens: [50, 4000],
  lowStockThreshold: [0, 100000],
};

const TEXTS = ["userAgent", "aiBaseUrl", "aiModel", "aiSystemPrompt", "timezone", "tgChatId"] as const;
// Секреты: пустое значение = не менять, "__clear__" = очистить
const SECRETS = ["playerokToken", "playerokCookies", "aiApiKey", "tgBotToken"] as const;

export async function GET() {
  if (!(await getSession())) {
    return Response.json({ error: "Требуется вход в админку" }, { status: 401 });
  }
  return Response.json(publicSettings(await getSettings()));
}

export async function PUT(req: Request) {
  const auth = await apiAuth(req);
  if (auth) return auth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Partial<Omit<Settings, "id">> = {};
  const p = patch as Record<string, unknown>;

  for (const k of BOOLS) if (typeof body[k] === "boolean") p[k] = body[k];
  for (const [k, [min, max]] of Object.entries(INTS)) {
    const v = Number(body[k]);
    if (body[k] !== undefined && Number.isFinite(v)) {
      p[k] = Math.min(max, Math.max(min, Math.round(v)));
    }
  }
  for (const k of TEXTS) if (typeof body[k] === "string") p[k] = (body[k] as string).trim();
  for (const k of SECRETS) {
    const v = body[k];
    if (typeof v !== "string") continue;
    if (v === "__clear__") p[k] = "";
    else if (v.trim()) p[k] = v.trim().replace(/^token=/, "");
  }

  if (typeof p.timezone === "string" && p.timezone) {
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: p.timezone });
    } catch {
      return Response.json({ error: `Неизвестный часовой пояс: ${p.timezone}` }, { status: 400 });
    }
  }
  if (p.playerokToken !== undefined || p.playerokCookies !== undefined) {
    p.accountUsername = "";
    p.accountId = "";
  }

  return Response.json(publicSettings(await patchSettings(patch)));
}
