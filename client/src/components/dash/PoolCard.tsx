import React from "react";

export default function PoolCard({
  name = "Name of pool",
  minBet = "0",
  maxBet = "0",
  currentMembers = 3,
  maxMembers = 5,
  onRequestJoin = () => {},
  onMoreInfo = () => {},
  onViewDetails = () => {},
  onLeave = () => {},
  isDiscover = true,
  status = "active", // active, pending, full
}) {
  const isFull = currentMembers >= maxMembers;
  const isPending = status === "pending";
  
  // Format numbers with commas for better readability
  const formatCurrency = (amount) => {
    const num = parseInt(amount);
    return `₹${num.toLocaleString('en-IN')}`;
  };

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5 hover:border-zinc-700 transition-all duration-200">
      {/* Pool Name */}
      <h3 className="text-xl font-semibold text-white mb-4 truncate">{name}</h3>
      
      {/* Pool Details */}
      <div className="space-y-2 mb-5 text-zinc-300">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Min. Bet</span>
          <span className="font-medium text-white">{formatCurrency(minBet)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Max. Bet</span>
          <span className="font-medium text-white">{formatCurrency(maxBet)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Members</span>
          <span className="font-medium text-white">
            {currentMembers}/{maxMembers}
            {isFull && (
              <span className="ml-2 text-xs text-red-400 font-normal">(Full)</span>
            )}
            {isPending && (
              <span className="ml-2 text-xs text-yellow-400 font-normal">(Pending)</span>
            )}
          </span>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex gap-2">
        {isDiscover ? (
          <>
            {/* Discover Pools (Dashboard) Page Buttons */}
            <button
              onClick={onRequestJoin}
              disabled={isFull || isPending}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 border ${
                isFull || isPending
                  ? "bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed"
                  : "bg-blue-600 text-white border-blue-700 hover:bg-blue-700"
              }`}
            >
              {isPending ? "Requested" : isFull ? "Full" : "Request Join"}
            </button>
            <button
              onClick={onMoreInfo}
              className="flex-1 px-4 py-2 bg-zinc-800 text-white rounded-lg font-medium hover:bg-zinc-700 transition-all duration-200 border border-zinc-700"
            >
              More Info
            </button>
          </>
        ) : (
          <>
            {/* Your Pools Page Buttons */}
            <button
              onClick={onViewDetails}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 border border-blue-700"
            >
              View Details
            </button>
            <button
              onClick={onLeave}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-all duration-200 border border-red-700"
            >
              Leave
            </button>
          </>
        )}
      </div>
    </div>
  );
}