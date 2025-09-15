import { Environment } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { generateUUID } from 'three/src/math/MathUtils.js'
import './App.css'
import { BitcoinModel } from './BitcoinModel.tsx'
import { Button } from './components/ui/button'
import useErrorNotification from './hooks/useErrorNotification.tsx'
import getCurrentBTCPrice from './lib/requests/getCurrentBTCPrice.ts'
import getCurrentScore from './lib/requests/getCurrentScore.ts'
import submitGuess from './lib/requests/submitGuess.ts'
import { LocalStorage } from './lib/WebStorage.ts'
import { queryClient } from './main.tsx'

export type GuessType = 'higher' | 'lower'

function App() {
    // updateTimer for the btcPrice (every 10sec)
    const [updateTimer, setUpdateTimer] = useState<NodeJS.Timeout>()
    const [uid, setUid] = useState('')
    const [nextGuessPossibleIn, setNextGuessPossibleIn] = useState(0)

    const {
        data: btcPrice,
        isLoading: isBtcPriceLoading,
        isError: isBtcPriceError,
        error: btcPriceError,
    } = useQuery({
        queryKey: ['btcPrice'],
        queryFn: getCurrentBTCPrice,
    })

    const {
        data: currentScore,
        isLoading: isCurrentScoreLoading,
        isError: isCurrentScoreError,
        error: currentScoreError,
    } = useQuery({
        queryKey: ['currentScore', uid],
        queryFn: async () => getCurrentScore(uid),
        // prevent initial update before effect has ran to set the UID
        enabled: uid !== '',
    })

    // simple error messaging. In future versions, a real handling could happen here 
    useErrorNotification({
        isError: isBtcPriceError,
        title: 'Error fetching the current BTC price',
        description: btcPriceError?.message ?? 'Unknonwn error',
    })

    // simple error messaging. In future versions, a real handling could happen here 
    useErrorNotification({
        isError: isCurrentScoreError,
        title: 'Error fetching the current user score',
        description: currentScoreError?.message ?? 'Unknown error',
    })

    const mutation = useMutation({
        mutationFn: async (guess: GuessType) => {
            await submitGuess(guess, uid)
        },
        onSuccess: () => {
            setNextGuessPossibleIn(60)
            // we cannot use the nextGuessPossible state variable here trivially since it is not updated immediately 
            // and setNextGuess would set it to -1 instantly
            let index = 60
            const ticker = setInterval(() => {
                setNextGuessPossibleIn(--index)
            }, 1 * 1000)

            setTimeout(async () => {
                setNextGuessPossibleIn(0)
                clearInterval(ticker)
                // refresh score
                await queryClient.invalidateQueries({ queryKey: ['currentScore'] })
            }, 61 * 1000)
        },
        onError: (error: Error) => {
            // when the user refreshes the page, we have no way to know when the last guess was submitted.
            // In future versions we could fetch the lastSubmitted timestamp from the server for the user or store the lastSubmit in localStorage
            if (error.message.includes('Server responded with non ok HTTP code 429')) {
                toast.error(
                    'You can only submit once every 60 seconds! Please wait before your next guess!',
                )
                return
            }
            // simple error messaging. In future versions, a real handling could happen here 
            toast.error(error.message)
        },
    })

    // uid is persisted in localStorage, when none is existing yet, creating one and saving it there
    useEffect(() => {
        if (LocalStorage.has('distinct_uid')) {
            setUid(LocalStorage.get('distinct_uid')!)
            return
        }
        const uid = generateUUID()
        LocalStorage.set('distinct_uid', uid)
        setUid(uid)
    }, [])

    // fetching a new BTC price every 10 seconds. Compared to updating only 60s after submit, 
    // this should increase "tension" if the price is going to change again
    useEffect(() => {
        setUpdateTimer(
            setInterval(async () => {
                await queryClient.refetchQueries({queryKey: ['btcPrice']})
            }, 10 * 1000),
        )

        return clearInterval(updateTimer)
    }, [])

    return (
        <main className="px-4 mt-12">
            <h1 className="text-center scroll-m-20 text-4xl font-extrabold tracking-tight text-balance">
                Bitcoin Guesser
            </h1>
            <Canvas className="mt-4">
                <Suspense fallback={null}>
                    <BitcoinModel />
                    <Environment preset="sunset" />
                </Suspense>
            </Canvas>
            <div className="mt-12">
                <h2 className="text-center">Current Bitcoin to USD exchange rate:</h2>
                <p className="mt-2 text-center scroll-m-20 text-4xl font-extrabold tracking-tight text-balance text-green-800">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                        parseFloat(isBtcPriceLoading ? '0' : btcPrice),
                    )}
                </p>
            </div>
            <div>
                <h3 className="text-center">
                    Your current score:{' '}
                    <span className="font-bold italic text-xl ">
                        {isCurrentScoreLoading ? '...' : currentScore}
                    </span>
                </h3>
            </div>
            <p className=" text-center italic px-6 mt-12">
                Please make your next guess: Is the BTC price in 1 minute higher or lower than
                currently?
            </p>
            <p className=" text-center italic px-6">
                You can guess again in {nextGuessPossibleIn} seconds
            </p>
            <div className="grid grid-cols-2 mx-8 gap-2 mt-4">
                <Button
                    className="h-14 bg-red-800 cursor-pointer"
                    disabled={nextGuessPossibleIn !== 0}
                    onClick={() => mutation.mutate('lower')}
                >
                    Lower
                </Button>
                <Button
                    className="h-14 bg-green-800 cursor-pointer"
                    disabled={nextGuessPossibleIn !== 0}
                    onClick={() => {
                        mutation.mutate('higher')
                    }}
                >
                    Higher
                </Button>
            </div>
        </main>
    )
}
export default App
