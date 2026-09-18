import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CivicAlerts from '../components/CivicAlerts'

export function Home() {
  const { user } = useAuth()
  const [scale, setScale] = useState(1)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      const height = window.innerHeight

      if (width < 1024) {
        setIsMobile(true)
        setScale(1)
      } else {
        setIsMobile(false)
        const scaleX = width / 1536
        // Full bleed: use scaleX directly to fill width.
        setScale(scaleX)
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (isMobile) {
    return (
      <div className="relative min-h-screen w-full bg-slate-900 font-sans text-slate-900 flex flex-col pb-8">
        <div className="absolute inset-0 z-0 h-screen">
          <img src="/assets/home/nagarmitra-india-bg.png" alt="NagarMitra India Background" className="w-full h-full object-cover opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-transparent to-white/90"></div>
        </div>
        <div className="relative z-10 flex flex-col w-full p-4 space-y-6">
          <header className="flex items-center justify-between backdrop-blur-md bg-white/70 rounded-2xl px-4 py-3 shadow-sm border border-white/40">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-600 p-1.5 rounded-lg">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 24C14 16 20 10 28 10C36 10 38 18 38 24C38 32 30 38 22 38" stroke="#138808" strokeLinecap="round" strokeWidth="4.5"></path>
                  <path d="M12 28C8 22 10 14 16 10C22 6 28 8 32 12" stroke="#FF7900" strokeLinecap="round" strokeWidth="4.5"></path>
                  <circle cx="24" cy="24" fill="#0A5C36" r="5"></circle>
                  <path d="M24 8V14M24 34V40M8 24H14M34 24H40" stroke="#0284C7" strokeLinecap="round" strokeWidth="2.5"></path>
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg leading-tight text-slate-800">NagarMitra</span>
                <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold leading-none">Smarter Civic Response</span>
              </div>
            </div>
          </header>
          
          <div className="flex flex-col justify-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-sm w-fit">
              <span className="w-4 h-2.5 flex flex-col justify-between overflow-hidden rounded-[2px] border border-slate-300 shadow-sm">
                <span className="h-1 bg-[#FF9933] w-full"></span>
                <span className="h-0.5 bg-white w-full flex items-center justify-center"><span className="w-0.5 h-0.5 rounded-full bg-blue-800 inline-block"></span></span>
                <span className="h-1 bg-[#138808] w-full"></span>
              </span>
              <span className="text-[12px] font-semibold text-slate-700 tracking-tight">Safer Cities. Stronger Communities. A Cleaner India.</span>
            </div>

            <h1 className="text-4xl font-extrabold text-slate-900 leading-[1.1] tracking-tight drop-shadow-sm">
              A Cleaner,<br/>
              Safer, Stronger<br/>
              <span className="text-[#E66A1F]">India</span> <span className="text-[#0E7C4B]">Together</span>
            </h1>

            <p className="text-sm text-slate-700 font-medium drop-shadow-sm leading-relaxed">
              Report civic issues, track progress, stay informed, and help build cleaner, safer and smarter communities with NagarMitra.
            </p>

            <Link to="/report" className="flex items-center justify-center gap-2.5 bg-[#0B6737] hover:bg-[#09532c] text-white font-bold text-lg px-6 py-3 rounded-xl shadow-lg transition">
                <span>Report an Issue</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
            </Link>
          </div>

          <CivicAlerts />

          <div className="flex flex-col gap-3">
             <div className="bg-white/90 backdrop-blur-md rounded-2xl px-3.5 py-2.5 shadow-md border border-white/80 flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-900 leading-tight">Citizen Reports</span>
                  <span className="text-[10px] font-semibold text-slate-500 leading-none">Report a civic issue</span>
                </div>
              </div>
              <div className="bg-white/90 backdrop-blur-md rounded-2xl px-3.5 py-2.5 shadow-md border border-white/80 flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-900 leading-tight">AI + Location</span>
                  <span className="text-[10px] font-semibold text-slate-500 leading-none">Understand & locate</span>
                </div>
              </div>
              <div className="bg-white/90 backdrop-blur-md rounded-2xl px-3.5 py-2.5 shadow-md border border-white/80 flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-900 leading-tight">Right Department</span>
                  <span className="text-[10px] font-semibold text-slate-500 leading-none">Route to the right team</span>
                </div>
              </div>
          </div>
          
          <div className="grid grid-cols-1 gap-4 pt-4">
            <Link to="/report" className="bg-white/88 backdrop-blur-md p-4 rounded-2xl border border-white/80 shadow-md flex items-center justify-between group">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100/90 text-emerald-700 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeLinecap="round" strokeLinejoin="round"></path>
                    <circle cx="12" cy="13" r="3"></circle>
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Report Easily</h3>
                  <p className="text-[11px] text-slate-500 leading-snug">Upload a photo, add details, locate the issue.</p>
                </div>
              </div>
            </Link>
            <Link to={user?.role === 'citizen' ? '/my-reports' : (user ? '/admin' : '/login')} className="bg-white/88 backdrop-blur-md p-4 rounded-2xl border border-white/80 shadow-md flex items-center justify-between group">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100/90 text-emerald-700 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Track in Real-Time</h3>
                  <p className="text-[11px] text-slate-500 leading-snug">See updates and resolution progress.</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="w-full overflow-hidden bg-[#f8fafc] flex justify-center font-[Plus Jakarta Sans]"
      style={{ height: 1024 * scale }}
    >
      <div 
        className="relative origin-top flex justify-center"
        style={{ transform: `scale(${scale})`, width: 1536, height: 1024 }}
      >
        <div className="relative w-[1536px] h-[1024px] bg-slate-950 overflow-hidden shadow-2xl">
          {/* Layer 0: Background Layer */}
          <img 
            src="/assets/home/nagarmitra-india-bg.png" 
            alt="NagarMitra India Background" 
            className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
          />

          {/* Layer 30: Top Navbar */}
          <header className="absolute top-0 left-0 w-full h-[76px] z-30 px-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center">
                <svg className="w-9 h-9" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 24C14 16 20 10 28 10C36 10 38 18 38 24C38 32 30 38 22 38" stroke="#138808" strokeLinecap="round" strokeWidth="4.5"></path>
                  <path d="M12 28C8 22 10 14 16 10C22 6 28 8 32 12" stroke="#FF7900" strokeLinecap="round" strokeWidth="4.5"></path>
                  <circle cx="24" cy="24" fill="#0A5C36" r="5"></circle>
                  <path d="M24 8V14M24 34V40M8 24H14M34 24H40" stroke="#0284C7" strokeLinecap="round" strokeWidth="2.5"></path>
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight leading-none">NagarMitra</span>
                <span className="text-[11px] font-semibold text-slate-600 tracking-normal mt-0.5">Smarter Civic Response</span>
              </div>
            </div>
            
            <nav className="flex items-center gap-8 ml-8">
              <Link to="/" className="relative text-[15px] font-bold text-slate-900 pb-1">
                Home
                <span className="absolute bottom-[-4px] left-0 w-full h-[2.5px] bg-[#0E7C4B] rounded-full"></span>
              </Link>
              <Link to="/report" className="text-[15px] font-medium text-slate-700 hover:text-emerald-800 transition">Report</Link>
              {user?.role === 'citizen' && <Link to="/my-reports" className="text-[15px] font-medium text-slate-700 hover:text-emerald-800 transition">Track</Link>}
              <Link to="/civic-alerts" className="text-[15px] font-medium text-slate-700 hover:text-emerald-800 transition">Civic Alerts</Link>
              <span className="text-[15px] font-medium text-slate-700 cursor-not-allowed">About</span>
            </nav>
            
            <div className="flex items-center gap-3.5">
              <div className="relative w-64">
                <input 
                  type="text" 
                  placeholder="Search issues, cities or locations..." 
                  className="w-full bg-white/90 text-xs pl-8 pr-3 py-2 rounded-lg border border-slate-200/90 shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-600 text-slate-700 placeholder-slate-400" 
                />
                <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2"></path>
                </svg>
              </div>
              
              {!user ? (
                <>
                  <Link to="/login" className="bg-white/95 hover:bg-white text-slate-800 text-xs font-bold px-4 py-2 rounded-lg border border-slate-200 shadow-sm transition">Login</Link>
                  <Link to="/register" className="bg-[#0B6737] hover:bg-[#09532c] text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition">Sign Up</Link>
                </>
              ) : (
                <Link to={user.role === 'citizen' ? '/my-reports' : '/admin'} className="bg-[#0B6737] hover:bg-[#09532c] text-white text-xs font-bold px-4 py-2 rounded-lg border border-slate-200 shadow-sm transition">
                  Dashboard
                </Link>
              )}
              <button className="flex items-center gap-1.5 bg-slate-200/75 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300/60 transition">
                <span>EN</span>
                <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
                </svg>
              </button>
            </div>
          </header>

          {/* Layer 20: Left Hero Content */}
          <section aria-label="Hero Introduction" className="absolute top-[106px] left-[40px] w-[490px] z-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-sm mb-4">
              <span className="w-4 h-2.5 flex flex-col justify-between overflow-hidden rounded-[2px] border border-slate-300 shadow-sm">
                <span className="h-1 bg-[#FF9933] w-full"></span>
                <span className="h-0.5 bg-white w-full flex items-center justify-center"><span className="w-0.5 h-0.5 rounded-full bg-blue-800 inline-block"></span></span>
                <span className="h-1 bg-[#138808] w-full"></span>
              </span>
              <span className="text-[12px] font-semibold text-slate-700 tracking-tight">Safer Cities. Stronger Communities. A Cleaner India.</span>
            </div>
            
            <h1 className="text-[58px] font-black leading-[1.04] tracking-tight text-slate-900 mb-4">
              A Cleaner,<br/>
              Safer, Stronger<br/>
              <span className="text-[#E66A1F]">India</span> <span className="text-[#0E7C4B]">Together</span>
            </h1>
            
            <p className="text-[15px] font-medium text-slate-700 leading-relaxed max-w-[430px] mb-6">
              Report civic issues, track progress, and be part of a smarter, cleaner and more livable India.
            </p>
            
            <div className="flex items-center gap-3.5 mb-7">
              <Link to="/report" className="flex items-center gap-2.5 bg-[#0B6737] hover:bg-[#09532c] text-white font-bold text-sm px-6 py-3 rounded-lg shadow-md hover:shadow-lg transition">
                <span>Report an Issue</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              </Link>
            </div>
            
            {/* Capability Strip replacing Fake Stats */}
            <div className="bg-white/88 backdrop-blur-[12px] rounded-xl px-4 py-2.5 flex items-center justify-between shadow-sm border border-white/80 max-w-[460px]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-emerald-100/90 text-emerald-700 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div>
                  <div className="text-[13px] font-black text-slate-900 leading-tight">AI-Assisted</div>
                  <div className="text-[10px] text-slate-500 font-semibold leading-none">Reporting</div>
                </div>
              </div>
              <div className="w-[1px] h-6 bg-slate-200"></div>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-emerald-100/90 text-emerald-700 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <div>
                  <div className="text-[13px] font-black text-slate-900 leading-tight">GIS-Powered</div>
                  <div className="text-[10px] text-slate-500 font-semibold leading-none">Location</div>
                </div>
              </div>
              <div className="w-[1px] h-6 bg-slate-200"></div>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-emerald-100/90 text-emerald-700 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <div>
                  <div className="text-[13px] font-black text-slate-900 leading-tight">Smart</div>
                  <div className="text-[10px] text-slate-500 font-semibold leading-none">Prioritization</div>
                </div>
              </div>
              <div className="w-[1px] h-6 bg-slate-200"></div>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-emerald-100/90 text-emerald-700 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <div>
                  <div className="text-[13px] font-black text-slate-900 leading-tight">Real-Time</div>
                  <div className="text-[10px] text-slate-500 font-semibold leading-none">Tracking</div>
                </div>
              </div>
            </div>

            <div className="mt-8 relative -rotate-3 select-none">
              <p className="font-[Caveat] text-2xl font-bold text-slate-800 leading-tight tracking-wide drop-shadow-xs">
                Currently serving Pune<br/>
                Built to scale across India
              </p>
              <div className="w-36 h-1.5 mt-1 rounded-full bg-gradient-to-r from-[#FF9933] via-white to-[#138808] shadow-sm"></div>
            </div>
          </section>

          {/* Layer 20: Map Floating Callouts */}
          {/* Delhi Pin */}
          <div className="absolute top-[118px] left-[770px] z-20 flex items-center gap-2.5 bg-white/94 backdrop-blur-[8px] px-2 py-1.5 rounded-xl shadow-[0_8px_20px_-4px_rgba(0,0,0,0.15)] border border-white/90">
            <div className="w-10 h-9 rounded-lg overflow-hidden bg-slate-200 relative shrink-0">
              <img src="/assets/home/issues/pothole.jpg" alt="Pothole" className="w-full h-full object-cover" />
            </div>
            <div className="pr-2">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block ring-2 ring-rose-200"></span>
                <span className="text-[11px] font-black text-slate-900 leading-none">Pothole</span>
              </div>
              <div className="text-[9px] font-bold text-slate-500 mt-0.5">Delhi</div>
            </div>
          </div>
          
          {/* Indore Pin */}
          <div className="absolute top-[220px] left-[665px] z-20 flex items-center gap-2.5 bg-white/94 backdrop-blur-[8px] px-2 py-1.5 rounded-xl shadow-[0_8px_20px_-4px_rgba(0,0,0,0.15)] border border-white/90">
            <div className="w-10 h-9 rounded-lg overflow-hidden bg-slate-200 relative shrink-0">
              <img src="/assets/home/issues/garbage-overflow.jpg" alt="Garbage Overflow" className="w-full h-full object-cover" />
            </div>
            <div className="pr-2">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block ring-2 ring-emerald-200"></span>
                <span className="text-[11px] font-black text-slate-900 leading-none">Garbage Overflow</span>
              </div>
              <div className="text-[9px] font-bold text-slate-500 mt-0.5">Indore</div>
            </div>
          </div>
          
          {/* Guwahati Pin */}
          <div className="absolute top-[228px] left-[1020px] z-20 flex items-center gap-2.5 bg-white/94 backdrop-blur-[8px] px-2 py-1.5 rounded-xl shadow-[0_8px_20px_-4px_rgba(0,0,0,0.15)] border border-white/90">
            <div className="w-10 h-9 rounded-lg overflow-hidden bg-slate-200 relative shrink-0">
              <img src="/assets/home/issues/water-leakage.jpg" alt="Water Leakage" className="w-full h-full object-cover" />
            </div>
            <div className="pr-2">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-600 inline-block ring-2 ring-blue-200"></span>
                <span className="text-[11px] font-black text-slate-900 leading-none">Water Leakage</span>
              </div>
              <div className="text-[9px] font-bold text-slate-500 mt-0.5">Guwahati</div>
            </div>
          </div>
          
          {/* Bengaluru Pin */}
          <div className="absolute top-[345px] left-[820px] z-20 flex items-center gap-2.5 bg-white/94 backdrop-blur-[8px] px-2 py-1.5 rounded-xl shadow-[0_8px_20px_-4px_rgba(0,0,0,0.15)] border border-white/90">
            <div className="w-10 h-9 rounded-lg overflow-hidden bg-slate-200 relative shrink-0">
              <img src="/assets/home/issues/broken-streetlight.jpg" alt="Broken Streetlight" className="w-full h-full object-cover" />
            </div>
            <div className="pr-2">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block ring-2 ring-amber-200"></span>
                <span className="text-[11px] font-black text-slate-900 leading-none">Broken Streetlight</span>
              </div>
              <div className="text-[9px] font-bold text-slate-500 mt-0.5">Bengaluru</div>
            </div>
          </div>

          <div className="absolute top-[96px] left-[1115px] z-20 -rotate-12 select-none">
            <p className="font-[Caveat] text-[32px] font-bold text-slate-800 leading-[0.95] drop-shadow-sm tracking-wide">
              Stronger<br/>Cities<br/>Brighter<br/>India
            </p>
          </div>
          
          <div className="absolute top-[620px] left-[1075px] z-20 bg-[#0B5E38] text-white px-3.5 py-2 rounded-lg border-2 border-white shadow-xl flex items-center gap-2">
            <div className="text-left font-bold text-[10px] tracking-wider leading-tight">
              <div>CLEANER</div>
              <div>SAFER</div>
              <div>STRONGER</div>
              <div className="text-xs font-black tracking-widest text-emerald-100">INDIA</div>
            </div>
            <div className="text-emerald-200 ml-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"></path></svg>
            </div>
          </div>

          {/* Layer 35: Right Floating Sidebar (Intelligence Column) */}
          <aside className="absolute top-[128px] right-[48px] z-35 flex flex-col gap-3.5">
            <div className="bg-white/88 backdrop-blur-[12px] shadow-sm border border-white/80 rounded-2xl px-3.5 py-2.5 flex items-center gap-3.5 w-44 hover:shadow-md transition">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" strokeLinecap="round" strokeLinejoin="round"></path></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black text-slate-900 leading-tight">Citizen Reports</span>
                <span className="text-[10px] font-semibold text-slate-500 leading-none">Report an issue</span>
              </div>
            </div>
            <div className="bg-white/88 backdrop-blur-[12px] shadow-sm border border-white/80 rounded-2xl px-3.5 py-2.5 flex items-center gap-3.5 w-44 hover:shadow-md transition">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round"></path><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round"></path></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black text-slate-900 leading-tight">AI + Location</span>
                <span className="text-[10px] font-semibold text-slate-500 leading-none">Understand & locate</span>
              </div>
            </div>
            <div className="bg-white/88 backdrop-blur-[12px] shadow-sm border border-white/80 rounded-2xl px-3.5 py-2.5 flex items-center gap-3.5 w-44 hover:shadow-md transition">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black text-slate-900 leading-tight">Right Department</span>
                <span className="text-[10px] font-semibold text-slate-500 leading-none">Route to the right team</span>
              </div>
            </div>
            <div className="bg-white/88 backdrop-blur-[12px] shadow-sm border border-white/80 rounded-2xl px-3.5 py-2.5 flex items-center gap-3.5 w-44 hover:shadow-md transition">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" strokeLinecap="round" strokeLinejoin="round"></path></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black text-slate-900 leading-tight">Civic Response</span>
                <span className="text-[10px] font-semibold text-slate-500 leading-none">Track real progress</span>
              </div>
            </div>
          </aside>

          {/* Layer 40: Civic Alerts */}
          <div className="absolute top-[440px] right-[48px] w-[340px] z-40">
            <CivicAlerts />
          </div>

          {/* Layer 45: Lower Action Cards Row */}
          <section className="absolute bottom-[180px] left-0 w-full px-[64px] z-45">
            <div className="grid grid-cols-4 gap-5">
              <Link to="/report" className="bg-white/88 backdrop-blur-[12px] shadow-sm border border-white/80 rounded-2xl p-4 flex items-center justify-between hover:bg-white/95 transition group">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100/90 text-emerald-700 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeLinecap="round" strokeLinejoin="round"></path>
                      <circle cx="12" cy="13" r="3"></circle>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Report Easily</h3>
                    <p className="text-[11px] text-slate-500 leading-snug">Upload a photo, add details, locate the issue.</p>
                  </div>
                </div>
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-emerald-600 group-hover:text-white transition">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                </div>
              </Link>
              
              <Link to={user?.role === 'citizen' ? '/my-reports' : (user ? '/admin' : '/login')} className="bg-white/88 backdrop-blur-[12px] shadow-sm border border-white/80 rounded-2xl p-4 flex items-center justify-between hover:bg-white/95 transition group">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100/90 text-emerald-700 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round"></path>
                      <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Track in Real-Time</h3>
                    <p className="text-[11px] text-slate-500 leading-snug">See updates and resolution progress.</p>
                  </div>
                </div>
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-emerald-600 group-hover:text-white transition">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                </div>
              </Link>

              <Link to="/civic-alerts" className="bg-white/88 backdrop-blur-[12px] shadow-sm border border-white/80 rounded-2xl p-4 flex items-center justify-between hover:bg-white/95 transition group">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100/90 text-amber-700 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Get Civic Alerts</h3>
                    <p className="text-[11px] text-slate-500 leading-snug">Stay informed about important notices in your area.</p>
                  </div>
                </div>
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-amber-600 group-hover:text-white transition">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                </div>
              </Link>

              <Link to="/leaderboard" className="bg-white/88 backdrop-blur-[12px] shadow-sm border border-white/80 rounded-2xl p-4 flex items-center justify-between hover:bg-white/95 transition group">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100/90 text-emerald-700 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Be the Change</h3>
                    <p className="text-[11px] text-slate-500 leading-snug">Join millions of citizens building a better India.</p>
                  </div>
                </div>
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-emerald-600 group-hover:text-white transition">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                </div>
              </Link>
            </div>
          </section>

          {/* Layer 50: Bottom Motto Footer */}
          <div className="absolute bottom-[90px] left-1/2 -translate-x-1/2 z-50 flex flex-col items-center select-none pointer-events-none">
            <span className="text-xs font-extrabold tracking-[0.22em] text-slate-800 uppercase">
              CITIZENS TODAY. A BETTER TOMORROW.
            </span>
            <div className="w-24 h-1 mt-1.5 rounded-full bg-gradient-to-r from-[#FF9933] via-white to-[#138808] shadow-sm"></div>
          </div>
          
          <div className="absolute bottom-[56px] right-[48px] z-50 flex flex-col items-start select-none -rotate-2">
            <p className="font-[Caveat] text-xl font-black text-slate-800 leading-tight drop-shadow-sm">
              Ek Saaf<br/>Ek Surakshit<br/>Ek Samruddh<br/>Bharat
            </p>
            <div className="w-28 h-1.5 mt-1 rounded-full bg-gradient-to-r from-[#FF9933] via-white to-[#138808] shadow-sm"></div>
          </div>
          
        </div>
      </div>
    </div>
  )
}
