import React, { useState, useEffect } from 'react';
import { CitizenLayout } from '../components/CitizenLayout';
import { api } from '../services/api';
import { Trophy, TrendingUp, AlertTriangle } from 'lucide-react';

interface LeaderboardEntry {
  user_id: string;
  user_name: string;
  points: number;
  complaints_resolved: number;
}

export function Leaderboard() {
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const res = await api<LeaderboardEntry[]>('/leaderboard');
      setBoard(res);
      setError(null);
    } catch (err: any) {
      setError('Unable to load the community leaderboard right now.');
    } finally {
      setLoading(false);
    }
  };

  const topThree = board.slice(0, 3);
  const others = board.slice(3, 10);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <CitizenLayout>
      <div className="w-full pb-12 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 font-sans">

        {/* HERO SECTION */}
        <div className="relative rounded-[32px] overflow-hidden shadow-sm border border-emerald-100 bg-emerald-50/30 mb-8 w-full min-h-[240px] md:min-h-[320px] flex items-center">
          <div className="absolute inset-0 z-0">
             <img
              src="/assets/leaderboard/leaderboard-hero.png"
              alt="Pune Skyline Panoramic"
              className="w-full h-full object-cover object-center opacity-90"
             />
             <div className="absolute inset-0 bg-gradient-to-r from-emerald-50 via-emerald-50/90 to-transparent"></div>
          </div>
          <div className="relative z-10 p-8 md:p-12 max-w-2xl">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center shadow-inner border border-amber-200/60 shrink-0">
                <Trophy className="w-6 h-6 text-amber-500" />
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-emerald-950 tracking-tight">Leaderboard</h1>
            </div>
            <p className="text-emerald-800/80 font-medium md:text-lg">Citizens making Pune cleaner, safer and better — one report at a time.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-8 rounded-3xl text-center border border-red-100">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium text-lg">{error}</p>
            <button
              onClick={fetchLeaderboard}
              className="mt-6 px-6 py-2 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition"
            >
              Try Again
            </button>
          </div>
        ) : board.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl text-center border border-slate-200 shadow-sm">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-300 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trophy className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">No civic points earned yet</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              Leaderboard data will appear as citizens contribute to the community.
            </p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8 items-start">

            {/* LEFT COLUMN: PODIUM & TABLE */}
            <div className="flex-1 w-full space-y-8">

              {/* PODIUM */}
              <div className="flex flex-col sm:flex-row items-end justify-center gap-4 sm:gap-6 pt-12 pb-4">

                {/* 2nd Place */}
                {topThree[1] && (
                  <div className="w-full sm:w-1/3 order-2 sm:order-1 flex flex-col items-center">
                    <div className="relative bg-slate-50 border border-slate-200/70 shadow-sm rounded-t-3xl rounded-b-xl p-6 pb-8 w-full text-center mt-8">
                       <div className="absolute -top-10 left-1/2 -translate-x-1/2">
                          <div className="relative">
                            <svg className="w-16 h-16 text-slate-400 drop-shadow-md" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"/>
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center pb-2 text-white font-bold text-lg">2</span>
                          </div>
                       </div>
                       <div className="w-16 h-16 mx-auto bg-slate-200 rounded-full border-4 border-white shadow-sm flex items-center justify-center mb-4 mt-2">
                         <span className="text-slate-500 font-bold text-xl">{getInitials(topThree[1].user_name)}</span>
                       </div>
                       <h3 className="font-bold text-slate-800 text-lg line-clamp-1">{topThree[1].user_name}</h3>
                       <div className="mt-3 bg-white py-2 rounded-xl shadow-xs border border-slate-100">
                          <div className="font-black text-2xl text-slate-700 leading-none">{topThree[1].points}</div>
                          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-1">Points</div>
                       </div>
                       <div className="mt-4 text-sm font-medium text-slate-600">
                          <span className="text-slate-900 font-bold">{topThree[1].complaints_resolved}</span> Issues Resolved
                       </div>
                    </div>
                  </div>
                )}

                {/* 1st Place */}
                {topThree[0] && (
                  <div className="w-full sm:w-1/3 order-1 sm:order-2 flex flex-col items-center z-10">
                    <div className="relative bg-amber-50/50 border border-amber-200 shadow-md rounded-t-[32px] rounded-b-2xl p-6 pb-10 w-full text-center">
                       <div className="absolute -top-14 left-1/2 -translate-x-1/2">
                          <div className="relative">
                            <svg className="w-20 h-20 text-amber-400 drop-shadow-lg" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"/>
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center pb-3 text-white font-black text-2xl">1</span>
                          </div>
                       </div>
                       <div className="w-20 h-20 mx-auto bg-amber-100 rounded-full border-4 border-white shadow-md flex items-center justify-center mb-4 mt-2 relative">
                         <span className="text-amber-600 font-black text-2xl">{getInitials(topThree[0].user_name)}</span>
                         <div className="absolute -inset-3 border border-amber-200 rounded-full opacity-50"></div>
                         <div className="absolute -inset-6 border border-amber-100 rounded-full opacity-50"></div>
                       </div>
                       <h3 className="font-extrabold text-slate-900 text-xl line-clamp-1">{topThree[0].user_name}</h3>
                       <div className="mt-4 bg-white py-3 rounded-xl shadow-sm border border-amber-100">
                          <div className="font-black text-3xl text-amber-600 leading-none">{topThree[0].points}</div>
                          <div className="text-[10px] uppercase tracking-widest text-amber-500/80 font-bold mt-1.5">Points</div>
                       </div>
                       <div className="mt-5 text-sm font-semibold text-slate-700">
                          <span className="text-slate-900 font-extrabold">{topThree[0].complaints_resolved}</span> Issues Resolved
                       </div>
                    </div>
                  </div>
                )}

                {/* 3rd Place */}
                {topThree[2] && (
                  <div className="w-full sm:w-1/3 order-3 sm:order-3 flex flex-col items-center">
                    <div className="relative bg-orange-50/30 border border-orange-200/60 shadow-sm rounded-t-3xl rounded-b-xl p-6 pb-8 w-full text-center mt-12">
                       <div className="absolute -top-10 left-1/2 -translate-x-1/2">
                          <div className="relative">
                            <svg className="w-16 h-16 text-orange-400 drop-shadow-md" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"/>
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center pb-2 text-white font-bold text-lg">3</span>
                          </div>
                       </div>
                       <div className="w-16 h-16 mx-auto bg-orange-100 rounded-full border-4 border-white shadow-sm flex items-center justify-center mb-4 mt-2">
                         <span className="text-orange-600 font-bold text-xl">{getInitials(topThree[2].user_name)}</span>
                       </div>
                       <h3 className="font-bold text-slate-800 text-lg line-clamp-1">{topThree[2].user_name}</h3>
                       <div className="mt-3 bg-white py-2 rounded-xl shadow-xs border border-orange-50">
                          <div className="font-black text-2xl text-slate-700 leading-none">{topThree[2].points}</div>
                          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-1">Points</div>
                       </div>
                       <div className="mt-4 text-sm font-medium text-slate-600">
                          <span className="text-slate-900 font-bold">{topThree[2].complaints_resolved}</span> Issues Resolved
                       </div>
                    </div>
                  </div>
                )}
              </div>

              {/* TABLE */}
              {others.length > 0 && (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 rounded-tl-3xl text-center w-16">#</th>
                          <th className="px-6 py-4">Citizen</th>
                          <th className="px-6 py-4 text-right">Points</th>
                          <th className="px-6 py-4 text-center rounded-tr-3xl">Issues Resolved</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {others.map((u, i) => (
                          <tr key={u.user_id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-center font-bold text-slate-400">{i + 4}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold border border-slate-200 shrink-0">
                                  {getInitials(u.user_name)}
                                </div>
                                <span className="font-semibold text-slate-800">{u.user_name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-emerald-600">{u.points}</td>
                            <td className="px-6 py-4 text-center font-medium text-slate-600">{u.complaints_resolved}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: INFO CARDS */}
            <div className="w-full lg:w-80 shrink-0 space-y-6">

              {/* IMPACT CARD */}
              <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full opacity-50 pointer-events-none"></div>
                <div className="flex gap-4 items-start mb-4">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                     <TrendingUp className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg leading-tight">Real People.<br/>Real Impact.</h3>
                  </div>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Every resolved issue contributes to a cleaner, safer and greener Pune.
                </p>
              </div>

              {/* POINTS CARD */}
              <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm">
                <div className="flex items-center gap-3 mb-4 text-emerald-800">
                  <Trophy className="w-5 h-5" />
                  <h3 className="font-bold text-lg">Climb Higher!</h3>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Keep reporting issues and help build a better Pune. Each resolved issue earns you <strong className="text-emerald-700">50 points</strong>.
                </p>
              </div>

              {/* QUOTE CARD */}
              <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100/50 text-center relative overflow-hidden">
                <div className="text-4xl text-emerald-200 font-serif leading-none absolute top-4 left-4">"</div>
                <p className="italic font-medium text-slate-700 mb-4 mt-2 px-4 relative z-10">
                  Cleaner cities are built by active citizens.
                </p>
                <div className="text-xs font-bold text-emerald-800 uppercase tracking-widest flex items-center justify-center gap-2">
                  <span className="w-4 h-px bg-emerald-300"></span>
                  NagarMitra
                  <span className="w-4 h-px bg-emerald-300"></span>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </CitizenLayout>
  );
}
