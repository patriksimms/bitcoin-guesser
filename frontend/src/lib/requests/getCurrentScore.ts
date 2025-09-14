export default async function getCurrentScore(userID: string) {
    try {
        const response = await fetch(
            // TODO replace with env var
            import.meta.env.VITE_BITCOIN_GUESSER_BASE + `/guesses/score/${userID}`,
        )

        if (!response.ok) {
            throw new Error('Could not get the current score!', {
                cause: await response.text(),
            })
        }
        const body = await response.json()

        return body.correctGuesses
    } catch (e) {
        console.error(e)
        throw e
    }
}
