/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { DashboardLayout } from '../components/DashboardLayout'

export function Dashboard() {
  const { token, user } = useAuth()
  const [stats, setStats] = useState<any>(null)
  const [gisStatus, setGisStatus] = useState<any>(null)
  
  useEffect(() => {
    api<any>('/admin/analytics', token).then(setStats)
    if (user?.role === 'administrator') {
      api<any>('/admin/gis-sync-status', token).then(setGisStatus).catch(() => {})
    }
  }, [token, user])

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Operations Dashboard</h1>
      
      {stats ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {user?.role === 'municipal_officer' && (
              <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100 shadow-sm col-span-2 md:col-span-1">
                <div className="text-indigo-600 text-xs font-bold uppercase tracking-wider">My Assigned</div>
                <div className="text-3xl font-bold text-indigo-900 mt-2">{stats.my_assigned || 0}</div>
              </div>
            )}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total</div>
              <div className="text-3xl font-bold text-slate-900 mt-2">{stats.complaints_total}</div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">Submitted</div>
              <div className="text-3xl font-bold text-slate-900 mt-2">{stats.by_status?.submitted || 0}</div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">In Progress</div>
              <div className="text-3xl font-bold text-amber-600 mt-2">{stats.by_status?.in_progress || 0}</div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">Resolved</div>
              <div className="text-3xl font-bold text-emerald-600 mt-2">{stats.by_status?.resolved || 0}</div>
            </div>
            <div className="bg-red-50 p-5 rounded-xl border border-red-100 shadow-sm">
              <div className="text-red-600 text-xs font-bold uppercase tracking-wider">Disputed</div>
              <div className="text-3xl font-bold text-red-900 mt-2">{stats.disputed || 0}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4">By Category</h3>
              <div className="space-y-2">
                {Object.entries(stats.by_category || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                    <span className="text-sm font-medium text-slate-700">{k}</span>
                    <span className="text-sm font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{v as number}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4">By Authority</h3>
              <div className="space-y-2">
                {Object.entries(stats.by_authority || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                    <span className="text-sm font-medium text-slate-700">{k.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{v as number}</span>
                  </div>
                ))}
              </div>
            </div>

            {user?.role === 'administrator' && (
              <>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4">By Department</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {Object.entries(stats.by_department || {}).map(([k, v]) => (
                      <div key={k} className="flex justify-between items-center border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                        <span className="text-sm font-medium text-slate-700 truncate mr-2">{k}</span>
                        <span className="text-sm font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{v as number}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4">By Administrative Ward</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {Object.entries(stats.by_admin_ward || {}).map(([k, v]) => (
                      <div key={k} className="flex justify-between items-center border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                        <span className="text-sm font-medium text-slate-700 truncate mr-2">{k}</span>
                        <span className="text-sm font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{v as number}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {gisStatus && (
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm col-span-1 md:col-span-2">
                    <h3 className="font-bold text-slate-900 mb-4">GIS Synchronization Status</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start">
                        <span className="font-medium text-slate-700 w-48 shrink-0">Current Refresh Status:</span>
                        <span className={`font-semibold ${gisStatus.status.includes('unavailable') ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {gisStatus.status}
                        </span>
                      </div>
                      <div className="flex items-start">
                        <span className="font-medium text-slate-700 w-48 shrink-0">Geographic Wards:</span>
                        <span className="font-bold text-slate-900">{gisStatus.pune_wards_count} verified records</span>
                      </div>
                      <div className="flex items-start">
                        <span className="font-medium text-slate-700 w-48 shrink-0">Administrative Ward Offices:</span>
                        <span className="font-bold text-slate-900">{gisStatus.administrative_ward_offices_count} verified records</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="text-slate-500 animate-pulse">Loading analytics...</div>
      )}
    </DashboardLayout>
  )
}
