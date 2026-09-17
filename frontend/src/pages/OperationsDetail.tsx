/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { DashboardLayout } from '../components/DashboardLayout'
import type { Complaint } from '../types'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'

function MapResizer({ pos }: { pos: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize()
      if (pos) map.setView(pos, map.getZoom(), { animate: true })
    }, 100)
    return () => clearTimeout(timer)
  }, [map, pos])
  return null
}

export function OperationsDetail() {
  const { id } = useParams()
  const { token, user } = useAuth()
  const [c, setC] = useState<Complaint | null>(null)
  const [relatedReports, setRelatedReports] = useState<any[]>([])

  const [departments, setDepartments] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [remarks, setRemarks] = useState('')
  const [assignDeptId, setAssignDeptId] = useState('')
  const [assignOfficerId, setAssignOfficerId] = useState('')
  const [assignSeverity, setAssignSeverity] = useState('')

  useEffect(() => {
    load()
    api<any[]>('/departments').then(setDepartments).catch(() => {})
    if (user?.role === 'administrator' || user?.role === 'municipal_officer') {
      api<any[]>('/admin/users', token).then(setUsers).catch(() => {})
    }
  }, [id, token])

  async function load() {
    try {
      const res = await api<Complaint>(`/complaints/${id}`, token)
      setC(res)
      setAssignDeptId(res.department_id || '')
      setAssignOfficerId(res.officer_id || '')
      setAssignSeverity(res.severity || '')

      try {
        const rel = await api<any[]>(`/complaints/${id}/related`, token)
        setRelatedReports(rel)
      } catch (err) { console.warn("Failed to load related reports") }

    } catch (e: any) { alert(e.message) }
  }

  async function updateStatus(status: string, reason?: string) {
    try {
      await api(`/complaints/${c?.public_id}/status`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status, remarks: reason || undefined })
      })
      load()
    } catch (e: any) { alert(e.message) }
  }

  async function updateSeverity(e: React.FormEvent) {
    e.preventDefault()
    try {
      const reason = window.prompt("Reason for severity change:")
      if (reason === null) return // Cancelled
      await api(`/complaints/${c?.public_id}/severity`, token, {
        method: 'PATCH',
        body: JSON.stringify({ severity: assignSeverity, remarks: reason || undefined })
      })
      load()
    } catch (e: any) { alert(e.message) }
  }

  async function updatePriorityOverride(override: number | null) {
    try {
      const reason = override !== null ? window.prompt("Reason for priority override:") : "Cleared by admin";
      if (reason === null) return;
      await api(`/complaints/${c?.public_id}/priority`, token, {
        method: 'PATCH',
        body: JSON.stringify({ override_score: override, remarks: reason })
      })
      load()
    } catch (e: any) { alert(e.message) }
  }

  async function assign(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api(`/complaints/${c?.public_id}/assignment`, token, {
        method: 'PATCH',
        body: JSON.stringify({
          department_id: assignDeptId || null,
          officer_id: assignOfficerId || null
        })
      })
      load()
      window.dispatchEvent(new Event('notifications_updated'))
    } catch (e: any) { alert(e.message) }
  }

  async function resolve(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return alert('Resolution evidence required')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('remarks', remarks)
    try {
      await api(`/complaints/${c?.public_id}/resolution`, token, { method: 'POST', body: fd })
      await updateStatus('resolved', remarks)
      setFile(null)
      setRemarks('')
      window.dispatchEvent(new Event('notifications_updated'))
    } catch (err: any) { alert(err.message) }
  }

  if (!c) return <DashboardLayout><div className="p-8 text-center text-slate-500 animate-pulse">Loading...</div></DashboardLayout>

  const pos: [number, number] | null = c.latitude && c.longitude ? [c.latitude, c.longitude] : null
  const isAdmin = user?.role === 'administrator'
  const isOfficer = user?.role === 'municipal_officer'

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link to="/admin/queue" className="text-sm font-bold text-indigo-600 hover:underline mb-2 inline-block">← Back to Queue</Link>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            {c.public_id}
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
              c.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' :
              c.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
              c.status === 'rejected' ? 'bg-red-100 text-red-700' :
              'bg-slate-200 text-slate-700'
            }`}>
              {c.is_escalated ? 'ESCALATED' : c.status.replace('_', ' ')}
            </span>
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Complaint Details</h2>
            </div>
            <div className="p-5 flex flex-col gap-6">
              {c.image_url && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">Before (Original)</div>
                    <a href={`http://localhost:8000${c.image_url}`} target="_blank" rel="noreferrer">
                      <img src={`http://localhost:8000${c.image_url}`} alt="Evidence" className="w-full aspect-square object-cover rounded-xl border border-slate-200 hover:opacity-90 transition-opacity" />
                    </a>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2 text-center">After (Resolution)</div>
                    {c.resolution_evidence ? (
                      <div>
                        <a href={`http://localhost:8000${c.resolution_evidence.image_url}`} target="_blank" rel="noreferrer">
                          <img src={`http://localhost:8000${c.resolution_evidence.image_url}`} className="w-full aspect-square object-cover rounded-xl shadow-sm border border-slate-200 hover:opacity-90 transition-opacity" alt="Resolution Evidence" />
                        </a>
                        <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Officer Remarks</div>
                          <p className="text-sm text-slate-700">{c.resolution_evidence.remarks}</p>
                          {c.resolved_at && (
                            <div className="text-xs text-slate-400 mt-2">
                              Resolved at: {new Date(c.resolved_at).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="w-full aspect-square bg-slate-50 rounded-xl shadow-sm border border-slate-200 border-dashed flex items-center justify-center text-slate-400 text-sm">
                        No resolution evidence uploaded.
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</div>
                  <p className="text-sm text-slate-900 mt-1">{c.description || 'Not reported'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Category</div>
                    <div className="text-sm font-medium text-slate-900">{c.category_name || 'Not determined'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Authority</div>
                    <div className="text-sm font-medium text-slate-900">{c.authority || 'Not determined'}</div>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Citizen Reported</div>
                    <div className="text-sm font-medium text-slate-900">{c.citizen_reported_severity?.toUpperCase() || 'Not determined'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">System Assessed</div>
                    <div className="text-sm font-medium text-slate-900">{c.system_assessed_severity?.toUpperCase() || 'Not determined'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Final Severity</div>
                    <div className="text-sm font-bold text-indigo-700">{c.severity?.toUpperCase()}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wider">Priority Engine Assessment</h2>
              {isAdmin && (
                <div className="flex gap-2">
                  <button onClick={() => {
                    const val = window.prompt("Enter Priority Override (0-100):");
                    if (val !== null) updatePriorityOverride(parseInt(val, 10));
                  }} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100">
                    Update Priority Override
                  </button>
                  {c.admin_priority_override !== null && c.admin_priority_override !== undefined && (
                    <button onClick={() => updatePriorityOverride(null)} className="text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg hover:bg-slate-100">
                      Clear Override
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="p-5 flex flex-col md:flex-row gap-8">
              <div className="flex-shrink-0 text-left min-w-[200px]">
                <div className="text-sm font-bold text-slate-700 mb-2">
                  Effective Priority: <span className="text-xl text-indigo-600">{c.effective_priority ?? c.priority_score ?? 0} / 100</span>
                </div>
                <div className="text-sm font-bold text-slate-700 mb-4">
                  Engine Priority: <span className="text-xl text-slate-600">{c.priority_score ?? 0} / 100</span>
                </div>
                
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Reasons:</div>
                <ul className="text-sm text-slate-600 space-y-1 list-disc pl-4 mb-4">
                  {Array.isArray(c.priority_reasons) ? c.priority_reasons.map((r, i) => (
                    <li key={i}><span className="font-semibold">{r.signal}:</span> {r.description} (+{r.points})</li>
                  )) : (
                    <li className="italic">No priority signals recorded</li>
                  )}
                </ul>

                <div className="mt-4 pt-4 border-t border-slate-100">
                  {c.admin_priority_override !== null && c.admin_priority_override !== undefined ? (
                    <div>
                      <div className="text-sm font-bold text-purple-700 mb-1">Admin Override: {c.admin_priority_override}</div>
                      {c.admin_priority_remarks && (
                        <div className="text-xs text-slate-500">Reason: {c.admin_priority_remarks}</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm font-bold text-slate-500">Admin Override: —</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Location Map</h2>
            </div>
            <div className="p-5">
              <div className="h-[300px] w-full rounded-xl overflow-hidden border border-slate-200 isolate relative mb-4">
                {pos ? (
                  <MapContainer center={pos} zoom={15} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                    <Marker position={pos} />
                    <MapResizer pos={pos} />
                  </MapContainer>
                ) : (
                  <div className="flex items-center justify-center h-full bg-slate-50 text-slate-500">No coordinates</div>
                )}
              </div>
              <div className="mb-4 text-right">
                {pos && (
                  <a href={`https://www.google.com/maps?q=${pos[0]},${pos[1]}`} target="_blank" rel="noreferrer" className="text-sm font-bold text-indigo-600 hover:underline inline-flex items-center gap-1">
                    Open in Google Maps ↗
                  </a>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Address</div>
                  <div className="text-sm font-medium text-slate-900">{c.address || 'Not determined'}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Coordinates</div>
                  <div className="text-sm font-mono text-slate-900">{pos ? `${pos[0].toFixed(5)}, ${pos[1].toFixed(5)}` : 'Not determined'}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Geographic Ward</div>
                  <div className="text-sm font-medium text-slate-900">{c.geographic_ward_number || 'Not determined'}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Admin Ward (Verified)</div>
                  <div className="text-sm font-medium text-slate-900">{c.administrative_ward_name || 'Not determined'}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Zone</div>
                  <div className="text-sm font-medium text-slate-900">{c.administrative_zone || 'Not determined'}</div>
                </div>
              </div>

              <details className="mt-6 border-t border-slate-100 pt-4 cursor-pointer group">
                <summary className="text-sm font-bold text-indigo-600 outline-none">Why was this routed here?</summary>
                <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-mono text-slate-700">
                  <div className="flex flex-col gap-2 relative pl-6">
                    <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-indigo-200"></div>
                    <div className="relative"><span className="absolute -left-5 top-1.5 w-2 h-2 rounded-full bg-indigo-500"></span> Coordinates: {pos ? `${pos[0].toFixed(5)}, ${pos[1].toFixed(5)}` : 'Not determined'}</div>
                    <div className="relative"><span className="absolute -left-5 top-1.5 w-2 h-2 rounded-full bg-indigo-500"></span> Geographic Ward {c.geographic_ward_number || 'Not determined'}</div>
                    <div className="relative"><span className="absolute -left-5 top-1.5 w-2 h-2 rounded-full bg-indigo-500"></span> Administrative Ward {c.administrative_ward_office || c.administrative_ward_name || 'Not determined'}</div>
                    <div className="relative"><span className="absolute -left-5 top-1.5 w-2 h-2 rounded-full bg-indigo-500"></span> Zone {c.administrative_zone || 'Not determined'}</div>
                    <div className="relative"><span className="absolute -left-5 top-1.5 w-2 h-2 rounded-full bg-indigo-500"></span> Authority {c.authority || 'Not determined'}</div>
                    <div className="relative"><span className="absolute -left-5 top-1.5 w-2 h-2 rounded-full bg-indigo-500"></span> Department {c.department_name || 'Not determined'}</div>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">SLA & Assignment</h2>
            </div>
            <div className="p-5 space-y-6">
              {c.sla_due_at && (
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">SLA Status</div>
                  {(() => {
                    const isResolved = !!c.resolved_at || c.status === 'rejected';

                    let statusObj = { label: 'ON TRACK', color: 'bg-emerald-100 text-emerald-700' };
                    if (isResolved) {
                      statusObj = { label: 'RESOLVED', color: 'bg-slate-100 text-slate-700' };
                    } else if (c.is_sla_breached) {
                      statusObj = { label: 'OVERDUE', color: 'bg-red-100 text-red-700 font-bold animate-pulse' };
                    } else if (c.is_sla_approaching) {
                      statusObj = { label: 'DUE SOON', color: 'bg-amber-100 text-amber-700 font-bold' };
                    }

                    return (
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-md text-xs uppercase tracking-wider ${statusObj.color}`}>
                          {statusObj.label}
                        </span>
                        <span className="text-sm text-slate-600 font-medium">Due: {new Date(c.sla_due_at).toLocaleString()}</span>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="pt-4 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Current Assignment</div>
                <div className="text-sm font-medium text-slate-900">
                  {c.officer_id ? (
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> {c.officer_name} <span className="text-xs text-indigo-500 font-bold ml-1">(DEMO OFFICER)</span></span>
                  ) : (
                    <span className="text-slate-500 italic font-medium">Ward Office / Manual Triage</span>
                  )}
                </div>
              </div>

              {isAdmin && (
                <form onSubmit={assign} className="pt-4 border-t border-slate-100">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Re-assign</div>
                  <div className="space-y-3">
                    <select className="w-full text-sm p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={assignDeptId} onChange={e => setAssignDeptId(e.target.value)}>
                      <option value="">No Department</option>
                      {departments.filter(d => c.authority ? d.authority === c.authority : true).map(d => <option key={d.id} value={d.id}>{d.name} ({d.authority})</option>)}
                    </select>

                    <select className="w-full text-sm p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={assignOfficerId} onChange={e => setAssignOfficerId(e.target.value)}>
                      <option value="">No Officer</option>
                      {users.filter(u => u.role === 'municipal_officer' && (!u.department_id || u.department_id === (assignDeptId || c.department_id)) && (!u.ward_id || u.ward_id === c.geographic_ward_number)).map(u => <option key={u.id} value={u.id}>{u.name} (Demo)</option>)}
                    </select>
                    <button type="submit" className="w-full bg-slate-900 text-white font-bold py-2 rounded text-sm hover:bg-slate-800 transition-colors">
                      Update Assignment
                    </button>
                  </div>
                </form>
              )}

              {isAdmin && (
                <form onSubmit={updateSeverity} className="pt-4 border-t border-slate-100">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Update Final Severity</div>
                  <div className="space-y-3">
                    <select className="w-full text-sm p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={assignSeverity} onChange={e => setAssignSeverity(e.target.value)}>
                      <option value="not_assessed">Not Assessed</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                    <button type="submit" className="w-full bg-indigo-900 text-white font-bold py-2 rounded text-sm hover:bg-indigo-800 transition-colors">
                      Update Severity
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Actions</h2>
            </div>
            <div className="p-5">
              {c.status !== 'resolved' && c.status !== 'rejected' ? (
                <div className="space-y-4">
                  {c.status === 'submitted' && (
                    <button onClick={() => updateStatus('assigned')} className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-lg text-sm hover:bg-indigo-700 transition-colors">
                      Acknowledge
                    </button>
                  )}
                  {c.status === 'assigned' && (
                    <button onClick={() => updateStatus('in_progress')} className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg text-sm hover:bg-blue-700 transition-colors">
                      Start Work (In Progress)
                    </button>
                  )}
                  {c.status === 'in_progress' && (
                    <form onSubmit={resolve} className="space-y-3 pt-2">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Submit Resolution Evidence</div>
                      <input type="file" required onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-sm" />
                      <textarea required placeholder="Describe the resolution..." value={remarks} onChange={e => setRemarks(e.target.value)} className="w-full text-sm p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" rows={3} />
                      <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-2.5 rounded-lg text-sm hover:bg-emerald-700 transition-colors">
                        Upload & Resolve
                      </button>
                    </form>
                  )}

                  {c.status === 'submitted' || c.status === 'assigned' || c.status === 'in_progress' ? (
                    <div className="pt-4 border-t border-slate-100 mt-4">
                      <button onClick={() => {
                        const reason = prompt("Enter rejection reason:")
                        if (reason) updateStatus('rejected', reason)
                      }} className="w-full text-red-600 font-bold py-2 rounded-lg text-sm border border-red-200 hover:bg-red-50 transition-colors">
                        Reject Complaint
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-center p-4">
                  <div className="text-xl font-bold text-slate-800 mb-2">Complaint Finalized</div>
                  <p className="text-sm text-slate-500">No further actions can be taken unless disputed by the citizen.</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mt-6">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">Related Reports</h2>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{relatedReports.length}</span>
            </div>
            <div className="p-5">
              {relatedReports.length === 0 ? (
                <div className="text-sm text-slate-500 italic text-center p-4">No related reports found.</div>
              ) : (
                <div className="space-y-3">
                  {relatedReports.map(r => (
                    <div key={r.public_id} className="text-sm border border-slate-200 rounded-md p-3 bg-slate-50 relative overflow-hidden">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <div className="font-mono font-bold text-slate-700">{r.public_id}</div>
                          <div className="text-slate-600 capitalize text-xs mt-0.5">{r.status.replace(/_/g, ' ')}</div>
                        </div>
                        <div className="text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full font-medium whitespace-nowrap">{Math.round(r.distance_meters)}m away</div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-500">
                        <strong>Reasons:</strong> {r.match_reasons.join(' • ')} (Score: {r.match_score})
                      </div>
                      <a href={`/admin/complaints/${r.public_id}`} target="_blank" rel="noreferrer" className="mt-3 block text-center text-xs font-bold bg-white border border-slate-300 text-slate-700 py-1.5 rounded hover:bg-slate-50 transition-colors">
                        View Complaint &rarr;
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  )
}
