import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { api } from '../services/api';
import {
  LayoutDashboard,
  PlusCircle,
  FileText,
  BellRing,
  Award,
  LogOut,
  ShieldCheck,
  Search,
  Bell,
  ChevronDown
} from 'lucide-react';

interface CitizenLayoutProps {
  children: React.ReactNode;
}

export function CitizenLayout({ children }: CitizenLayoutProps) {
  const { user, token, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const location = useLocation();
  const [hasAdvisories, setHasAdvisories] = useState(false);

  useEffect(() => {
    if (!token) return;
    api<any[]>('/advisories?active_only=true', token).then((advRes) => {
      setHasAdvisories(advRes.length > 0);
    }).catch(err => {
      console.warn('Failed to load advisories for layout', err);
    });
  }, [token]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const NavItem = ({ to, icon: Icon, label, exact = false, badge = null, isAlert = false }: any) => {
    const isActive = exact ? location.pathname === to : location.pathname.startsWith(to);

    if (isActive) {
      return (
        <Link to={to} className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl bg-emerald-50 text-emerald-800 font-semibold text-sm transition shadow-sm border border-emerald-100/70">
          <Icon className="w-5 h-5 text-emerald-600" />
          <span>{label}</span>
          <span className="ml-auto w-1.5 h-4 bg-emerald-600 rounded-full"></span>
        </Link>
      );
    }

    return (
      <Link to={to} className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium text-sm transition group">
        <div className="w-5 h-5 flex items-center justify-center">
          <Icon className={`w-5 h-5 text-slate-400 ${isAlert ? 'group-hover:text-amber-500' : 'group-hover:text-emerald-600'} transition`} />
        </div>
        <span>{label}</span>

        {badge && (
          <span className="ml-auto text-[10px] uppercase tracking-wider font-bold bg-amber-100/90 text-amber-700 px-1.5 py-0.5 rounded-md">
            {badge}
          </span>
        )}

        {isAlert && (
          <span className="ml-auto flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="flex flex-1 w-full min-h-screen text-slate-800 antialiased bg-[#F6F9F8] font-['Plus_Jakarta_Sans',_sans-serif]">
      {/* 1. LEFT SIDEBAR */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200/80 flex-col justify-between shrink-0 fixed inset-y-0 left-0 z-30 shadow-[2px_0_12px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Sidebar Background Image */}
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none z-0"
          style={{
            backgroundImage: 'url(/assets/dashboard/citizen-dashboard-sidebar.png)',
            backgroundSize: '72% auto',
            backgroundPosition: 'left bottom',
            backgroundRepeat: 'no-repeat',
            opacity: 0.28
          }}
        ></div>
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-white/55 via-white/85 to-white z-0"></div>

        <div className="relative z-10 h-full flex flex-col justify-between">
          <div>
            {/* Brand Logo Header */}
            <div className="p-6 pb-5 flex items-center gap-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-amber-500 flex items-center justify-center shadow-md shadow-emerald-600/15 ring-2 ring-emerald-500/20 shrink-0">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                  <circle cx="12" cy="10" r="3" fill="#ffffff" fillOpacity="0.25"/>
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-lg text-slate-900 tracking-tight">NagarMitra</span>
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                </div>
                <p className="text-[11px] font-medium text-slate-500 leading-none mt-0.5">Smarter Civic Response</p>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="p-3.5 space-y-1.5">
              <NavItem to="/dashboard" exact label="Dashboard" icon={LayoutDashboard} />
              <NavItem to="/report" label="Report an Issue" badge="New" icon={PlusCircle} />
              <NavItem to="/my-reports" label="My Reports" icon={FileText} />
              <NavItem to="/civic-alerts" label="Civic Alerts" isAlert={hasAdvisories} icon={BellRing} />
              <NavItem to="/leaderboard" label="Leaderboard" icon={Award} />

              <div className="pt-4 mt-4 border-t border-slate-100">
                <p className="px-3.5 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Account</p>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-rose-600 font-medium text-sm transition group"
                >
                  <LogOut className="w-5 h-5 text-slate-400 group-hover:text-rose-600 transition" />
                  <span>Logout</span>
                </button>
              </div>
            </nav>
          </div>

          {/* Bottom sidebar mini badge */}
          {user?.ward_name && (
            <div className="p-4 m-3 bg-gradient-to-br from-emerald-50/90 to-teal-50/70 backdrop-blur-md rounded-2xl border border-emerald-100/60 flex items-center gap-3 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-white shadow-xs flex items-center justify-center text-emerald-700 shrink-0 border border-emerald-100">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">Verified Citizen</p>
                <p className="text-[10px] text-emerald-700 font-medium truncate">{user.ward_name}</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0 min-h-screen">

        {/* 2. TOP BAR */}
        <header className="h-16 shrink-0 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-40">
          {/* Mobile brand (shows when sidebar hidden) */}
          <div className="lg:hidden flex items-center gap-2">
             <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 via-teal-600 to-amber-500 flex items-center justify-center shadow-md">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                </svg>
             </div>
             <span className="font-extrabold text-sm text-slate-900 tracking-tight">NagarMitra</span>
          </div>

          {/* Search bar */}
          <div className="w-full max-w-md relative hidden md:block">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search your reports, issues or locations..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition placeholder:text-slate-400 text-slate-700"
            />
          </div>

          {/* Top Right Actions & Citizen Profile */}
          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <Link to="/notifications" className="w-9 h-9 rounded-xl text-slate-600 hover:bg-slate-100 flex items-center justify-center relative transition" title="Civic Notifications">
              <Bell className="w-4 h-4 text-slate-600" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white"></span>
              )}
            </Link>

            <div className="hidden sm:block h-6 w-px bg-slate-200"></div>

            {/* Citizen Profile Avatar Area */}
            <div className="flex items-center gap-3 cursor-pointer pl-1 pr-2 py-1 rounded-xl hover:bg-slate-50 transition">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-700 text-white font-semibold text-xs flex items-center justify-center shadow-xs ring-2 ring-white">
                {user ? getInitials(user.name) : 'US'}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-bold text-slate-800 leading-tight">{user?.name}</div>
                <div className="text-[11px] font-medium text-emerald-700 leading-tight capitalize">{user?.role.replace('_', ' ')}</div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            </div>
          </div>
        </header>

        {/* PAGE BODY */}
        <main className="flex-1 p-4 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
