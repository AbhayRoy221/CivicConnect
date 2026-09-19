/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import type { Complaint } from '../types'
import { CitizenLayout } from '../components/CitizenLayout'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

import {
  MapPin,
  Calendar,
  Search,
  Settings,
  CheckCircle2,
  Clock,
  ArrowRight,
  FileText,
  AlertTriangle
} from 'lucide-react'

// Fix Leaflet default icon issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Create custom icons mapping to statuses to reuse pattern from CitizenDashboard
const createStatusIcon = (status: string) => {
  let color = '#f59e0b'; // amber / pending
  if (status === 'resolved') color = '#059669'; // emerald
  if (status === 'in_progress' || status === 'assigned') color = '#3b82f6'; // blue
  if (status === 'rejected') color = '#ef4444'; // red

  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
};

export function MyReports() {
  const { token, user } = useAuth()
  const navigate = useNavigate()

  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // UI State
  const [activeTab, setActiveTab] = useState<'All' | 'Pending' | 'In Progress' | 'Resolved'>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')

  useEffect(() => {
    if (!token) return

    setLoading(true)
    setError(null)

    api<Complaint[]>('/complaints/my', token)
      .then(res => {
        setComplaints(res || [])
      })
      .catch(err => {
        console.error("Failed to load reports:", err)
        setError("Unable to load your reports at this time. Please try again.")
      })
      .finally(() => {
        setLoading(false)
      })
  }, [token])

  // Derive Impact Data
  const impactData = useMemo(() => {
    return {
      total: complaints.length,
      resolved: complaints.filter(c => c.status === 'resolved').length,
      inProgress: complaints.filter(c => ['in_progress', 'assigned'].includes(c.status)).length,
      pending: complaints.filter(c => c.status === 'submitted').length
    }
  }, [complaints])

  // Filter and Sort Data
  const filteredComplaints = useMemo(() => {
    let result = [...complaints]

    // Tab filtering
    if (activeTab === 'Pending') {
      result = result.filter(c => ['submitted'].includes(c.status))
    } else if (activeTab === 'In Progress') {
      result = result.filter(c => ['assigned', 'in_progress'].includes(c.status))
    } else if (activeTab === 'Resolved') {
      result = result.filter(c => ['resolved', 'rejected'].includes(c.status))
    }

    // Search filtering
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(c =>
        (c.public_id && c.public_id.toLowerCase().includes(q)) ||
        (c.category_name && c.category_name.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q))
      )
    }

    // Sorting
    result.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB
    })

    return result
  }, [complaints, activeTab, searchQuery, sortOrder])

  // Get Map Center (Fallback to Pune if no reports have coordinates)
  const mapCenter: [number, number] = useMemo(() => {
    const withCoords = complaints.filter(c => c.latitude && c.longitude)
    if (withCoords.length > 0) {
      return [withCoords[0].latitude!, withCoords[0].longitude!]
    }
    return [18.5204, 73.8567] // Pune
  }, [complaints])

  // Status helper mapping
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-100">
            <Clock className="w-3.5 h-3.5" />
            <span>Pending</span>
          </div>
        )
      case 'assigned':
      case 'in_progress':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold border border-blue-100">
            <Settings className="w-3.5 h-3.5" />
            <span>In Progress</span>
          </div>
        )
      case 'resolved':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold border border-emerald-100">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Resolved</span>
          </div>
        )
      case 'rejected':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Rejected</span>
          </div>
        )
      default:
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold border border-slate-100">
            <Clock className="w-3.5 h-3.5" />
            <span className="uppercase">{status.replace('_', ' ')}</span>
          </div>
        )
    }
  }

  // Define Tabs with Counts
  const tabs = [
    { label: 'All Reports', key: 'All', count: impactData.total },
    { label: 'Pending', key: 'Pending', count: impactData.pending },
    { label: 'In Progress', key: 'In Progress', count: impactData.inProgress },
    { label: 'Resolved', key: 'Resolved', count: impactData.resolved }
  ] as const;

  return (
    <CitizenLayout>
      <div className="max-w-[1200px] mx-auto pb-12 w-full min-w-0 px-4 sm:px-6 lg:px-8">

        {/* HERO SECTION */}
        <div className="relative rounded-[32px] overflow-hidden shadow-sm border border-slate-200 bg-white mb-6 w-full">
          <img
            src="/assets/my-reports/my-reports-hero.png"
            alt="My Reports Hero Background"
            className="w-full h-auto block"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-8 rounded-3xl text-center border border-red-100">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-bold mb-2">Something went wrong</h3>
            <p>{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-6 py-2 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition"
            >
              Try Again
            </button>
          </div>
        ) : complaints.length === 0 ? (
          // EMPTY STATE (0 REPORTS TOTAL)
          <div className="bg-white p-12 rounded-3xl text-center border border-slate-200 shadow-sm">
            <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">No Reports Yet</h3>
            <p className="text-slate-500 max-w-md mx-auto mb-8">
              Your submitted civic reports will appear here. Start making a difference in Pune by reporting your first issue.
            </p>
            <button
              onClick={() => navigate('/report')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-xl transition shadow-sm inline-flex items-center gap-2"
            >
              Report an Issue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          // MAIN CONTENT AREA
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_min(100%,320px)] gap-6 w-full">

            {/* LEFT COLUMN: LIST */}
            <div className="space-y-6">

              {/* Toolbar: Filters & Sort */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

                {/* Tabs */}
                <div className="flex gap-2 p-1 bg-slate-100/80 rounded-2xl border border-slate-200 w-full sm:w-auto overflow-x-auto no-scrollbar">
                  {tabs.map(t => (
                    <button
                      key={t.key}
                      onClick={() => setActiveTab(t.key)}
                      className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                        activeTab === t.key
                          ? 'bg-emerald-700 text-white shadow-md'
                          : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                      }`}
                    >
                      {t.label} {t.count > 0 && <span className="opacity-80">({t.count})</span>}
                    </button>
                  ))}
                </div>

                {/* Sort */}
                <div className="flex items-center shrink-0 ml-auto w-full sm:w-auto">
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
                    className="bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>
              </div>

              {/* LIST OF COMPLAINTS */}
              <div className="space-y-4">
                {filteredComplaints.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
                    No reports found matching this filter.
                  </div>
                ) : (
                  filteredComplaints.map(c => (
                    <div key={c.id} className="bg-white rounded-[24px] border border-slate-200 p-5 flex flex-col sm:flex-row gap-5 hover:shadow-lg hover:border-emerald-200 transition-all duration-300 items-start sm:items-center">

                      {/* Image Thumbnail */}
                      <div className="w-full sm:w-32 h-32 shrink-0 rounded-[16px] overflow-hidden bg-slate-100 border border-slate-100">
                        {c.image_url ? (
                          <img
                            src={c.image_url.startsWith('http') ? c.image_url : `http://localhost:8000${c.image_url}`}
                            alt={c.category_name || "Complaint Image"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                            <FileText className="w-8 h-8 opacity-20 mb-1" />
                            <span className="text-[10px] font-medium opacity-50 uppercase tracking-widest">No Image</span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-slate-900 truncate mb-1">
                          {c.category_name || 'Civic Issue'}
                        </h3>

                        <div className="space-y-1.5 mb-4">
                          <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                            <MapPin className="w-4 h-4 shrink-0" />
                            <span className="truncate" title={c.address || c.administrative_ward_name || c.administrative_ward_office || 'Pune, Maharashtra'}>{c.address || c.administrative_ward_name || c.administrative_ward_office || 'Pune, Maharashtra'}</span>
                          </div>

                          <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                            <Calendar className="w-4 h-4 shrink-0" />
                            <span className="truncate">{new Date(c.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          </div>
                        </div>

                        {/* Status */}
                        <div>
                          {getStatusBadge(c.status)}
                        </div>
                      </div>

                      {/* Action */}
                      <div className="shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                        <Link
                          to={`/complaints/${c.id}`}
                          className="inline-flex w-full justify-center items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 hover:border-slate-300 transition"
                        >
                          View Details
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>

                    </div>
                  ))
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: SIDEBAR */}
            <div className="space-y-6">

              {/* YOUR IMPACT CARD */}
              <div className="bg-emerald-50 rounded-[28px] border border-emerald-100 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
                      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
                    </svg>
                  </div>
                  <h3 className="text-[17px] font-extrabold text-emerald-950">Your Impact</h3>
                </div>
                <p className="text-emerald-800 text-[13px] font-medium leading-tight mb-5 ml-13 pl-1">
                  Together for a Cleaner, Greener Pune
                </p>

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white rounded-[16px] border border-emerald-100 p-3 text-center shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)]">
                    <FileText className="w-5 h-5 text-emerald-600 mx-auto mb-1.5" />
                    <div className="text-2xl font-black text-slate-900 leading-none mb-1">{impactData.total}</div>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Total Reports</div>
                  </div>

                  <div className="bg-white rounded-[16px] border border-emerald-100 p-3 text-center shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)]">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1.5" />
                    <div className="text-2xl font-black text-slate-900 leading-none mb-1">{impactData.resolved}</div>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Resolved</div>
                  </div>

                  <div className="bg-white rounded-[16px] border border-emerald-100 p-3 text-center shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)]">
                    <Settings className="w-5 h-5 text-blue-600 mx-auto mb-1.5" />
                    <div className="text-2xl font-black text-slate-900 leading-none mb-1">{impactData.inProgress}</div>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">In Progress</div>
                  </div>
                </div>
              </div>

              {/* MAP CARD */}
              <div className="bg-white rounded-[28px] border border-slate-200 p-6 shadow-sm overflow-hidden flex flex-col h-[400px]">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-700 shrink-0 border border-slate-200">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
                      <line x1="9" x2="9" y1="3" y2="18"/>
                      <line x1="15" x2="15" y1="6" y2="21"/>
                    </svg>
                  </div>
                  <h3 className="text-[17px] font-extrabold text-slate-900">Your Reports on Map</h3>
                </div>
                <p className="text-slate-500 text-[13px] font-medium leading-tight mb-4 ml-13 pl-1">
                  See where you've made a difference
                </p>

                <div className="flex-1 w-full rounded-[16px] overflow-hidden border border-slate-200 bg-slate-50 relative z-0 min-h-[260px]">
                  <MapContainer
                    center={mapCenter}
                    zoom={12}
                    style={{ height: '100%', width: '100%', zIndex: 1 }}
                    scrollWheelZoom={false}
                  >
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />

                    {complaints.filter(c => c.latitude && c.longitude).map(c => (
                      <Marker
                        key={c.id}
                        position={[c.latitude!, c.longitude!]}
                        icon={createStatusIcon(c.status)}
                      >
                        <Popup className="rounded-xl overflow-hidden shadow-lg border-0">
                          <div className="p-1 min-w-[160px]">
                            <p className="font-bold text-sm text-slate-900 mb-0.5">{c.category_name}</p>
                            <p className="text-xs text-slate-500 mb-2 truncate">{c.public_id}</p>
                            <Link to={`/complaints/${c.id}`} className="text-xs text-emerald-600 font-semibold hover:underline block text-right">
                              View →
                            </Link>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </CitizenLayout>
  )
}
