CREATE TYPE "public"."asset_market" AS ENUM('US', 'SET');--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "market" "asset_market" DEFAULT 'US' NOT NULL;