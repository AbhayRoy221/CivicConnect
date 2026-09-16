/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react'
import { useParams, Link } from 'react-router-dom'

export function Confirmation() {
  const { id } = useParams()
  return (
    <div className="max-w-md mx-auto p-8 text-center space-y-6">
      <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-5xl mx-auto mb-6">✓</div>
      <h1 className="text-2xl font-bold text-slate-900">Report Submitted!</h1>
      <p className="text-slate-600">Your complaint has been registered securely. The relevant department has been notified.</p>
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm font-mono text-slate-700 break-all">ID: {id}</div>
      <Link to={`/complaints/${id}`} className="block w-full bg-emerald-600 text-white font-bold p-3 rounded-xl hover:bg-emerald-700">Track Status</Link>
    </div>
  )
}
