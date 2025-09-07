CREATE TYPE "public"."guess_type" AS ENUM('lower', 'higher');--> statement-breakpoint
CREATE TABLE "guesses" (
	"guess_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_uid" text NOT NULL,
	"guess" "guess_type" NOT NULL
);
--> statement-breakpoint
CREATE INDEX "player_uid_idx" ON "guesses" USING btree ("player_uid");