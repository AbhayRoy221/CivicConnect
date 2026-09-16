/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import type { User, AuditLog } from '../types'

export function Admin() {
  const { token } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<any>(null)
  const [logs, setLogs] = useState<AuditLog[]>([])

  useEffect(() => {
    api<User[]>('/admin/users', token).then(setUsers)
    api<any>('/admin/analytics', token).then(setStats)
    api<AuditLog[]>('/admin/audit', token).catch(() => setLogs([]))
  }, [token])

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8">
      <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm"><div className="text-slate-500 text-sm font-medium">Total Complaints</div><div className="text-3xl font-bold text-slate-900 mt-1">{stats.total_complaints}</div></div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm"><div className="text-slate-500 text-sm font-medium">Resolved</div><div className="text-3xl font-bold text-emerald-600 mt-1">{stats.resolved_complaints}</div></div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm"><div className="text-slate-500 text-sm font-medium">Escalated</div><div className="text-3xl font-bold text-red-600 mt-1">{stats.escalated_complaints}</div></div>
        </div>
      )}
      <div>
        <h2 className="text-xl font-bold mb-4">Users</h2>
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b last:border-0"><td className="p-3 font-medium">{u.name}</td><td className="p-3 text-slate-600">{u.email}</td><td className="p-3"><span className="px-2 py-1 bg-slate-100 rounded text-xs">{u.role}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
