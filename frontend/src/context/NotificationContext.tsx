import React, { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { api } from '../services/api'
import { useAuth } from './AuthContext'
import type { Notification } from '../types'

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  refreshNotifications: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])

  const refreshNotifications = async () => {
    if (!token || !user) {
      setNotifications([])
      return
    }
    try {
      const data = await api<Notification[]>('/notifications', token)
      setNotifications(data)
    } catch (e) {
      console.error('Failed to load notifications', e)
    }
  }

  useEffect(() => {
    refreshNotifications()
    const handleUpdate = () => refreshNotifications()
    window.addEventListener('notifications_updated', handleUpdate)
    return () => window.removeEventListener('notifications_updated', handleUpdate)
  }, [token, user])

  const markRead = async (id: string) => {
    if (!token) return

    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))

    try {
      await api(`/notifications/${id}/read`, token, { method: 'PATCH' })
    } catch (e) {
      console.error(e)
      // Revert on error by refetching
      refreshNotifications()
    }
  }

  const markAllRead = async () => {
    if (!token) return

    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))

    try {
      await api('/notifications/read-all', token, { method: 'PATCH' })
    } catch (e) {
      console.error(e)
      // Revert on error
      refreshNotifications()
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markRead, markAllRead, refreshNotifications }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}
