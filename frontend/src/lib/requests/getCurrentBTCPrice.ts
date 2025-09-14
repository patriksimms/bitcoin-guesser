export default async function getCurrentBTCPrice() {
    try {
        const response = await fetch(
            import.meta.env.VITE_BITCOIN_GUESSER_BASE + '/binanceAPIService/current',
        )

        if (!response.ok) {
            throw new Error('Server responded with non ok exit HTTP code', {
                cause: await response.text(),
            })
        }

        const currentPrice = await response.json()

        return currentPrice.price
    } catch (e) {
        // just log the error here and let react-query handle the error
        console.error(e)
        throw e
    }
}
