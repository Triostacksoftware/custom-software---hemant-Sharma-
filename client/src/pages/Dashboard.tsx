import React, { useState } from 'react'
import SideBar from '../components/SideBar.tsx'
import PoolCard from '../components/dash/PoolCard.tsx'
import { useNavigate } from 'react-router-dom'

export const data = {
  pools: [
    {id:1, name: "High Rollers", minBet: 1000, maxBet: 10000, currentMembers: 2, maxMembers: 4, status: "active"},
    {id:2, name: "Casual Play", minBet: 100, maxBet: 500, currentMembers: 4, maxMembers: 8, status: "active"},
    {id:3, name: "Beginners Luck", minBet: 10, maxBet: 100, currentMembers: 1, maxMembers: 5, status: "active"},
    {id:4, name: "Weekend Warriors", minBet: 500, maxBet: 2000, currentMembers: 3, maxMembers: 6, status: "active"},
  ]
}

const Dashboard = () => {
  const [pools, setPools] = useState(data.pools);
  const [currentPool, setCurrentPool] = useState(data.pools[0]);
  const [infoModalShown, setInfoModalShown] = useState(false);
  const [alertModal, setAlertModal] = useState([false, {}]);

  const navigate = useNavigate();

  const handleRequestJoin = (pool) => {
    // Update pool status to pending
    setPools(pools.map(p => 
      p.id === pool.id ? { ...p, status: "pending" } : p
    ));
    setAlertModal([true, pool]);
  };

  return (
    <div className='flex'>
      <SideBar />
      <main className='w-full min-h-screen p-4 sm:p-6 lg:p-8 font-sans ml-0 md:ml-0'>
        <h1 className='text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-medium mb-4 sm:mb-6 mt-3 ml-0 sm:ml-3 w-full'>
          Open Pools
        </h1>
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 px-0 sm:px-3'>
          {pools.map((pool) => (
            <PoolCard 
              key={pool.id} 
              name={pool.name} 
              minBet={pool.minBet.toString()} 
              maxBet={pool.maxBet.toString()} 
              currentMembers={pool.currentMembers} 
              maxMembers={pool.maxMembers}
              status={pool.status}
              isDiscover={true}
              onRequestJoin={() => handleRequestJoin(pool)}
              onMoreInfo={() => {setInfoModalShown(true); setCurrentPool(pool);}} 
            />
          ))}
        </div>
      </main>

      {infoModalShown && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-zinc-900 text-white rounded-lg p-6 w-11/12 sm:w-3/4 md:w-1/2 lg:w-1/3 border border-zinc-800'>
            <h2 className='text-2xl font-medium mb-4'>{currentPool.name}</h2>
            <p className='mb-2 text-zinc-300'>Min. Bet: ₹{currentPool.minBet.toLocaleString('en-IN')}</p>
            <p className='mb-2 text-zinc-300'>Max. Bet: ₹{currentPool.maxBet.toLocaleString('en-IN')}</p>
            <p className='mb-4 text-zinc-300'>Members: {currentPool.currentMembers}/{currentPool.maxMembers}</p>
            <div className='flex justify-end space-x-4'>
              <button 
                onClick={() => setInfoModalShown(false)} 
                className='bg-zinc-800 hover:bg-zinc-700 py-2 px-4 rounded-lg border border-zinc-700 transition'
              >
                Close
              </button>
              <button 
                onClick={() => {handleRequestJoin(currentPool); setInfoModalShown(false);}} 
                className='bg-blue-600 hover:bg-blue-700 py-2 px-4 rounded-lg border border-blue-700 text-white transition'
                disabled={currentPool.status === "pending" || currentPool.currentMembers >= currentPool.maxMembers}
              >
                {currentPool.status === "pending" ? "Requested" : currentPool.currentMembers >= currentPool.maxMembers ? "Full" : "Request to Join"}
              </button>
            </div>
          </div>
        </div>
      )}

      {alertModal[0] && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-zinc-900 text-white rounded-lg p-6 w-11/12 sm:w-3/4 md:w-1/2 lg:w-1/3 border border-zinc-800'>
            <h2 className='text-2xl font-medium mb-4'>Request Sent</h2>
            <p className='mb-4 text-zinc-300'>Your request to join the pool "{(alertModal[1] as any).name}" has been sent successfully.</p>
            <div className='flex justify-end'>
              <button 
                onClick={() => {setAlertModal([false, {}]);}} 
                className='bg-zinc-800 hover:bg-zinc-700 py-2 px-4 rounded-lg border border-zinc-700 transition'
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard;