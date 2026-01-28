import React from 'react'
import SideBar from '../components/SideBar.tsx'
import PoolCard from '../components/dash/PoolCard.tsx'

const Dashboard = () => {
  return (
    <div className='flex'>
      <SideBar />
      <main className='w-full min-h-screen p-4 sm:p-6 lg:p-8 font-sans ml-0 md:ml-0'>
        <h1 className='text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-medium mb-4 sm:mb-6 mt-3 ml-0 sm:ml-3 w-full'>
          Open Pools
        </h1>
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 px-0 sm:px-3'>
          <PoolCard />
          <PoolCard name="High Rollers" minBet="1000" maxBet="10000" currentMembers={2} maxMembers={4} />
          <PoolCard name="Casual Play" minBet="100" maxBet="500" currentMembers={4} maxMembers={8} />
        </div>
      </main>
    </div>
  )
}

export default Dashboard