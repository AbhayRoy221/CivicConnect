import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { DashboardLayout } from '../components/DashboardLayout'
import { MapFilters } from '../components/MapFilters'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'

interface TrendDataPoint {
  date: string
  submitted: number
  resolved: number
}

interface AnalyticsData {
  kpis: Record<string, number>
  trends: TrendDataPoint[]
  status_distribution: Record<string, number>
  severity_analysis: {
    citizen_reported: Record<string, number>
    system_assessed: Record<string, number>
    final_severity: Record<string, number>
  }
  ward_summary: {
    administrative_ward_name: string
    total_complaints: number
    open_complaints: number
    resolved_complaints: number
    in_progress_complaints: number
    overdue_complaints: number
  }[]
  department_workload: {
    department_name: string
    total: number
    open: number
    in_progress: number
    resolved: number
    overdue: number
    assigned: number
    unassigned: number
  }[]
  sla_analytics: Record<string, number>
  resolution_performance: {
    average_hours: number
    median_hours: number
  }
  escalation_insights: Record<string, number>
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ffc658']

export function AnalyticsDashboard() {
  const { token } = useAuth()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [status, setStatus] = useState('')
  const [severity, setSeverity] = useState('')
  const [category, setCategory] = useState('')
  const [ward, setWard] = useState('')
  const [department, setDepartment] = useState('')
  const [authority, setAuthority] = useState('')

  const [categories, setCategories] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [wards, setWards] = useState<any[]>([])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams()
      if (status !== '') q.append('status', status)
      if (severity !== '') q.append('severity', severity)
      if (category !== '') q.append('category_id', category)
      if (ward !== '') q.append('administrative_ward_name', ward)
      if (department !== '') q.append('department_id', department)
      if (authority !== '') q.append('authority', authority)

      const res = await api<AnalyticsData>(`/admin/analytics/detailed?${q.toString()}`, token)
      setData(res)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const loadMetadata = async () => {
    try {
      const [cats, depts, w] = await Promise.all([
        api<any[]>('/categories', token),
        api<any[]>('/departments', token),
        api<any[]>('/admin/ward-summary', token)
      ])
      setCategories(cats)
      setDepartments(depts)
      setWards(w)
    } catch (err) {
      console.error(err)
    }
  }

  const handleClearFilters = () => {
    setStatus('')
    setSeverity('')
    setCategory('')
    setWard('')
    setDepartment('')
    setAuthority('')
  }

  // Initial load
  useEffect(() => {
    loadMetadata()
  }, [])

  useEffect(() => {
    loadData()
  }, [status, severity, category, ward, department, authority])

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="bg-red-50 text-red-600 p-4 rounded border border-red-200">
            <h3 className="font-bold">Error</h3>
            <p>{error}</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const statusData = data ? Object.entries(data.status_distribution).map(([k, v]) => ({ name: k, value: v })) : []
  const slaData = data ? Object.entries(data.sla_analytics).filter(([k]) => !k.includes('resolved')).map(([k, v]) => ({ name: k.replace('_', ' '), value: v })) : []
  const sevData = data ? Object.entries(data.severity_analysis.final_severity).map(([k, v]) => ({ name: k, value: v })) : []

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full overflow-hidden">

        <div className="bg-white border-b border-gray-200 p-4 shrink-0 shadow-sm z-10 flex flex-wrap gap-2 items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Civic Intelligence</h1>
            <p className="text-sm text-gray-500">Analytics & SLA Dashboard</p>
          </div>
          <MapFilters
            status={status} setStatus={setStatus}
            severity={severity} setSeverity={setSeverity}
            category={category} setCategory={setCategory}
            ward={ward} setWard={setWard}
            department={department} setDepartment={setDepartment}
            authority={authority} setAuthority={setAuthority}
            onClear={handleClearFilters}
            categories={categories}
            departments={departments}
            wards={wards}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
            </div>
          ) : !data ? (
            <div className="text-center text-gray-500 mt-20">No data available</div>
          ) : (
            <div className="space-y-6 max-w-7xl mx-auto">

              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard title="Total Complaints" value={data.kpis.total_complaints} />
                <KPICard title="Open" value={data.kpis.open_complaints} color="text-amber-600" tooltip="Excludes resolved and rejected complaints" />
                <KPICard title="Resolved" value={data.kpis.resolved_complaints} color="text-emerald-600" />
                <KPICard title="Resolution Rate" value={`${data.kpis.resolution_rate.toFixed(1)}%`} />
                <KPICard title="In Progress" value={data.kpis.in_progress_complaints} color="text-blue-600" />
                <KPICard title="Rejected" value={data.kpis.rejected_complaints} color="text-gray-500" />
                <KPICard title="Escalated" value={data.kpis.escalated_complaints} color="text-red-600" />
                <KPICard title="SLA Compliance" value={`${data.kpis.sla_compliance_rate.toFixed(1)}%`} />
              </div>

              {/* Charts Row 1 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="font-semibold text-gray-700 mb-4">Complaint Trends</h3>
                  {data.trends.length === 0 ? (
                    <EmptyState />
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.trends} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" tick={{fontSize: 12}} />
                          <YAxis tick={{fontSize: 12}} />
                          <RechartsTooltip />
                          <Legend />
                          <Line type="monotone" dataKey="submitted" stroke="#8884d8" name="Submitted" />
                          <Line type="monotone" dataKey="resolved" stroke="#10b981" name="Resolved" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="font-semibold text-gray-700 mb-4">Status Distribution</h3>
                  {statusData.length === 0 ? <EmptyState /> : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={statusData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" tick={{fontSize: 12}} width={80} />
                          <RechartsTooltip />
                          <Bar dataKey="value" fill="#3b82f6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

              </div>

              {/* Charts Row 2 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center">
                  <h3 className="font-semibold text-gray-700 w-full mb-2">Final Severity</h3>
                  {sevData.length === 0 ? <EmptyState /> : (
                    <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={sevData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                            {sevData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                          </Pie>
                          <RechartsTooltip />
                          <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '12px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center">
                  <h3 className="font-semibold text-gray-700 w-full mb-2">SLA Status (Active)</h3>
                  {slaData.length === 0 ? <EmptyState /> : (
                    <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={slaData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={30} label>
                            {slaData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[(index+2) % COLORS.length]} />)}
                          </Pie>
                          <RechartsTooltip />
                          <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '12px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="font-semibold text-gray-700 mb-4">Performance Insights</h3>
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-3 rounded border border-slate-100">
                      <div className="text-xs text-gray-500 uppercase font-semibold">Avg Resolution Time</div>
                      <div className="text-xl font-bold">{data.resolution_performance.average_hours.toFixed(1)} hrs</div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded border border-slate-100">
                      <div className="text-xs text-gray-500 uppercase font-semibold">Median Res Time</div>
                      <div className="text-xl font-bold">{data.resolution_performance.median_hours.toFixed(1)} hrs</div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Tables */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-700">Ward Summary</h3>
                  </div>
                  <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="p-3 border-b">Ward</th>
                          <th className="p-3 border-b">Total</th>
                          <th className="p-3 border-b">Open</th>
                          <th className="p-3 border-b">Res</th>
                          <th className="p-3 border-b">Overdue</th>
                          <th className="p-3 border-b">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.ward_summary.length === 0 ? <tr><td colSpan={6}><EmptyState /></td></tr> : null}
                        {data.ward_summary.map((w, i) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-slate-50">
                            <td className="p-3 font-medium">{w.administrative_ward_name}</td>
                            <td className="p-3">{w.total_complaints}</td>
                            <td className="p-3 text-amber-600">{w.open_complaints}</td>
                            <td className="p-3 text-emerald-600">{w.resolved_complaints}</td>
                            <td className="p-3 text-red-500">{w.overdue_complaints}</td>
                            <td className="p-3">
                              <Link
                                to={`/admin/map?administrative_ward_name=${encodeURIComponent(w.administrative_ward_name)}`}
                                className="text-xs font-bold text-indigo-600 hover:underline"
                              >
                                View Map &rarr;
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-semibold text-gray-700">Department Workload</h3>
                  </div>
                  <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="p-3 border-b">Department</th>
                          <th className="p-3 border-b">Total</th>
                          <th className="p-3 border-b">Open</th>
                          <th className="p-3 border-b">Res</th>
                          <th className="p-3 border-b">Assign</th>
                          <th className="p-3 border-b">Unassign</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.department_workload.length === 0 ? <tr><td colSpan={6}><EmptyState /></td></tr> : null}
                        {data.department_workload.map((d, i) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-slate-50">
                            <td className="p-3 font-medium truncate max-w-[150px]" title={d.department_name}>{d.department_name}</td>
                            <td className="p-3">{d.total}</td>
                            <td className="p-3 text-amber-600">{d.open}</td>
                            <td className="p-3 text-emerald-600">{d.resolved}</td>
                            <td className="p-3 text-blue-600">{d.assigned}</td>
                            <td className="p-3 text-red-500">{d.unassigned}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>
      </div>
    </DashboardLayout>
  )
}

function KPICard({ title, value, color = "text-slate-800", tooltip }: { title: string, value: string | number, color?: string, tooltip?: string }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center relative">
      <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1 flex items-center gap-1">
        {title}
        {tooltip && (
          <div className="tooltip tooltip-right font-normal normal-case before:text-xs before:max-w-xs" data-tip={tooltip}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="w-3.5 h-3.5 stroke-current text-gray-400 cursor-help"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
        )}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  )
}

function EmptyState() {
  return <div className="text-sm text-gray-400 italic py-6 text-center">No data available</div>
}
