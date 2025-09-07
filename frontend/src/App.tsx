import { Environment } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useQuery } from '@tanstack/react-query'
import { Suspense, useEffect, useState } from 'react'
import './App.css'
import { BitcoinModel } from './BitcoinModel.tsx'
import { Button } from './components/ui/button'
import getCurrentBTCPrice from './lib/getCurrentBTCPrice.ts'
import { queryClient } from './main.tsx'

function App() {
    const [updateTimer, setUpdateTimer] = useState<NodeJS.Timeout>()

    const query = useQuery({
        queryKey: ['btcPrice'],
        queryFn: getCurrentBTCPrice,
    })

    // TODO for some reason it looks like this is executed twice every time
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
                        parseFloat(query.data),
                    )}
                </p>
            </div>
            <p className="italic px-6 mt-12">
                Please make your next guess: Is the BTC price in 1 minute higher or lower than
                currently?
            </p>
            <div className="grid grid-cols-2 mx-8 gap-2 mt-4">
                <Button className="h-14 bg-red-800">Lower</Button>
                <Button className="h-14 bg-green-800">Higher</Button>
            </div>
        </main>
    )
}
export default App
