DROP INDEX "assets_symbol_type_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "assets_symbol_type_market_uq" ON "assets" USING btree ("symbol","type","market");