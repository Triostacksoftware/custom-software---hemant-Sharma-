import React, { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { usePools } from '../context/PoolsProvider'
import SideBar from '../components/SideBar'

const Pool = () => {
  const { poolId } = useParams()
  const { userPools } = usePools()

  const pool = userPools?.find(p => p.id === Number(poolId))

  const [bidAmount, setBidAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)


  const isBiddingClosed = useMemo(() => {
    return new Date(pool?.biddingEndAt) < new Date()
  }, [pool])

  const leaderboard = useMemo(() => {
    if (!pool?.bids) return []
    return [...pool.bids].sort((a, b) => b.amount - a.amount)
  }, [pool])

  const highestBid = leaderboard[0]?.amount ?? 0


  const handleBidSubmit = async () => {
    if (!bidAmount || Number(bidAmount) <= highestBid) return

    setIsSubmitting(true)

    try {

      console.log('Bid placed:', bidAmount)

      setBidAmount('')
    } catch (err) {
      console.error('Bid failed', err)
    } finally {
      setIsSubmitting(false)
    }
  }


  if (!pool) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <h2 className="text-2xl text-white">Pool not found</h2>
      </div>
    )
  }

  return (
    <div className="flex">
      <SideBar />
      <div className="min-h-screen bg-black text-white p-6 w-full">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-semibold">{pool.name}</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Bidding ends on{' '}
            <span className="text-white">
              {new Date().toLocaleDateString()}
            </span>
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Leaderboard */}
          <section className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-xl font-medium mb-4">Leaderboard</h2>

            {leaderboard.length === 0 ? (
              <p className="text-zinc-400">No bids yet</p>
            ) : (
              <ul className="space-y-3">
                {leaderboard.map((bid, index) => (
                  <li
                    key={bid.userId}
                    className="flex justify-between items-center bg-zinc-800 px-4 py-3 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-400 w-6">
                        #{index + 1}
                      </span>
                      <span className="font-medium">{bid.username}</span>
                    </div>
                    <span className="font-semibold">₹{bid.amount}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Bid Panel */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-xl font-medium mb-4">Place a Bid</h2>

            <p className="text-sm text-zinc-400 mb-2">
              Current highest bid:
              <span className="text-white font-medium ml-1">
                ₹{highestBid}
              </span>
            </p>

            <input
              type="number"
              value={bidAmount}
              onChange={e => setBidAmount(e.target.value)}
              placeholder="Enter bid amount"
              className="w-full mt-3 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 outline-none"
              disabled={isBiddingClosed}
            />

            <button
              onClick={handleBidSubmit}
              disabled={
                isBiddingClosed ||
                isSubmitting ||
                Number(bidAmount) <= highestBid
              }
              className="w-full mt-4 py-2 rounded-lg bg-white text-black font-medium disabled:opacity-40"
            >
              {isBiddingClosed ? 'Bidding Closed' : 'Place Bid'}
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}

export default Pool
