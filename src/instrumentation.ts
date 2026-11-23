export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { migrateWithRetries } = await import("@/db/migrate");
  const { encryptLegacySecrets } = await import("@/lib/bot/settings");
  const { ensureAdminPassword } = await import("@/lib/auth");
  const { bootEngine } = await import("@/lib/bot/engine");
  const { log } = await import("@/lib/bot/log");

  try {
    await migrateWithRetries();

    const encrypted = await encryptLegacySecrets();
    if (encrypted > 0) {
      console.log(`[security] Зашифровано секретов старого формата: ${encrypted}`);
    }

    const { generated } = await ensureAdminPassword();
    if (generated) {
      console.log(
        [
          "",
          "──────────────────────────────────────────────────────────",
          "  Пароль админки сгенерирован:",
          "",
          `      ${generated}`,
          "",
          "  Сохраните его! Чтобы задать свой пароль, укажите ADMIN_PASSWORD",
          "  в .env и перезапустите приложение.",
          "──────────────────────────────────────────────────────────",
          "",
        ].join("\n"),
      );
    }

    await log("info", "system", "Сервер запущен, миграции применены");
    await bootEngine();
  } catch (e) {
    console.error("[boot] Ошибка при запуске:", e);
  }
}
