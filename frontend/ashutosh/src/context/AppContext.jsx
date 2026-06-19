import { createContext, useContext, useState } from 'react'
import { user as dummyUser } from '../data/dummyData'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [user] = useState(dummyUser)

  return (
    <AppContext.Provider value={{
      isAuthenticated, setIsAuthenticated,
      sidebarCollapsed, setSidebarCollapsed,
      user,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
