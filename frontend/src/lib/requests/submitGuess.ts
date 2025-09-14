import type { GuessType } from "@/App"

export default async function submitGuess(guess: GuessType, userID: string) {
    try {
        const result = await fetch(
            import.meta.env.VITE_BITCOIN_GUESSER_BASE + `/guesses/submit/${userID}`,
            {
                method: 'POST',
                body: JSON.stringify({ guess }),
                headers: {
                    'Content-Type': 'application/json'
                }
            },
        )

        if (!result.ok) {
            throw new Error(`Server responded with non ok HTTP code ${result.status}`, {
                cause: await result.text(),
            })
        }

        return
    } catch (e) {
        // just log the error here and let react-query handle the error
        console.error(e)
        throw e
    }
}
