CREATE TABLE IF NOT EXISTS "chat_state" (
	"chat_id" text PRIMARY KEY NOT NULL,
	"last_message_id" text DEFAULT '' NOT NULL,
	"last_reply_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"mode" text DEFAULT 'unit' NOT NULL,
	"playerok_item_id" text DEFAULT '' NOT NULL,
	"keyword" text DEFAULT '' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" text NOT NULL,
	"product_id" integer,
	"item_name" text DEFAULT '' NOT NULL,
	"buyer" text DEFAULT '' NOT NULL,
	"chat_id" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"delivered" text DEFAULT '' NOT NULL,
	"error" text DEFAULT '' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"confirmed" boolean DEFAULT false NOT NULL,
	"confirm_attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliveries_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"module" text DEFAULT 'bot' NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"playerok_token" text DEFAULT '' NOT NULL,
	"playerok_cookies" text DEFAULT '' NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL,
	"account_id" text DEFAULT '' NOT NULL,
	"account_username" text DEFAULT '' NOT NULL,
	"bot_enabled" boolean DEFAULT false NOT NULL,
	"poll_interval_sec" integer DEFAULT 15 NOT NULL,
	"auto_delivery" boolean DEFAULT true NOT NULL,
	"auto_confirm" boolean DEFAULT true NOT NULL,
	"auto_raise" boolean DEFAULT false NOT NULL,
	"raise_interval_min" integer DEFAULT 240 NOT NULL,
	"raise_max_price" integer DEFAULT 0 NOT NULL,
	"last_raise_at" timestamp with time zone,
	"auto_restore" boolean DEFAULT true NOT NULL,
	"restore_interval_min" integer DEFAULT 10 NOT NULL,
	"restore_sold" boolean DEFAULT true NOT NULL,
	"restore_expired" boolean DEFAULT true NOT NULL,
	"restore_unlinked" boolean DEFAULT false NOT NULL,
	"last_restore_at" timestamp with time zone,
	"ai_enabled" boolean DEFAULT false NOT NULL,
	"ai_base_url" text DEFAULT 'https://api.openai.com/v1' NOT NULL,
	"ai_api_key" text DEFAULT '' NOT NULL,
	"ai_model" text DEFAULT 'gpt-4o-mini' NOT NULL,
	"ai_temperature" integer DEFAULT 5 NOT NULL,
	"ai_cooldown_sec" integer DEFAULT 20 NOT NULL,
	"ai_history_limit" integer DEFAULT 10 NOT NULL,
	"ai_max_age_min" integer DEFAULT 60 NOT NULL,
	"ai_system_prompt" text DEFAULT 'Ты — вежливый помощник продавца на маркетплейсе Playerok. Отвечай покупателю кратко, дружелюбно и по делу, на языке покупателя. Используй только информацию из каталога товаров и инструкции ниже. Никогда не обещай возвраты, скидки и не называй сроки, если их нет в инструкции. Не проси и не принимай оплату вне Playerok, не переходи в сторонние мессенджеры. Если не можешь помочь или покупатель просит позвать продавца — ответь ровно: [HANDOFF]' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"deal_id" text,
	"sold_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deliveries_deal_uq" ON "deliveries" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "logs_created_idx" ON "logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_product_status_idx" ON "stock_items" USING btree ("product_id","status");
