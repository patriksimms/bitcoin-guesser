import { desc } from 'drizzle-orm'
import { BTCPrice } from '../db/schema/BTCPrice'
import { dbClient } from '../dbClient'
import Logger from '../Logger'

export class BinanceAPIService {
    static readonly BINANCE_BASE_URL = 'https://api.binance.com/api/v3'
    private readonly logger = new Logger(BinanceAPIService.name)

    startBTCPriceUpdate(): NodeJS.Timeout {
        return setInterval(async () => {
            try {
                const newPrice = await this.getBTCPriceFromAPI()
                await dbClient.insert(BTCPrice).values({ price: newPrice })
                this.logger.info('BTC Price inserted')
            } catch (e) {
                if (e instanceof Error) {
                    this.logger.error(e.message, e.cause)
                } else {
                    this.logger.error(e)
                }
                // throwing error to the outside. Proper error handling with fallback API or developer notification
                throw e
            }
        // once a minute
        }, 1000 * 60)
    }

    // binance returns price as string which matches decimal representation for drizzle
    private async getBTCPriceFromAPI(): Promise<string> {
        try {
            const res = await fetch(
                `${BinanceAPIService.BINANCE_BASE_URL}/ticker/price?symbol=BTCUSDT`,
            )

            if (!res.ok) {
                throw new Error('Error during BinanceAPI Request!', { cause: await res.text() })
            }

            const body = (await res.json()) as unknown as { symbol: string; price: string }

            return body.price
        } catch (e) {
            if (e instanceof Error) {
                this.logger.error(e.message, e.cause)
            } else {
                this.logger.error(e)
            }
            return '-1'
        }
    }

    async getLastBTCPrice(): Promise<string> {
        const latestBTCPrice = await dbClient.select().from(BTCPrice).orderBy(desc(BTCPrice.timeStamp))
        return latestBTCPrice.map(e => e.price)[0]
    }
}
