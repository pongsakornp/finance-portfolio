CREATE TABLE "benchmark_cache" (
	"index" text NOT NULL,
	"day" date NOT NULL,
	"close" numeric(20, 8) NOT NULL,
	CONSTRAINT "benchmark_cache_index_day_pk" PRIMARY KEY("index","day")
);
