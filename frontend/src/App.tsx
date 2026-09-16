/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider, Gate } from './context/AuthContext'
import { Nav } from './components/Nav'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { Report } from './pages/Report'
import { MyReports } from './pages/MyReports'
import { Detail } from './pages/Detail'
import { Dashboard } from './pages/Dashboard'
import { ComplaintsQueue } from './pages/ComplaintsQueue'
import { OperationsDetail } from './pages/OperationsDetail'
import { Users } from './pages/Users'
import { AuditLogs } from './pages/AuditLogs'
import { Leaderboard } from './pages/Leaderboard'
import { Confirmation } from './pages/Confirmation'
import { Notifications } from './pages/Notifications'

function AppContent() {
  const location = useLocation()
  const isDashboard = location.pathname.startsWith('/admin')

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-200 flex flex-col">
      {!isDashboard && <Nav />}
      <div className="flex-1 flex flex-col min-h-0">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Login register />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/report" element={<Gate role="citizen"><Report /></Gate>} />
          <Route path="/my-reports" element={<Gate role="citizen"><MyReports /></Gate>} />
          <Route path="/complaints/:id" element={<Gate role="citizen"><Detail /></Gate>} />
          <Route path="/complaints/:id/confirm" element={<Gate role="citizen"><Confirmation /></Gate>} />
          <Route path="/notifications" element={<Gate><Notifications /></Gate>} />
          
          {/* Operations Dashboard Routes */}
          <Route path="/admin" element={<Gate roles={['administrator', 'municipal_officer']}><Dashboard /></Gate>} />
          <Route path="/admin/queue" element={<Gate roles={['administrator', 'municipal_officer']}><ComplaintsQueue /></Gate>} />
          <Route path="/admin/complaints/:id" element={<Gate roles={['administrator', 'municipal_officer']}><OperationsDetail /></Gate>} />
          <Route path="/admin/users" element={<Gate role="administrator"><Users /></Gate>} />
          <Route path="/admin/audit" element={<Gate role="administrator"><AuditLogs /></Gate>} />
        </Routes>
      </div>
    </div>
  )
}

import { NotificationProvider } from './context/NotificationContext'

export function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AuthProvider>
  )
}
