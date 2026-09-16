/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import type { Complaint } from '../types'
import { Link, useNavigate } from 'react-router-dom'

export function MyReports() {
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [points, setPoints] = useState(0)

  useEffect(() => {
    api<Complaint[]>('/complaints/my', token).then(setComplaints)
    api<any>('/leaderboard').then(res => {
      const me = res.find((r: any) => r.user_id === user?.id)
      if (me) setPoints(me.total_points)
    })
  }, [token, user])

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 min-h-screen bg-slate-50">
      
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Reports</h1>
          <p className="text-slate-500 text-sm mt-1">Track your civic complaints and contributions.</p>
        </div>
        <button 
          onClick={() => navigate('/report')}
          className="bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
        >
          + New Report
        </button>
      </div>

      <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white mb-8 shadow-sm">
        <div className="text-indigo-100 text-sm font-semibold uppercase tracking-wider mb-1">Total Civic Points</div>
        <div className="text-4xl font-black">{points}</div>
      </div>
      
      {complaints.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-5xl mb-4">📝</div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">No Reports Yet</h3>
          <p className="text-slate-500 max-w-sm mx-auto">You haven't filed any reports. Start improving your city by reporting an issue today.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {complaints.map(c => {
            const isResolved = c.status === 'resolved'
            const isRejected = c.status === 'rejected'
            
            return (
              <Link key={c.id} to={`/complaints/${c.id}`} className="block bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all group">
                <div className="flex gap-4 mb-4">
                  <img src={`http://localhost:8000${c.image_url}`} className="w-24 h-24 rounded-xl object-cover" alt="Complaint" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1 truncate">{c.category_name || 'Uncategorized'}</div>
                    <div className="text-sm font-semibold text-slate-900 line-clamp-2 leading-tight mb-2">{c.description}</div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide inline-block ${
                      isResolved ? 'bg-emerald-100 text-emerald-800' : 
                      isRejected ? 'bg-red-100 text-red-800' : 
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                
                <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">ID</span>
                    <span className="font-mono text-slate-700">{c.public_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Date</span>
                    <span className="text-slate-700 font-medium">{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Authority</span>
                    <span className="text-slate-700 font-medium truncate">{c.authority || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Ward</span>
                    <span className="text-slate-700 font-medium truncate">{c.administrative_ward_name || c.administrative_ward_office || 'N/A'}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
