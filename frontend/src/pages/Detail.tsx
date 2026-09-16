/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import type { Complaint, ResolutionEvidence, ComplaintHistory } from '../types'
import { useParams, Link } from 'react-router-dom'

export function Detail() {
  const { id } = useParams()
  const { token, user } = useAuth()
  const [complaint, setComplaint] = useState<Complaint | null>(null)
  const [evidence, setEvidence] = useState<ResolutionEvidence[]>([])
  const [timeline, setTimeline] = useState<ComplaintHistory[]>([])
  const [disputeRemarks, setDisputeRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [relatedReports, setRelatedReports] = useState<any[]>([])

  useEffect(() => {
    load()
  }, [id, token])

  async function load() {
    try {
      const c = await api<Complaint>(`/complaints/${id}`, token)
      setComplaint(c)

      const tl = await api<ComplaintHistory[]>(`/complaints/${id}/timeline`, token)
      setTimeline(tl)

      if (c.resolution_evidence) {
        setEvidence([c.resolution_evidence])
      }

      try {
        const rel = await api<any[]>(`/complaints/${id}/related`, token)
        setRelatedReports(rel)
      } catch (err) { console.warn("Failed to load related reports") }

    } catch (e: Error | any) {
      alert(e.message)
    }
  }

  async function dispute(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    let success = false
    try {
      await api(`/complaints/${id}/dispute`, token, { method: 'POST', body: JSON.stringify({ remarks: disputeRemarks }) })
      success = true
      alert(complaint?.status === 'rejected' ? 'Appeal submitted successfully' : 'Dispute raised successfully')
      setDisputeRemarks('')
      window.dispatchEvent(new Event('notifications_updated'))
      load()
    } catch (err: Error | any) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!complaint) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-slate-500 animate-pulse font-medium">Loading report details...</div>
    </div>
  )

  const isResolved = complaint.status === 'resolved'
  const isRejected = complaint.status === 'rejected'

  return (
    <div className="max-w-2xl mx-auto bg-slate-50 min-h-screen pb-12">
      <div className="bg-white px-6 py-4 shadow-sm border-b border-slate-200 sticky top-0 z-10 flex items-center gap-4">
        <Link to="/my-reports" className="text-slate-500 hover:text-slate-900 transition-colors">← Back</Link>
        <h1 className="text-xl font-bold text-slate-900 flex-1 truncate">Report {complaint.public_id}</h1>
        <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full tracking-wide ${
          isResolved ? 'bg-emerald-100 text-emerald-800' :
          isRejected ? 'bg-red-100 text-red-800' :
          'bg-amber-100 text-amber-800'
        }`}>
          {complaint.status.replace('_', ' ')}
        </span>
      </div>

      <div className="p-6 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">{complaint.category_name || 'Uncategorized'}</div>
          <p className="text-lg text-slate-900 font-medium leading-relaxed">{complaint.description || 'Not reported'}</p>
          <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500 flex justify-between">
            <span>Reported on {new Date(complaint.created_at).toLocaleDateString()}</span>
            <span>ID: {complaint.public_id}</span>
          </div>
        </div>

        {/* Possible Duplicates Warning */}
        {complaint.duplicates && complaint.duplicates.length > 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 items-start">
            <span className="text-xl">⚠️</span>
            <div>
              <div className="font-bold text-amber-900 text-sm mb-1">Possible Duplicate Detected</div>
              <div className="text-amber-800 text-sm">
                There is another report nearby with {Math.round(complaint.duplicates[0].similarity_score * 100)}% visual similarity.
                This may affect prioritization.
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Routing Information */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span>🏛️</span> Routing & Authority
            </h2>
            <div className="space-y-3 text-sm">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="text-slate-500 text-xs mb-1">Authority</div>
                <div className="font-semibold text-slate-900">{complaint.authority || 'Not determined'}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs mb-1">Department</div>
                <div className="font-semibold text-slate-900">{complaint.department_name || 'Not determined'}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs mb-1">Assigned Officer</div>
                <div className="font-semibold text-slate-900">
                  {complaint.officer_name ? (
                    <span className="text-emerald-700">Demo Officer: {complaint.officer_name}</span>
                  ) : (
                    <span className="text-amber-600">Awaiting municipal assignment</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Location Information */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span>📍</span> Location Details
            </h2>
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-slate-500 text-xs mb-1">Address</div>
                <div className="font-semibold text-slate-900 line-clamp-2">{complaint.address || 'Coordinates Only'}</div>
              </div>
              <div className="flex gap-4">
                <div>
                  <div className="text-slate-500 text-xs mb-1">Geographic Ward</div>
                  <div className="font-mono text-slate-900">{complaint.geographic_ward_number || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs mb-1">Admin Ward</div>
                  <div className="font-mono text-slate-900">{complaint.administrative_ward_office || complaint.administrative_ward_name || 'N/A'}</div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${complaint.latitude},${complaint.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:text-indigo-800 font-semibold text-xs flex items-center gap-1"
                >
                  View on Google Maps ↗
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Resolution Evidence */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>📷</span> Evidence & Resolution
            </h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">Before (Original)</div>
                <img src={`http://localhost:8000${complaint.image_url}`} className="w-full h-48 object-cover rounded-xl shadow-sm border border-slate-200" alt="Original Complaint Evidence" />
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2 text-center">After (Resolution)</div>
                {complaint.resolution_evidence ? (
                  <img src={`http://localhost:8000${complaint.resolution_evidence.image_url}`} className="w-full h-48 object-cover rounded-xl shadow-sm border border-slate-200" alt="Resolution Evidence" />
                ) : (
                  <div className="w-full h-48 bg-slate-50 rounded-xl shadow-sm border border-slate-200 border-dashed flex items-center justify-center text-slate-400 text-sm">
                    No resolution evidence uploaded.
                  </div>
                )}
              </div>
            </div>

            {complaint.resolution_evidence?.remarks && (
              <div className="mt-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Officer Remarks</div>
                <p className="text-sm text-slate-700">{complaint.resolution_evidence.remarks}</p>
                {complaint.resolved_at && (
                  <div className="text-xs text-slate-400 mt-2">
                    Resolved at: {new Date(complaint.resolved_at).toLocaleString()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dispute / Appeal Section */}
        {user?.role === 'citizen' && (isResolved || isRejected) && !complaint.is_escalated && (
          <div className={`bg-white rounded-2xl shadow-sm border p-5 ${isRejected ? 'border-orange-200' : 'border-red-200'}`}>
            <h3 className={`font-bold mb-2 ${isRejected ? 'text-orange-700' : 'text-red-700'}`}>
              {isRejected ? 'Disagree with rejection?' : 'Not fixed properly?'}
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              {isRejected
                ? 'If you believe this complaint was incorrectly rejected, you can appeal for another review.'
                : 'If the issue persists or the evidence is incorrect, you can raise a dispute to reopen the case.'}
            </p>
            <form onSubmit={dispute} className="space-y-3">
              <textarea
                required
                className={`w-full text-sm p-4 border rounded-xl bg-slate-50 focus:ring-2 outline-none ${isRejected ? 'border-slate-300 focus:ring-orange-500 focus:border-orange-500' : 'border-slate-300 focus:ring-red-500 focus:border-red-500'}`}
                placeholder={isRejected ? "Explain why this should not be rejected..." : "Explain why this is not resolved..."}
                value={disputeRemarks}
                onChange={e => setDisputeRemarks(e.target.value)}
                disabled={submitting}
              />
              <button
                disabled={submitting}
                className={`text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-sm disabled:opacity-50 ${isRejected ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {submitting ? 'Submitting...' : (isRejected ? 'Appeal Rejection' : 'Raise Dispute')}
              </button>
            </form>
          </div>
        )}

        {/* Timeline */}
        {timeline.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
              <span>⏱️</span> Timeline
            </h2>
            <div className="space-y-6">
              {timeline.map((event, i) => (
                <div key={event.id} className="relative pl-6">
                  {i !== timeline.length - 1 && (
                    <div className="absolute left-1.5 top-5 bottom-[-24px] w-0.5 bg-slate-200" />
                  )}
                  <div className="absolute left-0 top-1.5 w-3.5 h-3.5 bg-indigo-500 rounded-full border-2 border-white shadow-sm" />
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {event.old_status ? `${event.old_status.replace('_', ' ')} → ${event.new_status.replace('_', ' ')}` : event.new_status.replace('_', ' ')}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{new Date(event.timestamp).toLocaleString()}</div>
                    {event.remarks && (
                      <div className="mt-2 text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        {event.remarks}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related Reports */}
        {relatedReports.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>🔗</span> Possible Related Reports
              </h2>
              <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2 py-1 rounded-full">{relatedReports.length}</span>
            </div>
            <div className="p-5">
              <div className="space-y-3">
                {relatedReports.map(r => (
                  <div key={r.public_id} className="text-sm border border-slate-200 rounded-md p-3 bg-slate-50">
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-mono font-bold text-slate-700">{r.public_id}</div>
                      <div className="text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full font-medium whitespace-nowrap">{Math.round(r.distance_meters)}m away</div>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                      <span className="text-indigo-700">{r.category_name}</span>
                      <span className={r.status === 'resolved' ? 'text-emerald-700' : 'text-slate-600'}>{r.status.replace('_', ' ')}</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-500">
                      <strong>Match:</strong> {r.match_reasons.join(' • ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
