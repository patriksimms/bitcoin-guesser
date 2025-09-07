import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import * as z from 'zod'
import { GuessesService } from './GuessesService'
import { HTTPException } from 'hono/http-exception'

const router = new Hono()

const guessesService = new GuessesService()

export const submitGuessSchema = z.object({
    guess: z.enum(['lower', 'higher']),
})

router.post('/submit/:uid', zValidator('json', submitGuessSchema), async (c, _next) => {
    const uid = c.req.param('uid')
    const body = await c.req.json()

    const guessId = await guessesService.submitGuess(uid, body)

    if (guessId === 'ALREADY_SUBMITTED') {
        throw new HTTPException(429, {
            message: 'Already submitted a bet! Please wait until the next minute!',
        })
    }

    return c.json({ guessId })
})

router.get('/score/:uid', async (c, _next) => {
    const uid = c.req.param('uid')

    try {
        const correctGuesses = await guessesService.getGuessScores(uid)
        return c.json({
            correctGuesses,
        })
    } catch (e) {
        console.log(e)
    }
    throw new HTTPException(500)
})

export default router
