export default async function getCurrentBTCPrice() {
    try {
        const response = await fetch(
            // TODO replace with env var
            import.meta.env.BITCOIN_GUESSER_BASE + '/binanceAPIService/current',
        )

        if (!response.ok) {
            throw new Error('Could not get the current BTC price!', {
                cause: await response.text(),
            })
        }

        const currentPrice = await response.json()

        return currentPrice.price
    } catch (e) {
        console.error(e)
        throw e
    }
}
