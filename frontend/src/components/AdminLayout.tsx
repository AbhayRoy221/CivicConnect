import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import {
  Home,
  BarChart2,
  ListTodo,
  MapPin,
  Users,
  FileText,
  BellRing,
  LogOut,
  Bell,
  User as UserIcon
} from 'lucide-react'

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const { unreadCount } = useNotifications()
  const location = useLocation()

  const navItems = [
    { label: 'Dashboard', path: '/admin', roles: ['administrator', 'municipal_officer'], icon: Home, exact: true },
    { label: 'Analytics', path: '/admin/analytics', roles: ['administrator', 'municipal_officer'], icon: BarChart2 },
    { label: 'Queue', path: '/admin/queue', roles: ['administrator', 'municipal_officer'], icon: ListTodo },
    { label: 'Operations Map', path: '/admin/map', roles: ['administrator'], icon: MapPin },
    { label: 'Users', path: '/admin/users', roles: ['administrator'], icon: Users },
    { label: 'Audit Logs', path: '/admin/audit', roles: ['administrator'], icon: FileText },
    { label: 'Advisories', path: '/admin/advisories', roles: ['administrator', 'municipal_officer'], icon: BellRing },
  ]

  return (
    <div className="min-h-screen bg-[#F4F7F6] flex flex-col md:flex-row font-sans text-slate-800 antialiased selection:bg-emerald-200">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-[#1e293b] flex flex-col shrink-0 relative overflow-hidden shadow-xl z-20">

        {/* Sidebar Background Image */}
        <div
          className="absolute inset-x-0 bottom-0 h-2/3 pointer-events-none z-0"
          style={{
            backgroundImage: "url('/assets/admin/sidebar-bg.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center bottom',
            backgroundRepeat: 'no-repeat',
          }}
        ></div>

        {/* Gradient Overlay to fade the image into the navy background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1e293b] via-[#1e293b]/90 to-transparent z-0 pointer-events-none"></div>
        {/* Additional dark overlay to ensure text remains readable over the image */}
        <div className="absolute inset-0 bg-[#1e293b]/60 z-0 pointer-events-none"></div>

        <div className="relative z-10 flex flex-col h-full">
          {/* Brand Header */}
          <div className="pt-6 pb-2 px-6 flex items-start justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-gradient-to-tr from-emerald-500 to-green-500 flex items-center justify-center">
                <span className="text-white text-lg leading-none">🌿</span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[19px] text-white leading-none tracking-tight">NagarMitra</span>
                <span className="text-[7.5px] font-bold text-slate-300 uppercase tracking-widest mt-1">People • Cities • Change</span>
              </div>
            </Link>
            <div className="relative">
              <Bell className="w-4 h-4 text-amber-500" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full"></span>
              )}
            </div>
          </div>

          {/* User Profile */}
          <div className="px-4 py-4">
            <div className="px-4 py-3 bg-[#2d3748]/60 backdrop-blur-sm rounded-xl border border-slate-600/30 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0">
                <UserIcon className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-white font-semibold text-sm truncate">{user?.name}</div>
                <div className="text-[10px] text-slate-300 font-semibold uppercase tracking-wider truncate">
                  {user?.role.replace('_', ' ')}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 space-y-1 overflow-y-auto pb-4 mt-2">
            {navItems.filter(item => user && item.roles.includes(user.role)).map(item => {
              const active = item.exact
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);

              const Icon = item.icon;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                    active
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Footer Actions */}
          <div className="p-4 mt-auto">
            <button
              onClick={logout}
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-xl transition-colors group w-full"
            >
              <LogOut className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 z-30">
          <div className="flex items-center gap-2">
            <span className="text-emerald-600 text-xl leading-none">🌿</span>
            <span className="font-bold text-slate-900 tracking-tight">NagarMitra</span>
          </div>
          <Link to="/notifications" className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-50 text-slate-600 relative">
            <Bell className="w-5 h-5" />
          </Link>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
