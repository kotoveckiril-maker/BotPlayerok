CREATE TABLE IF NOT EXISTS "ai_usage" (
	"day" date PRIMARY KEY NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"replies" integer DEFAULT 0 NOT NULL,
	"handoffs" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deals" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"direction" text DEFAULT 'OUT' NOT NULL,
	"buyer_id" text DEFAULT '' NOT NULL,
	"buyer_username" text DEFAULT '' NOT NULL,
	"item_id" text DEFAULT '' NOT NULL,
	"item_name" text DEFAULT '' NOT NULL,
	"price" double precision DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'RUB' NOT NULL,
	"chat_id" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_state" ADD COLUMN IF NOT EXISTS "replies" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "buyer_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "price" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'RUB' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "timezone" text DEFAULT 'Europe/Moscow' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "sync_deals" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "last_deals_sync_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "ai_max_tokens" integer DEFAULT 400 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "tg_bot_token" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "tg_chat_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "notify_sales" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "notify_errors" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "notify_low_stock" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "low_stock_threshold" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "admin_password_hash" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deals_created_idx" ON "deals" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deals_status_idx" ON "deals" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deals_item_idx" ON "deals" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deliveries_created_idx" ON "deliveries" USING btree ("created_at");