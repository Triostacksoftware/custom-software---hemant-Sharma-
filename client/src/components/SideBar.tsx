import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Settings, User, Menu, X, Target, PenSquare, LogOut } from 'lucide-react'

const SideBar = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)

  const navItems = [
    { icon: Home, path: '/', label: 'Home' },
    { icon: Settings, path: '/settings', label: 'Settings' },
    { icon: PenSquare, path: '/pools/joined', label: 'Your Pools' },
  ]

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='fixed top-4 right-4 z-50 w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-white md:hidden'
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {isOpen && (
        <div
          className='fixed inset-0 bg-black/50 z-40 md:hidden'
          onClick={() => setIsOpen(false)}
        />
      )}

      <div
        className={`fixed md:sticky top-0 left-0 h-screen w-20 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-6 gap-2 z-40 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className='w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center mb-6'>
          <Target size={24} className='text-white' />
        </div>

        <div className='flex flex-col gap-2 w-full items-center'>
          {navItems.map((item) => {
            const IconComponent = item.icon
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path)
                  setIsOpen(false)
                }}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 group relative ${
                  location.pathname === item.path
                    ? 'bg-zinc-700 text-white'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white'
                }`}
                aria-label={item.label}
              >
                <IconComponent size={20} />
                
                <span className='absolute left-16 bg-zinc-800 text-white text-sm px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 border border-zinc-700'>
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>

        <div className='flex-grow' />

        <button className='w-12 h-12 bg-red-800 hover:bg-red-700 rounded-xl flex items-center justify-center transition-colors duration-200' onClick={()=>{
          localStorage.removeItem('authToken');
          navigate('/auth', { replace: true });
          window.location.reload();
        }}>
          <LogOut size={20} className='text-zinc-400 hover:text-white transition-colors' />
        </button>
      </div>
    </>
  )
}

export default SideBar