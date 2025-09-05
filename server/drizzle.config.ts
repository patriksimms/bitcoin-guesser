import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    schema: './src/db/schema/*',
    out: './migrations',
    dialect: 'postgresql', // 'postgresql' | 'mysql' | 'sqlite'
    dbCredentials: {
        host: process.env.DB_HOST!,
        user: process.env.DB_USERNAME!,
        password: process.env.DB_PASSWORD!,
        database: process.env.DB_DATABASE!,
    },
    migrations: {
        schema: 'bitcoin-guesser-server'
    },
    
});
