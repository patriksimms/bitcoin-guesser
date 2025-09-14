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
        console.error(e)
        if (e instanceof Error) {
            throw new Error('Could not submit new guess at server!', { cause: e })
        }
        throw e
    }
}
