import { decimal, pgTable, timestamp } from "drizzle-orm/pg-core";

export const BTCPrice = pgTable('btc_price', {
    timeStamp: timestamp('timestamp').notNull().primaryKey().defaultNow(),
    price: decimal('price').notNull()
})
