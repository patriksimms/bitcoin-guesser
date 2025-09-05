import { HTTPException } from 'hono/http-exception'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

process.on('SIGINT', async () => {
    process.exit()
})

export const app = new Hono().onError((err, c) => {
    // Sentry.captureException(err)
    if (err instanceof HTTPException) {
        return err.getResponse()
    }

    return c.json({ error: 'Internal Server error' }, 500)
})

const allowedOrigins = ['http://localhost:3000']
const corsMiddleware = cors({
    origin: (origin) => {
        if (!origin) {
            return undefined
        }

        if (allowedOrigins.includes(origin)) {
            return origin
        }

        return undefined
    },
    credentials: true,
    allowHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
    maxAge: 600,
})

app.use('*', corsMiddleware)

app.get('/health', (c) => {
    return c.json({
        status: 'ok',
        stage: process.env.STAGE ?? 'local',
        commit: process.env.CI_COMMIT_SHA ?? 'unknown',
    })
})

console.log('Server is running on port 4099')

export default {
    port: 4099,
    fetch: app.fetch,
}
