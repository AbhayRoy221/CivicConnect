import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const { unreadCount } = useNotifications()
  const location = useLocation()
  
  const navItems = [
    { label: 'Dashboard', path: '/admin', roles: ['administrator'] },
    { label: 'Analytics', path: '/admin/analytics', roles: ['administrator', 'municipal_officer'] },
    { label: 'Queue', path: '/admin/queue', roles: ['administrator', 'municipal_officer'] },
    { label: 'Operations Map', path: '/admin/map', roles: ['administrator'] },
    { label: 'Users', path: '/admin/users', roles: ['administrator'] },
    { label: 'Audit Logs', path: '/admin/audit', roles: ['administrator'] },
  ]
  
  const isOfficer = user?.role === 'municipal_officer'
  
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0">
        <div className="p-6">
          <div className="flex justify-between items-center">
            <Link to="/" className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400">🌿</span> CivicConnect
            </Link>
            <Link to="/notifications" className="text-slate-400 hover:text-white relative" title="Notifications">
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
                  {unreadCount}
                </span>
              )}
            </Link>
          </div>
          <div className="mt-6 p-4 bg-slate-800 rounded-lg border border-slate-700">
            <div className="text-white font-bold text-sm truncate">{user?.name}</div>
            <div className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-wider">{user?.role.replace('_', ' ')}</div>
            {isOfficer && (
              <div className="mt-2 text-xs font-medium bg-slate-900/50 p-2 rounded border border-slate-700">
                <div className="text-indigo-400 font-bold mb-1">DEMO OFFICER</div>
                {user?.department_name || user?.ward_name ? (
                  <>
                    {user?.department_name && <div className="text-slate-300">Dept: {user.department_name}</div>}
                    {user?.ward_name && <div className="text-slate-300">Ward: {user.ward_name}</div>}
                  </>
                ) : (
                  <div className="text-amber-400">Manual / Demo Operations</div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-1">
          {navItems.filter(item => user && item.roles.includes(user.role)).map(item => {
            const active = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path))
            return (
              <Link 
                key={item.path} 
                to={item.path}
                className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        
        <div className="p-4 border-t border-slate-800 mt-auto">
          <button onClick={logout} className="w-full px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-left transition-colors">
            Log out
          </button>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
