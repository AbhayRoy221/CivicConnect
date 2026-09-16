/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { Link } from 'react-router-dom'

export function Notifications() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-sm text-emerald-600 font-semibold hover:text-emerald-700">
            Mark all read
          </button>
        )}
      </div>
      {notifications.length === 0 ? (
        <div className="text-center text-slate-500 mt-10">No notifications yet.</div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className={`p-4 rounded-xl border ${n.is_read ? 'bg-white border-slate-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="font-semibold text-slate-800">{n.title}</h3>
                  <p className="text-sm text-slate-600 mt-1">{n.message}</p>
                  <div className="text-xs text-slate-400 mt-2">{new Date(n.created_at).toLocaleString()}</div>
                  {n.complaint_id && (
                    <Link to={`/complaints/${n.complaint_id}`} className="text-xs text-emerald-600 font-medium mt-2 inline-block">View Complaint →</Link>
                  )}
                </div>
                {!n.is_read && (
                  <button onClick={() => markRead(n.id)} className="text-xs font-medium bg-white px-2 py-1 rounded text-emerald-600 border border-emerald-200 shadow-sm whitespace-nowrap">Mark Read</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
