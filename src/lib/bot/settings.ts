import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export type Settings = typeof settings.$inferSelect;

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(settings).where(eq(settings.id, 1));
  if (rows[0]) return rows[0];
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  const again = await db.select().from(settings).where(eq(settings.id, 1));
  return again[0];
}

export async function patchSettings(
  patch: Partial<Omit<Settings, "id">>,
): Promise<Settings> {
  await getSettings();
  await db
    .update(settings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(settings.id, 1));
  return getSettings();
}

/** Настройки для клиента: секреты маскируются. */
export function publicSettings(s: Settings) {
  const {
    playerokToken,
    playerokCookies,
    aiApiKey,
    ...rest
  } = s;
  return {
    ...rest,
    hasToken: playerokToken.length > 0,
    tokenPreview: playerokToken ? `${playerokToken.slice(0, 6)}…${playerokToken.slice(-4)}` : "",
    hasCookies: playerokCookies.length > 0,
    hasAiKey: aiApiKey.length > 0 || !!process.env.OPENAI_API_KEY,
  };
}
