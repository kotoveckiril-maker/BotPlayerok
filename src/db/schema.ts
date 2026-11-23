import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Единственная строка (id = 1) с настройками бота.
 * Секреты (токены, ключи) хранятся в зашифрованном виде (AES-256-GCM),
 * см. src/lib/crypto.ts.
 */
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),

  // --- Аккаунт Playerok ---
  playerokToken: text("playerok_token").notNull().default(""),
  playerokCookies: text("playerok_cookies").notNull().default(""),
  userAgent: text("user_agent").notNull().default(""),
  accountId: text("account_id").notNull().default(""),
  accountUsername: text("account_username").notNull().default(""),

  // --- Общее ---
  botEnabled: boolean("bot_enabled").notNull().default(false),
  pollIntervalSec: integer("poll_interval_sec").notNull().default(15),
  timezone: text("timezone").notNull().default("Europe/Moscow"),

  // --- Авто-выдача ---
  autoDelivery: boolean("auto_delivery").notNull().default(true),
  // --- Авто-подтверждение ---
  autoConfirm: boolean("auto_confirm").notNull().default(true),

  // --- Авто-поднятие ---
  autoRaise: boolean("auto_raise").notNull().default(false),
  raiseIntervalMin: integer("raise_interval_min").notNull().default(240),
  raiseMaxPrice: integer("raise_max_price").notNull().default(0),
  lastRaiseAt: timestamp("last_raise_at", { withTimezone: true }),

  // --- Восстановление ---
  autoRestore: boolean("auto_restore").notNull().default(true),
  restoreIntervalMin: integer("restore_interval_min").notNull().default(10),
  restoreSold: boolean("restore_sold").notNull().default(true),
  restoreExpired: boolean("restore_expired").notNull().default(true),
  restoreUnlinked: boolean("restore_unlinked").notNull().default(false),
  lastRestoreAt: timestamp("last_restore_at", { withTimezone: true }),

  // --- Синхронизация сделок (для статистики) ---
  syncDeals: boolean("sync_deals").notNull().default(true),
  lastDealsSyncAt: timestamp("last_deals_sync_at", { withTimezone: true }),

  // --- ИИ автоответчик ---
  aiEnabled: boolean("ai_enabled").notNull().default(false),
  aiBaseUrl: text("ai_base_url").notNull().default("https://api.openai.com/v1"),
  aiApiKey: text("ai_api_key").notNull().default(""),
  aiModel: text("ai_model").notNull().default("gpt-4o-mini"),
  aiTemperature: integer("ai_temperature").notNull().default(5), // 0..10 => 0.0..1.0
  aiCooldownSec: integer("ai_cooldown_sec").notNull().default(20),
  aiHistoryLimit: integer("ai_history_limit").notNull().default(10),
  aiMaxAgeMin: integer("ai_max_age_min").notNull().default(60),
  aiMaxTokens: integer("ai_max_tokens").notNull().default(400),
  aiSystemPrompt: text("ai_system_prompt")
    .notNull()
    .default(
      "Ты — вежливый помощник продавца на маркетплейсе Playerok. Отвечай покупателю кратко, дружелюбно и по делу, на языке покупателя. Используй только информацию из каталога товаров и инструкции ниже. Никогда не обещай возвраты, скидки и не называй сроки, если их нет в инструкции. Не проси и не принимай оплату вне Playerok, не переходи в сторонние мессенджеры. Если не можешь помочь или покупатель просит позвать продавца — ответь ровно: [HANDOFF]",
    ),

  // --- Telegram-уведомления ---
  tgBotToken: text("tg_bot_token").notNull().default(""),
  tgChatId: text("tg_chat_id").notNull().default(""),
  notifySales: boolean("notify_sales").notNull().default(true),
  notifyErrors: boolean("notify_errors").notNull().default(true),
  notifyLowStock: boolean("notify_low_stock").notNull().default(true),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(3),

  // --- Пароль админки (scrypt-хэш) ---
  adminPasswordHash: text("admin_password_hash").notNull().default(""),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Товары (лоты) — правила выдачи. */
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  // 'unit' — поштучная выдача со склада, 'message' — одно и то же сообщение
  mode: text("mode").notNull().default("unit"),
  playerokItemId: text("playerok_item_id").notNull().default(""),
  keyword: text("keyword").notNull().default(""),
  // Шаблон сообщения. Плейсхолдеры: {data} {buyer} {item}
  message: text("message").notNull().default(""),
  // Описание для ИИ-помощника
  description: text("description").notNull().default(""),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Склад для поштучной выдачи. */
export const stockItems = pgTable(
  "stock_items",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    status: text("status").notNull().default("available"), // available | sold
    dealId: text("deal_id"),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("stock_product_status_idx").on(t.productId, t.status)],
);

/** История выдач по сделкам. */
export const deliveries = pgTable(
  "deliveries",
  {
    id: serial("id").primaryKey(),
    dealId: text("deal_id").notNull(),
    productId: integer("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    itemName: text("item_name").notNull().default(""),
    buyer: text("buyer").notNull().default(""),
    buyerId: text("buyer_id").notNull().default(""),
    chatId: text("chat_id").notNull().default(""),
    status: text("status").notNull().default("processing"), // processing | delivered | no_stock | failed
    delivered: text("delivered").notNull().default(""),
    error: text("error").notNull().default(""),
    attempts: integer("attempts").notNull().default(0),
    confirmed: boolean("confirmed").notNull().default(false),
    confirmAttempts: integer("confirm_attempts").notNull().default(0),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    price: doublePrecision("price").notNull().default(0),
    currency: text("currency").notNull().default("RUB"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("deliveries_deal_uq").on(t.dealId),
    index("deliveries_created_idx").on(t.createdAt),
  ],
);

/**
 * Зеркала сделок Playerok — источник достоверной статистики продаж.
 * Заполняется модулем syncDeals (см. src/lib/bot/deals.ts).
 */
export const deals = pgTable(
  "deals",
  {
    id: text("id").primaryKey(), // ID сделки на Playerok
    status: text("status").notNull(),
    direction: text("direction").notNull().default("OUT"),
    buyerId: text("buyer_id").notNull().default(""),
    buyerUsername: text("buyer_username").notNull().default(""),
    itemId: text("item_id").notNull().default(""),
    itemName: text("item_name").notNull().default(""),
    price: doublePrecision("price").notNull().default(0),
    currency: text("currency").notNull().default("RUB"),
    chatId: text("chat_id").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("deals_created_idx").on(t.createdAt),
    index("deals_status_idx").on(t.status),
    index("deals_item_idx").on(t.itemId),
  ],
);

/** Состояние обработки чатов ИИ-автоответчиком. */
export const chatState = pgTable("chat_state", {
  chatId: text("chat_id").primaryKey(),
  lastMessageId: text("last_message_id").notNull().default(""),
  lastReplyAt: timestamp("last_reply_at", { withTimezone: true }),
  replies: integer("replies").notNull().default(0),
});

/** Агрегированное использование ИИ по дням (для статистики и контроля расходов). */
export const aiUsage = pgTable("ai_usage", {
  day: date("day").primaryKey(),
  model: text("model").notNull().default(""),
  requests: integer("requests").notNull().default(0),
  replies: integer("replies").notNull().default(0),
  handoffs: integer("handoffs").notNull().default(0),
  errors: integer("errors").notNull().default(0),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const logs = pgTable(
  "logs",
  {
    id: serial("id").primaryKey(),
    level: text("level").notNull().default("info"), // info | success | warn | error
    module: text("module").notNull().default("bot"),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("logs_created_idx").on(t.createdAt)],
);
