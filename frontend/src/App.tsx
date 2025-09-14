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
        enabled: uid !== '',
    })

    useErrorNotification({
        isError: isBtcPriceError,
        title: 'Error fetching the current BTC price',
        description: btcPriceError?.message ?? 'Unknonwn error',
    })

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
            console.log('Guess Submit successful!')
            setNextGuessPossibleIn(60)
            let index = 60
            const ticker = setInterval(() => {
                setNextGuessPossibleIn(--index)
            }, 1 * 1000)
            setTimeout(async () => {
                console.log('You can guess again!')
                setNextGuessPossibleIn(0)
                clearInterval(ticker)
                await queryClient.invalidateQueries({ queryKey: ['currentScore', 'uid'] })
            }, 60 * 1000)
        },
        onError: (error: Error) => {
            if (error.message.includes('Could not submit new guess at server!')) {
                toast.error(
                    'You can only submit once every 60 seconds! Please wait before your next guess!',
                )
            }
        },
    })

    useEffect(() => {
        console.log('make sure this is just called once')
        if (LocalStorage.has('distinct_uid')) {
            setUid(LocalStorage.get('distinct_uid')!)
            return
        }
        const uid = generateUUID()
        LocalStorage.set('distinct_uid', uid)
        setUid(uid)
    }, [])

    useEffect(() => {
        setUpdateTimer(
            setInterval(async () => {
                await queryClient.refetchQueries()
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
