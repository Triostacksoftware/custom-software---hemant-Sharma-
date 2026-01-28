import React from "react";

export default function PoolCard({
  name = "Name of pool",
  minBet = "rupee",
  maxBet = "rupee",
  currentMembers = 3,
  maxMembers = 5,
  onRequestJoin = () => {},
  onMoreInfo = () => {}
}) {
  return (
    <div className="w-full h-full flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-6 text-white hover:border-zinc-700 transition-colors">
      
      <h2 className="text-xl sm:text-2xl font-medium mb-4 break-words">
        {name}
      </h2>

      <div className="space-y-2 mb-6 text-zinc-400 text-sm">
        <p>Min. Bet – {minBet}</p>
        <p>Max. Bet – {maxBet}</p>
        <p>Members – {currentMembers}/{maxMembers}</p>
      </div>

      <div className="mt-auto flex flex-col sm:flex-row gap-2">
        <button
          onClick={onRequestJoin}
          className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-2.5 rounded-lg border border-zinc-700 transition"
        >
          Request Join
        </button>

        <button
          onClick={onMoreInfo}
          className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-2.5 rounded-lg border border-zinc-700 transition"
        >
          More Info
        </button>
      </div>

    </div>
  )
}
