import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api } from '../api/endpoints'

interface User {
  id: number
  first_name: string
  last_name: string
  email: string
  is_staff?: boolean
  profile: any
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (token: string, refresh: string, user: User) => void
  logout: () => void
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access')
    if (token) {
      api.auth.me()
        .then((data) => setUser(data))
        .catch(() => {
          localStorage.removeItem('access')
          localStorage.removeItem('refresh')
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = (token: string, refresh: string, userData: User) => {
    localStorage.setItem('access', token)
    localStorage.setItem('refresh', refresh)
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
