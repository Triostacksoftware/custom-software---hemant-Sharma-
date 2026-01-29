import React, { useState } from 'react'
import SideBar from '../components/SideBar.tsx'
import PoolCard from '../components/dash/PoolCard.tsx'
import { useNavigate } from 'react-router-dom'

export const data = {
  pools: [
    {id:1, name: "Delhi Rally", minBet: 1000000, maxBet: 100000000000000, currentMembers: 50, maxMembers: 90},
    {id:2, name: "Casual Play", minBet: 100, maxBet: 500, currentMembers: 4, maxMembers: 8},
  ]
}

const YourPools = () => {
  const [pools, setPools] = useState(data.pools);
  const [currentPool, setCurrentPool] = useState(data.pools[0]);
  const [detailsModalShown, setDetailsModalShown] = useState(false);
  const [leaveModal, setLeaveModal] = useState([false, {}]);

  const navigate = useNavigate();

  const handleViewDetails = (pool) => {
    setCurrentPool(pool);
    setDetailsModalShown(true);
  };

  const handleLeavePool = (pool) => {
    setCurrentPool(pool);
    setLeaveModal([true, pool]);
  };

  const confirmLeave = () => {
    // Remove pool from the list
    setPools(pools.filter(p => p.id !== (leaveModal[1] as any).id));
    setLeaveModal([false, {}]);
    setDetailsModalShown(false);
  };

  return (
    <div className='flex'>
      <SideBar />
      <main className='w-full min-h-screen p-4 sm:p-6 lg:p-8 font-sans ml-0 md:ml-0'>
        <h1 className='text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-medium mb-4 sm:mb-6 mt-3 ml-0 sm:ml-3 w-full'>
          Your Pools
        </h1>
        
        {pools.length === 0 ? (
          <div className='bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center mx-3'>
            <p className='text-zinc-400 text-lg mb-4'>You haven't joined any pools yet.</p>
            <button 
              onClick={() => navigate('/dashboard')}
              className='px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition border border-blue-700'
            >
              Discover Pools
            </button>
          </div>
        ) : (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 px-0 sm:px-3'>
            {pools.map((pool) => (
              <PoolCard 
                key={pool.id} 
                name={pool.name} 
                minBet={pool.minBet.toString()} 
                maxBet={pool.maxBet.toString()} 
                currentMembers={pool.currentMembers} 
                maxMembers={pool.maxMembers}
                isDiscover={false}
                onViewDetails={() => handleViewDetails(pool)}
                onLeave={() => handleLeavePool(pool)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Details Modal */}
      {detailsModalShown && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-zinc-900 text-white rounded-lg p-6 w-11/12 sm:w-3/4 md:w-1/2 lg:w-1/3 border border-zinc-800'>
            <h2 className='text-2xl font-medium mb-4'>{currentPool.name}</h2>
            <div className='space-y-2 mb-6'>
              <p className='text-zinc-300'>Min. Bet: ₹{currentPool.minBet.toLocaleString('en-IN')}</p>
              <p className='text-zinc-300'>Max. Bet: ₹{currentPool.maxBet.toLocaleString('en-IN')}</p>
              <p className='text-zinc-300'>Members: {currentPool.currentMembers}/{currentPool.maxMembers}</p>
            </div>
            <div className='flex justify-end space-x-4'>
              <button 
                onClick={() => setDetailsModalShown(false)} 
                className='bg-zinc-800 hover:bg-zinc-700 py-2 px-4 rounded-lg border border-zinc-700 transition'
              >
                Close
              </button>
              <button 
                onClick={() => {setLeaveModal([true, currentPool]);}} 
                className='bg-red-600 hover:bg-red-700 py-2 px-4 rounded-lg border border-red-700 text-white transition'
              >
                Leave Pool
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Confirmation Modal */}
      {leaveModal[0] && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-zinc-900 text-white rounded-lg p-6 w-11/12 sm:w-3/4 md:w-1/2 lg:w-1/3 border border-zinc-800'>
            <h2 className='text-2xl font-medium mb-4'>Leave Pool?</h2>
            <p className='mb-4 text-zinc-300'>Are you sure you want to leave "{(leaveModal[1] as any).name}"? This action cannot be undone.</p>
            <div className='flex justify-end space-x-4'>
              <button 
                onClick={() => {setLeaveModal([false, {}]);}} 
                className='bg-zinc-800 hover:bg-zinc-700 py-2 px-4 rounded-lg border border-zinc-700 transition'
              >
                Cancel
              </button>
              <button 
                onClick={confirmLeave} 
                className='bg-red-600 hover:bg-red-700 py-2 px-4 rounded-lg border border-red-700 text-white transition'
              >
                Leave Pool
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default YourPools;