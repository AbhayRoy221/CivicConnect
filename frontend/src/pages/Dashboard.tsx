/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { AdminLayout } from '../components/AdminLayout'
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Map as MapIcon,
  Building,
  Settings,
  MapPin,
  Layers,
  ChevronRight,
  Leaf
} from 'lucide-react'

// Static mappings for supported colors to prevent Tailwind purging
const COLOR_CLASSES: Record<string, { icon: string; hover: string }> = {
  blue: { icon: 'text-blue-600', hover: 'group-hover:text-blue-600' },
  teal: { icon: 'text-teal-600', hover: 'group-hover:text-teal-600' },
  emerald: { icon: 'text-emerald-600', hover: 'group-hover:text-emerald-600' },
  purple: { icon: 'text-purple-600', hover: 'group-hover:text-purple-600' },
}

export function Dashboard() {
  const { token, user } = useAuth()
  const [stats, setStats] = useState<any>(null)
  const [gisStatus, setGisStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const data = await api<any>('/admin/analytics', token)
      setStats(data)
    } catch (err: any) {
      console.error('Failed to load analytics:', err)
      setError(err?.message || 'Unable to load analytics at this time. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
    if (user?.role === 'administrator' && token) {
      api<any>('/admin/gis-sync-status', token).then(setGisStatus).catch(() => {})
    }
  }, [token, user])

  // Get current date string
  const today = new Date();
  const dateString = today.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const MetricCard = ({ title, value, icon: Icon, colorClass, bgClass, waveSvg }: any) => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden relative flex flex-col justify-between h-28">
      <div className="p-4 flex flex-col justify-between h-full relative z-10">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${bgClass} ${colorClass}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{title}</div>
        </div>
        <div className="text-3xl font-extrabold text-slate-800 ml-10">
          {value !== undefined && value !== null ? value.toLocaleString() : '-'}
        </div>
      </div>
      {/* Wave decoration */}
      <div className="absolute bottom-0 left-0 w-full z-0 opacity-20">
        {waveSvg}
      </div>
    </div>
  )

  const ListCard = ({ title, icon: Icon, data, colorKey }: { title: string, icon: any, data: Record<string, number>, colorKey: string }) => {
    if (!data || Object.keys(data).length === 0) return null;
    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const colors = COLOR_CLASSES[colorKey] || { icon: 'text-slate-600', hover: 'group-hover:text-slate-600' };

    return (
      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm flex flex-col h-full">
        <div className="flex justify-between items-center p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${colors.icon}`} />
            <h3 className="font-bold text-slate-800">{title}</h3>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>

        <div className="p-4 flex-1">
          <div className="space-y-4">
            {sorted.map(([label, count]) => {
              let RowIcon = MapPin;
              if (title.includes('Category')) {
                if (label.includes('Road') || label.includes('Pothole')) RowIcon = MapPin;
                else if (label.includes('Parking')) RowIcon = AlertTriangle;
                else if (label.includes('Garbage')) RowIcon = Layers;
              } else if (title.includes('Authority')) {
                RowIcon = Building;
              } else if (title.includes('Department')) {
                RowIcon = Settings;
              }

              return (
                <div key={label} className="flex justify-between items-center group border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <RowIcon className={`w-4 h-4 text-slate-400 ${colors.hover} transition-colors`} />
                    <span className="text-sm font-semibold text-slate-600 truncate max-w-[200px]">
                      {label.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-slate-900">{count.toLocaleString()}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Wave SVGs for KPI cards
  const blueWave = <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="w-full h-8 text-blue-500 fill-current"><path d="M0,10 C30,20 70,0 100,10 L100,20 L0,20 Z" /></svg>;
  const greenWave = <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="w-full h-8 text-emerald-500 fill-current"><path d="M0,0 C30,20 70,20 100,0 L100,20 L0,20 Z" /></svg>;
  const orangeWave = <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="w-full h-8 text-amber-500 fill-current"><path d="M0,10 C40,-5 60,-5 100,10 L100,20 L0,20 Z" /></svg>;
  const redWave = <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="w-full h-8 text-rose-500 fill-current"><path d="M0,15 C20,0 80,0 100,15 L100,20 L0,20 Z" /></svg>;

  return (
    <AdminLayout>
      <div className="p-4 md:p-8 max-w-[1400px] mx-auto w-full">

        {/* Header Banner */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 md:p-8 mb-6 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="absolute inset-y-0 right-0 w-2/3 pointer-events-none opacity-40 z-0"
               style={{ backgroundImage: "url('/assets/dashboard/citizen-dashboard-hero.png')", backgroundSize: 'cover', backgroundPosition: 'center', WebkitMaskImage: 'linear-gradient(to right, transparent, black)' }}>
          </div>

          <div className="relative z-10 max-w-xl">
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              Operations <span className="text-emerald-600">Dashboard</span>
            </h1>
            <p className="text-sm text-slate-600 mt-2 font-medium">
              Monitor, manage and resolve civic issues for a cleaner, safer, better city
            </p>
          </div>

          <div className="relative z-10 flex flex-col items-end gap-3">
            <div className="flex items-center gap-2 text-slate-600 text-sm font-semibold bg-white/80 backdrop-blur-sm px-4 py-2 rounded-lg shadow-sm border border-slate-100">
              <FileText className="w-4 h-4 text-slate-400" />
              <div>
                <div>{dateString}</div>
                <div className="text-[10px] text-emerald-600">Keep our city clean and thriving <span className="inline-block translate-y-[1px]">🍃</span></div>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-sm border border-emerald-100 shadow-sm rounded-lg px-4 py-2 flex items-center gap-3">
              <Leaf className="w-5 h-5 text-emerald-500" />
              <div className="text-xs font-bold text-emerald-800 leading-tight">
                Better Administration<br/>Brighter Tomorrows
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-4">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div>
            <p className="text-sm font-medium animate-pulse">Loading operational metrics...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-700 p-8 rounded-2xl text-center border border-red-100 max-w-xl mx-auto my-12">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-60 text-red-600" />
            <h3 className="text-lg font-bold mb-1">Failed to load analytics</h3>
            <p className="text-sm text-red-600 mb-6">{error}</p>
            <button
              onClick={fetchAnalytics}
              className="px-6 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition shadow-xs"
            >
              Retry
            </button>
          </div>
        ) : stats ? (
          <div className="space-y-6 animate-in fade-in duration-500">

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <MetricCard
                title="Total"
                value={stats.complaints_total}
                icon={FileText}
                colorClass="text-blue-600"
                bgClass="bg-blue-50"
                waveSvg={blueWave}
              />
              <MetricCard
                title="Submitted"
                value={stats.by_status?.submitted}
                icon={MapPin}
                colorClass="text-emerald-600"
                bgClass="bg-emerald-50"
                waveSvg={greenWave}
              />
              <MetricCard
                title="In Progress"
                value={stats.by_status?.in_progress}
                icon={Clock}
                colorClass="text-amber-500"
                bgClass="bg-amber-50"
                waveSvg={orangeWave}
              />
              <MetricCard
                title="Resolved"
                value={stats.by_status?.resolved}
                icon={CheckCircle2}
                colorClass="text-emerald-500"
                bgClass="bg-emerald-50"
                waveSvg={greenWave}
              />
              <MetricCard
                title="Disputed"
                value={stats.disputed}
                icon={AlertTriangle}
                colorClass="text-rose-500"
                bgClass="bg-rose-50"
                waveSvg={redWave}
              />
            </div>

            {/* Data Breakdowns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ListCard
                title="By Category"
                icon={Layers}
                data={stats.by_category}
                colorKey="blue"
              />

              <ListCard
                title="By Authority"
                icon={Building}
                data={stats.by_authority}
                colorKey="teal"
              />

              {user?.role === 'administrator' && (
                <>
                  <ListCard
                    title="By Department"
                    icon={Settings}
                    data={stats.by_department}
                    colorKey="emerald"
                  />
                  <ListCard
                    title="By Administrative Ward"
                    icon={MapPin}
                    data={stats.by_admin_ward}
                    colorKey="purple"
                  />
                </>
              )}
            </div>

            {/* GIS Synchronization Status Panel */}
            {user?.role === 'administrator' && gisStatus && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MapIcon className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-extrabold text-slate-800 text-lg">GIS Synchronization Status</h3>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-slate-500 w-40 shrink-0">Current Refresh Status:</span>
                      <span className={`font-semibold ${gisStatus.status?.toLowerCase().includes('unavailable') ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {gisStatus.status}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-slate-500 w-40 shrink-0">Geographic Wards:</span>
                      <span className="font-bold text-slate-900">{gisStatus.pune_wards_count} verified records</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-slate-500 w-40 shrink-0">Administrative Ward Offices:</span>
                      <span className="font-bold text-slate-900">{gisStatus.administrative_ward_offices_count} verified records</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        ) : null}
      </div>
    </AdminLayout>
  )
}
