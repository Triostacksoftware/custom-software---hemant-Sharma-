import React, { createContext, useContext, useState } from 'react'

const PoolsContext = createContext(null);

const PoolsProvider = ({children}) => {

    const [allPools, setAllPools] = useState([
        {id:1, name: "High Rollers", minBet: 1000, maxBet: 10000, currentMembers: 2, maxMembers: 4, status: "active"},
        {id:2, name: "Casual Play", minBet: 100, maxBet: 500, currentMembers: 4, maxMembers: 8, status: "active"},
        {id:3, name: "Beginners Luck", minBet: 10, maxBet: 100, currentMembers: 1, maxMembers: 5, status: "active"},
        {id:4, name: "Weekend Warriors", minBet: 500, maxBet: 2000, currentMembers: 3, maxMembers: 6, status: "active"},
    ]);
    const [userPools, setUserPools] = useState([
        {id:1, name: "Delhi Rally", minBet: 1000000, maxBet: 100000000000000, currentMembers: 50, maxMembers: 90},
        {id:2, name: "Casual Play", minBet: 100, maxBet: 500, currentMembers: 4, maxMembers: 8},
    ]);

  return (
    <PoolsContext.Provider value={{ allPools, userPools }}>
        {children}
    </PoolsContext.Provider>
  )
}

export default PoolsProvider;

export const usePools = () => useContext(PoolsContext);