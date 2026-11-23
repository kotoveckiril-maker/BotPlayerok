import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, isDbConfigured } from "./index";
import fs from "node:fs";
import path from "node:path";

let migrationPromise: Promise<void> | null = null;

/** Применяет миграции из папки drizzle/. Идемпотентно и безопасно для нескольких воркеров. */
export function runMigrations(): Promise<void> {
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    const folder = path.join(process.cwd(), "drizzle");
    if (!fs.existsSync(folder)) {
      throw new Error(`Папка с миграциями не найдена: ${folder}`);
    }
    await migrate(db, { migrationsFolder: folder });
  })();
  return migrationPromise;
}

/**
 * Ждёт готовности БД и применяет миграции.
 * При старте контейнера Postgres может подниматься дольше приложения.
 */
export async function migrateWithRetries(maxAttempts = 20): Promise<void> {
  if (!isDbConfigured) {
    throw new Error(
      "DATABASE_URL не задан. Укажите строку подключения к PostgreSQL в .env и перезапустите приложение.",
    );
  }
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await runMigrations();
      return;
    } catch (e) {
      lastError = e;
      console.warn(
        `[db] попытка миграции ${attempt}/${maxAttempts} не удалась: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      await new Promise((r) => setTimeout(r, Math.min(10_000, attempt * 1000)));
    }
  }
  throw lastError;
}
