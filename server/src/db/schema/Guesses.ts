import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const guessTypeEnum = pgEnum("guess_type", ["lower", "higher"]);

export const Guesses = pgTable('guesses', {
    guessId: uuid('guess_id').primaryKey().defaultRandom(),
    playerUID: text('player_uid').notNull(),
    guess: guessTypeEnum().notNull(),
    timeStamp: timestamp('timestamp').notNull().defaultNow(),
}, (table) => [
    index('player_uid_idx').on(table.playerUID)
])
