export default async function getCurrentBTCPrice() {
    try {
        const response = await fetch(
            // TODO replace with env var
            'http://localhost:4099' + '/binanceAPIService/current',
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
