CREATE TABLE "crypto_catalog" (
	"cmc_id" text PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "crypto_catalog_symbol_idx" ON "crypto_catalog" USING btree ("symbol");