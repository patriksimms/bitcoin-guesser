import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { BinanceAPIService } from './BinanceAPIService'

const router = new Hono()

const binanceAPIService = new BinanceAPIService()

router.get('/current', async (c, _next) => {
    try {
        const price = await binanceAPIService.getLastBTCPrice()
        return c.json({
            price,
        })
    } catch (e) {
        console.error(e)
    }
    throw new HTTPException(500)
})

export default router
