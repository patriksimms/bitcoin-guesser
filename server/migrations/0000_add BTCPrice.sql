CREATE TABLE "btc_price" (
	"timestamp" timestamp PRIMARY KEY DEFAULT now() NOT NULL,
	"price" numeric NOT NULL
);
