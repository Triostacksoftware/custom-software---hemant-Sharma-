import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import UserProvider from './context/UserContext.tsx'
import PoolsProvider from './context/PoolsProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <UserProvider>
      <PoolsProvider>
        <App />
      </PoolsProvider>
    </UserProvider>
  </BrowserRouter>
)
