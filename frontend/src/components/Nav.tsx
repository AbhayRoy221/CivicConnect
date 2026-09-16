/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'

export function Nav() {
  const { user, logout, token } = useAuth()
  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-bold text-lg text-emerald-600 flex items-center gap-2">
          <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center">🌿</div>
          CivicConnect
        </Link>
        {user ? (
          <NavUserActions user={user} logout={logout} token={token} />
        ) : (
          <div className="flex gap-4 items-center text-sm">
            <Link to="/login" className="text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">Login</Link>
          </div>
        )}
      </div>
    </nav>
  )
}

function NavUserActions({ user, logout, token }: any) {
  const { unreadCount } = useNotifications()
  
  return (
    <div className="flex gap-4 items-center text-sm">
      <Link to="/notifications" className="text-slate-600 hover:text-emerald-600 relative">
        🔔
        {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-3.5 h-3.5 flex items-center justify-center rounded-full">{unreadCount}</span>}
      </Link>
      <Link to={user.role === 'citizen' ? '/my-reports' : '/admin'} className="font-medium text-slate-700 hover:text-emerald-600">
        Dashboard
      </Link>
      <button onClick={logout} className="text-slate-500 hover:text-red-600">Logout</button>
    </div>
  )
}
