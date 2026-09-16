/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react'
import { api } from '../services/api'

export function Leaderboard() {
  const [board, setBoard] = useState<any[]>([])

  useEffect(() => {
    api<any[]>('/leaderboard').then(setBoard)
  }, [])

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-extrabold text-center mb-6 text-emerald-700">🏆 Civic Leaderboard</h1>
      
      {board.length === 0 || board.every(u => u.points === 0) ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="text-4xl mb-4">🌱</div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">No civic points earned yet.</h2>
          <p className="text-slate-500 text-sm">Points appear when eligible civic contributions earn rewards.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">
          {board.filter(u => u.points > 0).map((u, i) => (
            <div key={u.user_name + i} className={`flex items-center p-4 border-b border-slate-50 last:border-0 ${i === 0 ? 'bg-amber-50' : i === 1 ? 'bg-slate-50' : i === 2 ? 'bg-orange-50' : ''}`}>
              <div className="w-8 font-bold text-slate-400">{i + 1}</div>
              <div className="flex-1 font-medium text-slate-800">{u.user_name}</div>
              <div className="font-black text-emerald-600">{u.points} <span className="text-xs text-slate-400 font-normal">pts</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
