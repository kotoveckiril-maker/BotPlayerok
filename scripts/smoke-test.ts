/**
 * Smoke-тест логики авто-выдачи на реальной PostgreSQL-совместимой БД.
 *
 * 1) Запустите тестовую БД:  PG_PORT=5433 node scripts/dev-db.mjs
 * 2) Запустите тест:         npm run test:smoke
 */
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5433/postgres";
process.env.ADMIN_PASSWORD ??= "smoke-test-password";
process.env.SETTINGS_SECRET ??= "smoke-test-secret";

type Deal = {
  id: string;
  status: "PAID" | "PENDING";
  direction: string;
  createdAt: string;
  user: { id: string; username: string };
  chat: { id: string };
  item: { id: string; name: string; price: number };
};

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error(`❌ ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

async function main() {
  const { migrateWithRetries } = await import("../src/db/migrate");
  const { db } = await import("../src/db");
  const { products, stockItems, deliveries, settings, aiUsage, logs } = await import("../src/db/schema");
  const { runDelivery, runConfirm } = await import("../src/lib/bot/delivery");
  const { getSettings, patchSettings } = await import("../src/lib/bot/settings");
  const { eq, sql } = await import("drizzle-orm");

  await migrateWithRetries();

  // чистим тестовые таблицы
  await db.delete(deliveries);
  await db.delete(stockItems);
  await db.delete(products);
  await db.delete(settings);
  await db.delete(aiUsage);
  await db.delete(logs);

  await getSettings();
  await patchSettings({ autoDelivery: true, autoConfirm: true });

  const [product] = await db
    .insert(products)
    .values({
      title: "Тестовый ключ",
      mode: "unit",
      playerokItemId: "item-1",
      keyword: "тест",
      message: "Спасибо, {buyer}! Ваш ключ: {data}",
    })
    .returning();
  await db.insert(stockItems).values([
    { productId: product.id, content: "KEY-ONE" },
    { productId: product.id, content: "KEY-TWO" },
  ]);

  const sent: { chatId: string; text: string }[] = [];
  const confirmed: string[] = [];

  const deal: Deal = {
    id: "deal-smoke-1",
    status: "PAID",
    direction: "OUT",
    createdAt: new Date().toISOString(),
    user: { id: "buyer-1", username: "Покупатель" },
    chat: { id: "chat-1" },
    item: { id: "item-1", name: "Тестовый ключ", price: 149 },
  };

  const mockClient = {
    userId: "seller-1",
    username: "seller",
    init: async () => ({
      id: "seller-1",
      username: "seller",
      balance: 0,
      isBlocked: false,
      canPublishItems: true,
      unreadChats: 0,
    }),
    getDeals: async () => [deal],
    sendMessage: async (chatId: string, text: string) => {
      sent.push({ chatId, text });
    },
    updateDeal: async (id: string, status: string) => {
      confirmed.push(`${id}:${status}`);
    },
  } as unknown as import("../src/lib/playerok/client").PlayerokClient;

  const s = await getSettings();
  const n1 = await runDelivery(mockClient, s);
  assert(n1 === 1, "первая выдача: 1 товар");
  assert(sent.length === 1, "сообщение отправлено один раз");
  assert(sent[0].text.includes("KEY-ONE"), "в сообщении лежит ключ со склада");
  assert(sent[0].text.includes("Покупатель"), "плейсхолдер {buyer} заменён");

  const n2 = await runDelivery(mockClient, s);
  assert(n2 === 0, "повторная выдача не дублируется");
  assert(sent.length === 1, "второе сообщение не отправлено");

  const [row] = await db.select().from(deliveries).where(eq(deliveries.dealId, deal.id));
  assert(row?.status === "delivered", "статус выдачи = delivered");
  assert(row?.price === 149, "цена сделки сохранена");

  const available = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(stockItems)
    .where(eq(stockItems.productId, product.id));
  assert(available[0].n === 2, "единицы склада не удаляются физически");

  const c1 = await runConfirm(mockClient, s);
  assert(c1 === 1, "авто-подтверждение выполнено");
  assert(confirmed[0] === `${deal.id}:SENT`, "вызван updateDeal со статусом SENT");
  const [confirmedRow] = await db.select().from(deliveries).where(eq(deliveries.dealId, deal.id));
  assert(confirmedRow.confirmed === true, "флаг confirmed установлен");

  // --- нет на складе ---
  const dealNoStock: Deal = { ...deal, id: "deal-smoke-2", item: { ...deal.item, id: "item-2" } };
  const [product2] = await db
    .insert(products)
    .values({ title: "Пустой товар", mode: "unit", playerokItemId: "item-2", message: "{data}" })
    .returning();
  void product2;
  const mock2 = {
    ...mockClient,
    getDeals: async () => [dealNoStock],
  } as unknown as import("../src/lib/playerok/client").PlayerokClient;
  const n3 = await runDelivery(mock2, s);
  assert(n3 === 0, "при пустом складе выдача не выполняется");
  const [ns] = await db.select().from(deliveries).where(eq(deliveries.dealId, dealNoStock.id));
  assert(ns?.status === "no_stock", "сделка помечена no_stock");

  // --- сопоставление по ключевому слову ---
  const dealKeyword: Deal = {
    ...deal,
    id: "deal-smoke-3",
    item: { id: "unknown-item", name: "Тестовый ключ (другой лот)", price: 200 },
  };
  await db.insert(stockItems).values({ productId: product.id, content: "KEY-THREE" });
  const mock3 = {
    ...mockClient,
    getDeals: async () => [dealKeyword],
  } as unknown as import("../src/lib/playerok/client").PlayerokClient;
  const n4 = await runDelivery(mock3, s);
  assert(n4 === 1, "сопоставление по ключевому слову работает");
  const last = sent[sent.length - 1];
  assert(last.text.includes("KEY-TWO"), "выдан следующий ключ со склада (в порядке очереди)");

  // --- криптография ---
  const { encrypt, decrypt, hashPassword, verifyPassword } = await import("../src/lib/crypto");
  assert(decrypt(encrypt("super-secret-token")) === "super-secret-token", "AES-шифрование round-trip");
  const hash = hashPassword("my-password");
  assert(hash.startsWith("scrypt:") && verifyPassword("my-password", hash), "scrypt-хэш пароля");
  assert(!verifyPassword("wrong", hash), "неверный пароль не проходит");

  // --- статистика ---
  const { recordAiUsage } = await import("../src/lib/bot/ai");
  await recordAiUsage(s, "reply", 10, 5);
  const { getStats } = await import("../src/lib/bot/stats");
  const stats = await getStats(7);
  assert(stats.kpi.revenue === 349, "выручка в статистике = 349 ₽");
  assert(stats.kpi.delivered === 2, "в статистике 2 успешные выдачи");
  assert(stats.kpi.noStock === 1, "в статистике 1 выдача без склада");
  assert(stats.kpi.aiReplies === 1, "счётчик ИИ-ответов работает");
  assert(stats.daily.length === 7, "график содержит 7 дней");

  // --- миграция секретов старого формата ---
  const { encryptLegacySecrets, getRawSettings } = await import("../src/lib/bot/settings");
  await db.update(settings).set({ playerokToken: "legacy-plain-token" }).where(eq(settings.id, 1));
  const encryptedCount = await encryptLegacySecrets();
  assert(encryptedCount >= 1, "секреты старого формата зашифрованы");
  const raw = await getRawSettings();
  assert(raw?.playerokToken.startsWith("enc:v1:"), "в БД токен лежит в зашифрованном виде");
  assert((await getSettings()).playerokToken === "legacy-plain-token", "расшифровка токена работает");

  console.log("\n🎉 Все smoke-тесты пройдены");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
