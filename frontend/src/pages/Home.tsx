/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CivicAlerts from '../components/CivicAlerts'

export function Home() {
  const { user } = useAuth()
  return (
    <div className="px-4 py-8 max-w-md mx-auto space-y-8">
      <CivicAlerts />
      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-emerald-100 rounded-full mx-auto flex items-center justify-center text-4xl shadow-sm">📸</div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Report Civic Issues</h1>
        <p className="text-slate-600">Help keep Pune clean and safe. Report issues and track their resolution in real-time.</p>
      </div>
      <div className="grid gap-4">
        <Link to="/report" className="flex items-center justify-between p-4 bg-emerald-600 text-white rounded-2xl shadow-md hover:bg-emerald-700 transition-colors">
          <span className="font-semibold text-lg">New Report</span>
          <span className="text-2xl">→</span>
        </Link>
        {user && user.role === 'citizen' && (
          <Link to="/my-reports" className="flex items-center justify-between p-4 bg-white border-2 border-slate-100 rounded-2xl shadow-sm hover:border-emerald-200 transition-colors">
            <span className="font-semibold text-slate-700">My Reports</span>
            <span className="text-xl">📋</span>
          </Link>
        )}
        <Link to="/leaderboard" className="flex items-center justify-between p-4 bg-white border-2 border-slate-100 rounded-2xl shadow-sm hover:border-emerald-200 transition-colors">
          <span className="font-semibold text-slate-700">Leaderboard</span>
          <span className="text-xl">🏆</span>
        </Link>
      </div>
    </div>
  )
}
