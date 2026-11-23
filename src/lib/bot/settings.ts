import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decrypt, encrypt, isEncrypted } from "@/lib/crypto";

export type Settings = typeof settings.$inferSelect;

/** Поля, которые хранятся только в зашифрованном виде. */
export const SECRET_FIELDS = [
  "playerokToken",
  "playerokCookies",
  "aiApiKey",
  "tgBotToken",
] as const;

export type SecretField = (typeof SECRET_FIELDS)[number];

let decryptWarningShown = false;

/** Секреты/параметры, которые можно задать через переменные окружения. */
const ENV_FALLBACKS: Record<string, string | undefined> = {
  aiApiKey: process.env.OPENAI_API_KEY,
  aiBaseUrl: process.env.AI_BASE_URL,
  aiModel: process.env.AI_MODEL,
  tgBotToken: process.env.TELEGRAM_BOT_TOKEN,
  tgChatId: process.env.TELEGRAM_CHAT_ID,
};

/** Применяет env-значения там, где в БД пусто (БД приоритетнее). */
function applyEnvFallbacks(s: Settings): Settings {
  const out = { ...s } as Settings;
  for (const [key, envValue] of Object.entries(ENV_FALLBACKS)) {
    if (envValue?.trim() && !out[key as keyof Settings]) {
      (out as Record<string, unknown>)[key] = envValue.trim();
    }
  }
  return out;
}

function decryptRow(row: Settings): Settings {
  const out = { ...row } as Settings;
  for (const key of SECRET_FIELDS) {
    if (!row[key]) continue;
    try {
      out[key] = decrypt(row[key]) as never;
    } catch (e) {
      // Ключ шифрования потерян/изменён: не ломаем приложение,
      // а даём возможность заново ввести секреты в настройках.
      out[key] = "" as never;
      if (!decryptWarningShown) {
        decryptWarningShown = true;
        console.error(
          "[security] Не удалось расшифровать сохранённые секреты:",
          e instanceof Error ? e.message : String(e),
        );
      }
    }
  }
  return applyEnvFallbacks(out);
}

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(settings).where(eq(settings.id, 1));
  if (!rows[0]) {
    await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
    const again = await db.select().from(settings).where(eq(settings.id, 1));
    return again[0] ? decryptRow(again[0]) : ({} as Settings);
  }
  return decryptRow(rows[0]);
}

/** Читает строку настроек без расшифровки (нужно для миграции секретов). */
export async function getRawSettings(): Promise<Settings | null> {
  const rows = await db.select().from(settings).where(eq(settings.id, 1));
  return rows[0] ?? null;
}

export async function patchSettings(
  patch: Partial<Omit<Settings, "id">>,
): Promise<Settings> {
  await getSettings();
  const safe: Partial<Omit<Settings, "id">> = { ...patch };
  for (const key of SECRET_FIELDS) {
    const value = (patch as Record<string, unknown>)[key];
    if (typeof value === "string") {
      (safe as Record<string, unknown>)[key] = encrypt(value);
    }
  }
  await db
    .update(settings)
    .set({ ...safe, updatedAt: new Date() })
    .where(eq(settings.id, 1));
  return getSettings();
}

/**
 * Шифрует секреты, сохранённые старыми версиями в открытом виде.
 * Вызывается один раз при старте сервера.
 */
export async function encryptLegacySecrets(): Promise<number> {
  const raw = await getRawSettings();
  if (!raw) return 0;
  const patch: Record<string, string> = {};
  for (const key of SECRET_FIELDS) {
    if (raw[key] && !isEncrypted(raw[key])) {
      patch[key] = encrypt(raw[key]);
    }
  }
  if (!Object.keys(patch).length) return 0;
  await db.update(settings).set(patch).where(eq(settings.id, 1));
  return Object.keys(patch).length;
}

/** Настройки для клиента: секреты маскируются. */
export function publicSettings(s: Settings) {
  const {
    playerokToken,
    playerokCookies,
    aiApiKey,
    tgBotToken,
    adminPasswordHash,
    ...rest
  } = s;
  return {
    ...rest,
    hasToken: (playerokToken ?? "").length > 0,
    tokenPreview: playerokToken
      ? `${playerokToken.slice(0, 6)}…${playerokToken.slice(-4)}`
      : "",
    hasCookies: (playerokCookies ?? "").length > 0,
    hasAiKey: (aiApiKey ?? "").length > 0 || !!process.env.OPENAI_API_KEY,
    hasTgToken: (tgBotToken ?? "").length > 0 || !!process.env.TELEGRAM_BOT_TOKEN,
    hasPassword: (adminPasswordHash ?? "").length > 0,
  };
}
