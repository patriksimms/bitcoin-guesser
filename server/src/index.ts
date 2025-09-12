import { HTTPException } from 'hono/http-exception'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { BinanceAPIService } from './binanceAPI/BinanceAPIService'
import guessesController from '../src/guesses/GuessesController'
import binanceAPIController from '../src/binanceAPI/BinanceAPIController'

export const app = new Hono().onError((err, c) => {
    // Sentry.captureException(err)
    if (err instanceof HTTPException) {
        return err.getResponse()
    }

    return c.json({ error: 'Internal Server error' }, 500)
})

const allowedOrigins = ['http://localhost:5173, https://d2ng2zbdmi9642.cloudfront.net']
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

app.route('/guesses', guessesController)
app.route('/binanceAPIService', binanceAPIController)

const binanceAPIService = new BinanceAPIService()
const interval = binanceAPIService.startBTCPriceUpdate()

process.on('SIGINT', async () => {
    clearInterval(interval)
    process.exit()
})

console.log('Server is running on port 4099')

export default {
    port: 4099,
    fetch: app.fetch,
}
