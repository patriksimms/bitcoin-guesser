import postgres from "postgres"
import { drizzle } from 'drizzle-orm/postgres-js'

const pgClient = postgres({
    user: process.env.DB_USERNAME,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    port: +(process.env.DB_PORT ?? '5432'),
    database: process.env.DB_DATABASE,
})

export const dbClient = drizzle(pgClient, {
    logger: false
})
