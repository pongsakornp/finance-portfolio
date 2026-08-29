CREATE TABLE "fx_history" (
	"pair" text NOT NULL,
	"day" date NOT NULL,
	"rate" numeric(18, 8) NOT NULL,
	CONSTRAINT "fx_history_pair_day_pk" PRIMARY KEY("pair","day")
);
--> statement-breakpoint
DROP TABLE "snapshots" CASCADE;