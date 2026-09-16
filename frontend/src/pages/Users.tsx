/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { DashboardLayout } from '../components/DashboardLayout'
import type { User } from '../types'

export function Users() {
  const { token, user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<any[]>([])

  useEffect(() => {
    load()
    api<any[]>('/departments').then(setDepartments).catch(() => {})
  }, [token])

  async function load() {
    api<User[]>('/admin/users', token).then(setUsers).catch(() => {})
  }

  async function handleRoleChange(userId: string, newRole: string) {
    if (userId === currentUser?.id) return alert("Cannot change your own role")
    
    let deptId = null
    if (newRole === 'municipal_officer') {
      const p = prompt("Enter Department ID for this DEMO OFFICER (leave blank for unassigned scope):")
      if (p !== null && p.trim() !== "") deptId = p.trim()
    }
    
    try {
      await api(`/admin/users/${userId}/role`, token, { 
        method: 'PATCH', 
        body: JSON.stringify({ role: newRole, department_id: deptId || null })
      })
      load()
    } catch (e: any) {
      alert(e.message)
    }
  }

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 font-bold text-slate-600">ID</th>
              <th className="p-4 font-bold text-slate-600">Name</th>
              <th className="p-4 font-bold text-slate-600">Email</th>
              <th className="p-4 font-bold text-slate-600">Role</th>
              <th className="p-4 font-bold text-slate-600">Department Scope</th>
              <th className="p-4 font-bold text-slate-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 font-mono text-xs text-slate-500">{u.id}</td>
                <td className="p-4 font-medium text-slate-900">
                  {u.name}
                  {u.role === 'municipal_officer' && <span className="ml-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">DEMO</span>}
                </td>
                <td className="p-4 text-slate-600">{u.email}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                    u.role === 'administrator' ? 'bg-purple-100 text-purple-700' :
                    u.role === 'municipal_officer' ? 'bg-indigo-100 text-indigo-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {u.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="p-4 text-slate-600 text-xs">
                  {u.department_id ? departments.find(d => d.id === u.department_id)?.name || u.department_id : '-'}
                </td>
                <td className="p-4 text-right">
                  {u.id !== currentUser?.id && (
                    <select 
                      className="border border-slate-300 rounded text-xs p-1 outline-none focus:ring-1 focus:ring-indigo-500"
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                    >
                      <option value="citizen">Citizen</option>
                      <option value="municipal_officer">Demo Officer</option>
                      <option value="administrator">Administrator</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  )
}
