/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { createContext, useContext, useState, useEffect } from 'react'
import type { User } from '../types'
import { api } from '../services/api'
import { Navigate, useNavigate } from 'react-router-dom'

type AuthContextType = {
  token: string | null
  user: User | null
  login: (token: string, user: User) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (token) {
      api<User>('/auth/me', token)
        .then(setUser)
        .catch(() => {
          setToken(null)
          localStorage.removeItem('token')
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token])

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        login: (t, u) => {
          setToken(t)
          setUser(u)
          localStorage.setItem('token', t)
        },
        logout: () => {
          setToken(null)
          setUser(null)
          localStorage.removeItem('token')
          navigate('/login')
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function Gate({ children, role, roles }: { children: React.ReactNode; role?: string; roles?: string[] }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" />
  
  if (roles && roles.length > 0) {
    if (!roles.includes(user.role)) return <Navigate to="/" />
  } else if (role) {
    if (user.role !== role) return <Navigate to="/" />
  }
  
  return <>{children}</>
}
