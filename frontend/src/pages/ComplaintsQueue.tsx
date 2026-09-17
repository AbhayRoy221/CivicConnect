/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { DashboardLayout } from '../components/DashboardLayout'
import type { Complaint } from '../types'

export function ComplaintsQueue() {
  const { token, user } = useAuth()
  const [complaints, setComplaints] = useState<Complaint[]>([])
  
  // Filters
  const [departmentId, setDepartmentId] = useState('')
  const [authority, setAuthority] = useState('')
  const [status, setStatus] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  
  const [departments, setDepartments] = useState<any[]>([])

  useEffect(() => {
    api<any[]>('/departments').then(setDepartments).catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [token, departmentId, authority, status, sortBy])

  async function load() {
    let url = '/officer/complaints?'
    if (departmentId) url += `department_id=${departmentId}&`
    if (authority) url += `authority=${authority}&`
    if (status) url += `status=${status}&`
    if (sortBy) url += `sort_by=${sortBy}&`
    
    try {
      const res = await api<Complaint[]>(url.slice(0, -1), token)
      setComplaints(res)
    } catch (e: any) {
      console.error(e)
    }
  }

  const isAdmin = user?.role === 'administrator'

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Complaints Queue</h1>
      </div>

      {isAdmin && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Authority</label>
            <select className="border border-slate-300 rounded-lg text-sm p-2 w-48" value={authority} onChange={e => setAuthority(e.target.value)}>
              <option value="">All Authorities</option>
              <option value="PMC">PMC</option>
              <option value="PUNE_TRAFFIC_POLICE">Pune Traffic Police</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Department</label>
            <select className="border border-slate-300 rounded-lg text-sm p-2 w-48" value={departmentId} onChange={e => setDepartmentId(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Status</label>
            <select className="border border-slate-300 rounded-lg text-sm p-2 w-40" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Sort By</label>
            <select className="border border-slate-300 rounded-lg text-sm p-2 w-40" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="created_at">Newest First</option>
              <option value="priority">Priority: High → Low</option>
            </select>
          </div>
          <button onClick={load} className="bg-slate-900 text-white font-bold px-4 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors">
            Refresh
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 font-bold text-slate-600">ID</th>
                <th className="p-4 font-bold text-slate-600">Category</th>
                <th className="p-4 font-bold text-slate-600">Authority</th>
                <th className="p-4 font-bold text-slate-600">Department</th>
                <th className="p-4 font-bold text-slate-600">Geo Ward</th>
                <th className="p-4 font-bold text-slate-600">Admin Ward</th>
                <th className="p-4 font-bold text-slate-600">Zone</th>
                <th className="p-4 font-bold text-slate-600">Severity</th>
                <th className="p-4 font-bold text-slate-600">Priority</th>
                <th className="p-4 font-bold text-slate-600">Status</th>
                <th className="p-4 font-bold text-slate-600">Assignment</th>
                <th className="p-4 font-bold text-slate-600">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {complaints.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-500">
                    {isAdmin ? "No complaints found matching this filter." : "No complaints are currently assigned to you."}
                  </td>
                </tr>
              ) : (
                complaints.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-mono text-xs">
                      <Link to={`/admin/complaints/${c.id}`} className="text-indigo-600 hover:underline font-bold">
                        {c.public_id}
                      </Link>
                    </td>
                    <td className="p-4 font-medium text-slate-900">{c.category_name}</td>
                    <td className="p-4">
                      {c.department_name ? (
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${c.department_name.includes('Traffic') ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                          {c.department_name.includes('Traffic') ? 'TRAFFIC' : 'PMC'}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Not determined</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-700 max-w-[150px] truncate">{c.department_name || <span className="italic text-slate-400">Not determined</span>}</td>
                    <td className="p-4 text-slate-700">{c.geographic_ward_number || <span className="italic text-slate-400">Not determined</span>}</td>
                    <td className="p-4 text-slate-700">{c.administrative_ward_name || <span className="italic text-slate-400">Not determined</span>}</td>
                    <td className="p-4 text-slate-700">{c.administrative_zone || <span className="italic text-slate-400">Not determined</span>}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${c.severity === 'high' || c.severity === 'critical' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                        {c.severity || 'MEDIUM'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-slate-800">{c.effective_priority ?? c.priority_score ?? 0}</span>
                        {c.admin_priority_override !== null && c.admin_priority_override !== undefined && (
                          <span className="text-[10px] font-bold text-purple-600" title="Admin Override Active">★</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                        c.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' :
                        c.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                        c.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {c.is_escalated ? 'ESCALATED' : c.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4">
                      {c.officer_id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span className="text-xs font-bold text-slate-700">{c.officer_name} <span className="text-indigo-400 font-bold">(DEMO)</span></span>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-slate-500 italic">Ward Office / Manual Triage</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-500 text-xs">{new Date(c.created_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  )
}
