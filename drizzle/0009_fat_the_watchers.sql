DELETE FROM "transactions" WHERE "type" = 'dividend';--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."tx_type";--> statement-breakpoint
CREATE TYPE "public"."tx_type" AS ENUM('buy', 'sell');--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "type" SET DATA TYPE "public"."tx_type" USING "type"::"public"."tx_type";