/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { DashboardLayout } from '../components/DashboardLayout'
import type { AuditLog } from '../types'

export function AuditLogs() {
  const { token } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])

  useEffect(() => {
    api<AuditLog[]>('/admin/audit-logs', token).then(setLogs).catch(() => {})
  }, [token])

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 font-bold text-slate-600">Timestamp</th>
              <th className="p-4 font-bold text-slate-600">Actor ID</th>
              <th className="p-4 font-bold text-slate-600">Action</th>
              <th className="p-4 font-bold text-slate-600">Entity Type</th>
              <th className="p-4 font-bold text-slate-600">Entity ID</th>
              <th className="p-4 font-bold text-slate-600">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 text-slate-500 text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                <td className="p-4 font-mono text-[10px] text-slate-500">{log.actor_id || 'SYSTEM'}</td>
                <td className="p-4 font-bold text-indigo-700">{log.action}</td>
                <td className="p-4 text-slate-600">{log.entity_type}</td>
                <td className="p-4 font-mono text-[10px] text-slate-500">{log.entity_id}</td>
                <td className="p-4 text-slate-500 text-xs truncate max-w-xs">
                  {log.metadata_json ? JSON.stringify(log.metadata_json) : '-'}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">No audit logs found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  )
}
