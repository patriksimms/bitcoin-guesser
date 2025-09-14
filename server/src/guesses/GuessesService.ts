import { and, eq, gt, isNotNull, SQL, sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import * as z from 'zod'
import Logger from '../Logger'
import { BTCPrice } from '../db/schema/BTCPrice'
import { Guesses } from '../db/schema/Guesses'
import { dbClient } from '../dbClient'
import type { submitGuessSchema } from './GuessesController'

// custom lower function
export function lower(email: AnyPgColumn): SQL {
    return sql`lower(${email})`
}

export class GuessesService {
    private readonly logger = new Logger(GuessesService.name)

    // if successful, returns the guessID
    async submitGuess(
        uid: string,
        guess: z.infer<typeof submitGuessSchema>,
    ): Promise<'ALREADY_SUBMITTED' | string> {
        const guessAlreadySubmitted = await dbClient
            .select()
            .from(Guesses)
            .where(
                and(
                    eq(Guesses.playerUID, uid),
                    // get guesses made in the last 60 seconds
                    gt(Guesses.timeStamp, new Date(Date.now() - 60 * 1000)),
                ),
            )

        if (guessAlreadySubmitted.length > 0) {
            // could also be an error
            return 'ALREADY_SUBMITTED'
        }

        const entity = await dbClient
            .insert(Guesses)
            .values({
                playerUID: uid,
                guess: guess.guess,
            })
            .returning()

        this.logger.info(`Bet for player "${uid}" submitted!`)

        return entity[0].guessId
    }

    // returns the amount of correct guesses of one player
    // there is no state persisted if a guess was correct, only on demand it is calculated how many player guesses were right
    // advantage of this is we prevent inconsistent states where the actualTrend does not match the prices. Also allows for iterations where player is allowed to change data in the past
    // downside of this is the complexity of the query and the timing of the query. Potential improvement is creating a (materialized) view
    async getGuessScores(uid: string): Promise<number> {
        // calculates for all minute intervals if the price has gone up pr down
        const NormalizedPriceTrends = dbClient
            .select({
                current_minute_end_time: BTCPrice.timeStamp,
                // LAG pg function returns the xth row in order of the current row. https://www.postgresql.org/docs/current/functions-window.html
                // We assume that there is only one entry a minute, therefore the prev row is always the minute before
                previous_minute_end_time:
                    sql`LAG(${BTCPrice.timeStamp}, 1) OVER (ORDER BY ${BTCPrice.timeStamp})`.as(
                        'previous_minute_end_time',
                    ),
                current_price: BTCPrice.price,
                actual_trend: sql`
                                    CASE
                                        WHEN price > LAG(${BTCPrice.price}, 1) OVER (ORDER BY ${BTCPrice.timeStamp}) THEN 'higher'
                                        WHEN price < LAG(${BTCPrice.price}, 1) OVER (ORDER BY ${BTCPrice.timeStamp}) THEN 'lower'
                                        ELSE NULL -- For 'same' price or first entry where trend can't be determined for a 'higher'/'lower' guess
                                    END`.as('actual_trend'),
            })
            .from(BTCPrice)
            .as('NormalizedPriceTrends')

        // filter for relevant entries
        const RelevantPriceTrends = dbClient
            .select({
                trend_start_minute:
                    // we trunc to the full minute to be able to compare with the guesses
                    // since the guess itself is guaranteed to only happen once a minute, we can assume that here we can always compare to the previous minute
                    sql`DATE_TRUNC('minute', ${NormalizedPriceTrends.previous_minute_end_time})`.as(
                        'trend_start_minute',
                    ),
                actual_trend: NormalizedPriceTrends.actual_trend,
            })
            .from(NormalizedPriceTrends)
            .where(
                and(
                    isNotNull(NormalizedPriceTrends.previous_minute_end_time),
                    isNotNull(NormalizedPriceTrends.actual_trend),
                ),
            )
            .as('RelevantPriceTrends')

        // find all entries where specific player entries match the actualTrend
        const guessesWon = await dbClient
            .select({ guessId: Guesses.guessId })
            .from(Guesses)
            .leftJoin(
                RelevantPriceTrends,
                // prev trunc allows us to do equality compare here instead of comparing the 2 dates are max 60sec apart
                eq(
                    sql`DATE_TRUNC('minute', ${Guesses.timeStamp})`,
                    RelevantPriceTrends.trend_start_minute,
                ),
            )
            .where(
                and(
                    sql`LOWER(${Guesses.guess}::text) = LOWER(${RelevantPriceTrends.actual_trend})`,
                    eq(Guesses.playerUID, uid),
                ),
            )

        const guessesLost = await dbClient
            .select({ guessId: Guesses.guessId })
            .from(Guesses)
            .leftJoin(
                RelevantPriceTrends,
                // prev trunc allows us to do equality compare here instead of comparing the 2 dates are max 60sec apart
                eq(
                    sql`DATE_TRUNC('minute', ${Guesses.timeStamp})`,
                    RelevantPriceTrends.trend_start_minute,
                ),
            )
            .where(
                and(
                    sql`LOWER(${Guesses.guess}::text) <> LOWER(${RelevantPriceTrends.actual_trend})`,
                    eq(Guesses.playerUID, uid),
                ),
            )

        // it is suboptimal from performance pov that we execute this complex query 2 times. But works for now and 
        // should not be a problem for small-to-medium amount of users
        return guessesWon.length - guessesLost.length
    }
}
