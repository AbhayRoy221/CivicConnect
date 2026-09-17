/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import type { AIAnalysisResponse, RoutingPreview } from '../types'

import L from 'leaflet'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
})
L.Marker.prototype.options.icon = DefaultIcon

type LocationSource = 'Device GPS' | 'Search' | 'Manual Map Pin' | null

function LocationMarker({
  pos,
  setPos,
  setSource
}: {
  pos: [number, number] | null,
  setPos: (pos: [number, number]) => void,
  setSource: (s: LocationSource) => void
}) {
  useMapEvents({
    click(e) {
      setPos([e.latlng.lat, e.latlng.lng])
      setSource('Manual Map Pin')
    },
  })

  return pos === null ? null : (
    <Marker
      position={pos}
      draggable={true}
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target
          const position = marker.getLatLng()
          setPos([position.lat, position.lng])
          setSource('Manual Map Pin')
        }
      }}
    />
  )
}

function MapResizer({ pos, step }: { pos: [number, number] | null, step: number }) {
  const map = useMap()
  useEffect(() => {
    if (step === 2) {
      const timer = setTimeout(() => {
        map.invalidateSize()
        if (pos) {
          map.setView(pos, map.getZoom(), { animate: true })
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [map, pos, step])
  return null
}

export function Report() {
  const { token } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)

  // Step 1: Evidence
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [desc, setDesc] = useState('')

  const [analyzeState, setAnalyzeState] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE')
  const [analysisError, setAnalysisError] = useState('')
  const [analysis, setAnalysis] = useState<AIAnalysisResponse | null>(null)

  // Step 2: Location
  const [pos, setPos] = useState<[number, number] | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [locationSource, setLocationSource] = useState<LocationSource>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)

  // Search Autocomplete state
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  const [locationError, setLocationError] = useState<string | null>(null)
  const [isGpsLoading, setIsGpsLoading] = useState(false)

  // Step 3: Review & Related Reports
  const [relatedReports, setRelatedReports] = useState<any[]>([])
  const [checkingRelated, setCheckingRelated] = useState(false)
  const [relatedError, setRelatedError] = useState('')

  const [severity, setSeverity] = useState<string>('not_assessed')
  const [routingPreview, setRoutingPreview] = useState<RoutingPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submittedId, setSubmittedId] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (file) {
      const u = URL.createObjectURL(file)
      setPreview(u)
      return () => URL.revokeObjectURL(u)
    }
    setPreview('')
    setAnalyzeState('IDLE')
    setAnalysis(null)
  }, [file])

  // Reverse geocode when map pin moves (or GPS fires). We skip if it's from Search to save API call.
  useEffect(() => {
    if (!pos || locationSource === 'Search') return
    const [lat, lon] = pos
    const fetchAddress = async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
        const data = await res.json()
        if (data && data.display_name) {
          setAddress(data.display_name)
        } else {
          setAddress(null)
        }
      } catch (err) {
        console.warn("Reverse geocoding failed", err)
        setAddress(null)
      }
    }

    const timeoutId = setTimeout(fetchAddress, 500)
    return () => clearTimeout(timeoutId)
  }, [pos, locationSource])

  // Fetch routing preview whenever location changes (if category is known)
  useEffect(() => {
    if (pos && analysis?.category_name) {
      fetchRoutingPreview()
    }
  }, [pos, analysis?.category_name])

  // Search Autocomplete Debounce
  useEffect(() => {
    if (searchQuery.trim().length < 3) {
      setSearchResults([])
      setIsSearching(false)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      return
    }

    setIsSearching(true)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5`,
          { signal: controller.signal }
        )
        const data = await res.json()
        setSearchResults(data)
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn("Geocoding search failed", err)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false)
        }
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  const accuracyQuality = accuracy !== null
    ? (accuracy <= 100 ? 'GOOD' : (accuracy <= 500 ? 'WARNING' : 'POOR'))
    : null

  const useCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationError("Geolocation is not supported by your browser.")
      return
    }
    setIsGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPos([position.coords.latitude, position.coords.longitude])
        setAccuracy(position.coords.accuracy)
        setLocationSource('Device GPS')
        setLocationError(null)
        setIsGpsLoading(false)
      },
      (error) => {
        console.warn("Geolocation failed:", error)
        setLocationError("Location permission denied. Please allow location access or manually place the pin.")
        setIsGpsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const handleSelectSearchResult = (result: any) => {
    const lat = parseFloat(result.lat)
    const lon = parseFloat(result.lon)
    setPos([lat, lon])
    setAddress(result.display_name)
    setLocationSource('Search')
    setAccuracy(null)
    setLocationError(null)
    setShowDropdown(false)
    setSearchQuery('')
  }

  async function analyzeImage() {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)

    setAnalyzeState('LOADING')
    setAnalysisError('')

    try {
      const res = await api<AIAnalysisResponse>('/complaints/analyze', token, { method: 'POST', body: fd })
      setAnalysis(res)
      setAnalyzeState('SUCCESS')
    } catch (e: Error | any) {
      setAnalyzeState('ERROR')
      setAnalysisError(e.message || 'Analysis failed due to a server error.')
    }
  }

  async function fetchRoutingPreview() {
    if (!pos || !analysis?.category_name) return
    setLoadingPreview(true)
    try {
      const res = await api<RoutingPreview>('/complaints/routing-preview', token, {
        method: 'POST',
        body: JSON.stringify({
          latitude: pos[0],
          longitude: pos[1],
          category_name: analysis.category_name
        }),
      })
      setRoutingPreview(res)
    } catch (e: Error | any) {
      console.error("Failed to load routing preview", e)
    } finally {
      setLoadingPreview(false)
    }
  }

  async function goToReview() {
    if (!pos) {
      alert("Please select a location on the map.")
      return
    }
    if (accuracyQuality === 'POOR' && locationSource === 'Device GPS') {
      alert("Location accuracy is too low. Please use Search or map pin to verify.")
      return
    }
    const [lat, lon] = pos
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      alert("Invalid coordinates.")
      return
    }
    if (!desc.trim()) {
      alert("Please provide a description.")
      return
    }

    setStep(3)

    // Check for related reports
    if (analysis?.category_name && pos) {
      setCheckingRelated(true)
      setRelatedError('')
      try {
        const res = await api<any[]>(`/complaints/check-related?latitude=${pos[0]}&longitude=${pos[1]}&category_name=${encodeURIComponent(analysis.category_name)}`, token)
        setRelatedReports(res)
      } catch (err: any) {
        console.warn("Failed to check related reports", err)
        setRelatedError("Could not verify related reports")
      } finally {
        setCheckingRelated(false)
      }
    }
  }

  async function submitComplaint() {
    if (!file || !pos || !analysis?.category_name || submitting) return
    if (accuracyQuality === 'POOR' && locationSource === 'Device GPS') return
    setSubmitting(true)
    let success = false
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('description', desc)
      fd.append('latitude', pos[0].toString())
      fd.append('longitude', pos[1].toString())
      if (address) fd.append('address', address)
      fd.append('category_name', analysis.category_name)
      fd.append('severity', severity)

      const res = await api<any>('/complaints', token, { method: 'POST', body: fd })
      success = true
      setSubmittedId(res.public_id)
    } catch (err: Error | any) {
      const msg = err.message || 'Failed to submit complaint'
      // Show clean message for validation errors
      if (msg.includes('severity') || msg.includes('input')) {
        alert('Please select a valid severity level.')
      } else {
        alert(msg)
      }
    } finally {
      if (!success) setSubmitting(false)
    }
  }

// ... Skipping unmodified render parts ...


  if (submittedId) {
    const isOutsidePMC = routingPreview?.assignment_status === "Not handled by PMC" || routingPreview?.assignment_status === "No municipal department"

    return (
      <div className="max-w-md mx-auto bg-white min-h-screen p-6 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-500">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-6 ${isOutsidePMC ? 'bg-amber-100' : 'bg-emerald-100'}`}>
          {isOutsidePMC ? '⚠️' : '✅'}
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight text-center mb-2">Complaint Submitted</h1>
        <p className="text-slate-600 text-center mb-8">
          {isOutsidePMC ? 'This location is outside the supported PMC service area.' : 'Thank you for helping improve Pune.'}
        </p>

        <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-8">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-slate-500">Complaint Reference</span>
            <span className="text-lg font-bold text-slate-900">{submittedId}</span>
          </div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-slate-500">Status</span>
            <span className="font-semibold text-emerald-700">Submitted</span>
          </div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-slate-500">Issue</span>
            <span className="font-semibold text-slate-900">{analysis?.category_name}</span>
          </div>

          <div className="border-t border-slate-200 pt-4 mt-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Location & Routing</div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Coordinates</span>
                <span className="text-sm font-mono">{pos?.[0].toFixed(5)}, {pos?.[1].toFixed(5)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Authority</span>
                <span className="text-sm font-semibold">{routingPreview?.authority || 'Not applicable'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Department</span>
                <span className="text-sm font-semibold">{routingPreview?.department_name || 'Not assigned'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Geographic Ward</span>
                <span className="text-sm font-semibold">{routingPreview?.geographic_ward_number || 'Not determined'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Admin Ward</span>
                <span className="text-sm font-semibold">{routingPreview?.administrative_ward_name || routingPreview?.administrative_ward_office || 'Not determined'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Assignment</span>
                <span className={`text-sm font-semibold ${isOutsidePMC ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {routingPreview?.assignment_status}
                </span>
              </div>
            </div>
          </div>



        </div>

        <button onClick={() => navigate('/my-reports')} className="w-full bg-slate-900 text-white font-bold p-4 rounded-xl shadow-lg hover:bg-slate-800 transition-colors">
          View My Reports
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto bg-slate-50 min-h-screen pb-12">
      <div className="bg-white px-6 py-4 shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-slate-900">Report Civic Issue</h1>
        <div className="flex gap-2 mt-4">
          <div className={`h-1.5 flex-1 rounded-full transition-colors ${step >= 1 ? 'bg-indigo-600' : 'bg-slate-200'}`} />
          <div className={`h-1.5 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-200'}`} />
          <div className={`h-1.5 flex-1 rounded-full transition-colors ${step >= 3 ? 'bg-indigo-600' : 'bg-slate-200'}`} />
        </div>
        <div className="flex justify-between mt-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <span className={step >= 1 ? 'text-indigo-700' : ''}>Evidence</span>
          <span className={step >= 2 ? 'text-indigo-700' : ''}>Location</span>
          <span className={step >= 3 ? 'text-indigo-700' : ''}>Review</span>
        </div>
      </div>

      <div className="p-6">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Photo Evidence</label>
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-4 text-center relative overflow-hidden bg-white shadow-sm hover:border-indigo-400 transition-colors cursor-pointer">
                {preview ? (
                  <img src={preview} className="mx-auto h-56 w-full object-cover rounded-xl" alt="Preview" />
                ) : (
                  <div className="py-12 text-slate-500">
                    <div className="text-4xl mb-3">📸</div>
                    <div className="text-base font-semibold text-slate-800">Tap to take photo</div>
                    <div className="text-sm mt-1">or browse files</div>
                  </div>
                )}
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setFile(e.target.files?.[0] || null)} />
              </div>
            </div>

            {file && (
              <div className="space-y-4">
                <button
                  onClick={analyzeImage}
                  disabled={analyzeState === 'LOADING' || analyzeState === 'SUCCESS'}
                  className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                    analyzeState === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                    analyzeState === 'LOADING' ? 'bg-indigo-100 text-indigo-700 cursor-wait' :
                    'bg-indigo-600 text-white shadow-md hover:bg-indigo-700'
                  }`}
                >
                  {analyzeState === 'IDLE' && <><span>✨</span> Analyze Image</>}
                  {analyzeState === 'LOADING' && <>
                    <svg className="animate-spin h-5 w-5 text-indigo-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing...
                  </>}
                  {analyzeState === 'SUCCESS' && <><span>✅</span> Analysis Complete</>}
                  {analyzeState === 'ERROR' && <><span>❌</span> Analysis Failed (Try Again)</>}
                </button>

                {analyzeState === 'ERROR' && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm flex items-start gap-2">
                    <span className="text-base">⚠️</span>
                    <span><strong>Error:</strong> {analysisError}</span>
                  </div>
                )}

                {analysis && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in zoom-in-95">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Detected Issue</div>
                        <div className="text-lg font-bold text-slate-900">{analysis.category_name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Confidence</div>
                        <div className="text-lg font-bold text-indigo-600">{(analysis.confidence * 100).toFixed(0)}%</div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Evidence</div>
                      <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">{analysis.rationale}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                          <span className="font-semibold text-slate-700">Provider:</span> {analysis.provider === 'gemini' ? 'Gemini' : analysis.provider === 'local' ? 'Local Fallback' : analysis.provider}
                        </span>
                        <span>
                          <span className="font-semibold text-slate-700">Model:</span> {analysis.model}
                        </span>
                      </div>
                    </div>

                    {analysis.provider === 'fallback' && (
                      <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                        <span className="text-base mt-0.5">⚠️</span>
                        <span>Cloud classification unavailable — local fallback used.</span>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => setStep(2)}
                  disabled={analyzeState !== 'SUCCESS'}
                  className="w-full bg-slate-900 text-white font-bold p-4 rounded-xl shadow hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                  Continue to Location →
                </button>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-3">Choose Location</label>

              <div className="flex flex-col gap-3 mb-4 relative z-20">
                <button
                  onClick={useCurrentLocation}
                  disabled={isGpsLoading}
                  className="flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 font-bold py-3 px-4 rounded-xl border border-indigo-200 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                >
                  {isGpsLoading ? 'Getting location...' : <><span>📍</span> Use My Current Location</>}
                </button>

                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setShowDropdown(true)
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Enter area, landmark, address..."
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-3.5 text-xs text-indigo-600 font-semibold flex items-center gap-1">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    </div>
                  )}

                  {showDropdown && searchQuery.trim().length >= 3 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                      {!isSearching && searchResults.length === 0 && (
                        <div className="px-4 py-3 text-sm text-slate-500">No locations found.</div>
                      )}
                      {searchResults.map((result, i) => {
                        const parts = result.display_name.split(', ')
                        const title = parts[0]
                        const subtitle = parts.slice(1).join(', ')
                        return (
                          <div
                            key={i}
                            onClick={() => handleSelectSearchResult(result)}
                            className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0 flex gap-3 items-start"
                          >
                            <span className="text-slate-400 mt-0.5">📍</span>
                            <div>
                              <div className="text-sm font-bold text-slate-900">{title}</div>
                              <div className="text-xs text-slate-500 truncate">{subtitle}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {locationError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm flex gap-3 items-start">
                  <span className="text-xl">⚠️</span>
                  <p>{locationError}</p>
                </div>
              )}

              {accuracyQuality === 'POOR' && locationSource === 'Device GPS' && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col gap-3">
                  <div className="text-amber-800 text-sm flex gap-3 items-start">
                    <span className="text-xl">⚠️</span>
                    <p><strong>Location accuracy is too low.</strong> Move to an open area or choose your location manually.</p>
                  </div>
                  <button
                    onClick={useCurrentLocation}
                    disabled={isGpsLoading}
                    className="self-start bg-amber-200 text-amber-900 font-bold px-4 py-2 rounded-lg hover:bg-amber-300 disabled:opacity-50 transition-colors text-sm"
                  >
                    {isGpsLoading ? 'Retrying...' : 'Try Again'}
                  </button>
                </div>
              )}

              <div className="h-[350px] md:h-[400px] w-full rounded-2xl overflow-hidden border-2 border-slate-200 shadow-sm z-0 relative isolate mb-4 bg-slate-100">
                <MapContainer center={pos || [18.5204, 73.8567]} zoom={13} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                  <MapResizer pos={pos} step={step} />
                  <LocationMarker pos={pos} setPos={setPos} setSource={setLocationSource} />
                </MapContainer>
                {!pos && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center pointer-events-none">
                    <div className="bg-slate-900 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-lg pointer-events-auto">
                      Search or Click Map to place pin
                    </div>
                  </div>
                )}
              </div>

              {pos && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm p-5 space-y-4">
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Location Source</div>
                    <div className="text-sm font-bold text-indigo-700">{locationSource}</div>
                  </div>

                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Coordinates</div>
                    <div className="text-sm font-mono text-slate-900">{pos[0].toFixed(5)}, {pos[1].toFixed(5)}</div>
                  </div>

                  {accuracy !== null && (
                    <div className="flex gap-4">
                      <div>
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Accuracy</div>
                        <div className="text-sm text-slate-900">±{accuracy.toFixed(0)} m</div>
                      </div>
                      {accuracyQuality && (
                        <div>
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Quality</div>
                          <div className={`text-sm font-bold ${
                            accuracyQuality === 'GOOD' ? 'text-emerald-600' :
                            accuracyQuality === 'WARNING' ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {accuracyQuality === 'GOOD' ? 'Good' : accuracyQuality === 'WARNING' ? 'Warning' : 'Poor'}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Address</div>
                    <div className="text-sm text-slate-900 font-medium">
                      {address ? address : <span className="text-amber-600">Address unavailable (coordinates verified)</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Description</label>
              <textarea
                className="w-full border border-slate-300 rounded-xl text-sm p-4 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                rows={3}
                placeholder="Add any helpful details about the issue..."
                value={desc}
                onChange={e => setDesc(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">How severe does this issue appear to you?</label>
              <select
                className="w-full border border-slate-300 rounded-xl text-sm p-4 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none"
                value={severity}
                onChange={e => setSeverity(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="flex gap-3 relative z-10">
              <button onClick={() => setStep(1)} className="px-6 py-4 rounded-xl font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors">Back</button>
              <button
                onClick={goToReview}
                disabled={!pos || !desc.trim()}
                className="flex-1 bg-slate-900 text-white font-bold p-4 rounded-xl shadow hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                Review Report →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                IMAGE
              </div>
              <img src={preview} className="w-full h-48 object-cover" alt="Evidence" />

              <div className="p-4 border-b border-slate-100">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">ISSUE</div>
                <div className="text-lg font-bold text-slate-900 mb-2">{analysis?.category_name}</div>
                <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                  <div className="flex justify-between">
                    <span className="font-semibold">Confidence</span>
                    <span>{(analysis!.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Provider</span>
                    <span>{analysis ? (analysis.provider === 'gemini' ? 'Gemini' : analysis.provider === 'local' ? 'Local Fallback' : analysis.provider) : 'Not reported'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Model</span>
                    <span className="font-mono text-xs">{analysis?.model || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 border-b border-slate-100">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">LOCATION</div>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-slate-500 font-semibold mb-1">Source</div>
                    <div className="text-sm font-bold text-indigo-700">{locationSource}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-semibold mb-1">Address</div>
                    <div className="text-sm font-medium text-slate-900">{address || 'Coordinates Only'}</div>
                  </div>
                  <div className="flex gap-6">
                    <div>
                      <div className="text-xs text-slate-500 font-semibold mb-1">Coordinates</div>
                      <div className="text-sm font-mono text-slate-900">{pos![0].toFixed(5)}, {pos![1].toFixed(5)}</div>
                    </div>
                    {accuracy !== null && (
                      <div>
                        <div className="text-xs text-slate-500 font-semibold mb-1">Accuracy</div>
                        <div className="text-sm text-slate-900">±{accuracy.toFixed(0)}m</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">ROUTING</div>
                {loadingPreview ? (
                  <div className="text-sm text-slate-500 animate-pulse font-medium py-2">Determining jurisdiction...</div>
                ) : routingPreview && (
                  <div className="bg-slate-50 rounded-xl p-4 space-y-3 text-sm">
                    <div className="flex justify-between border-b border-slate-200 pb-2 mb-2">
                      <span className="text-slate-500 font-semibold">Service Area</span>
                      <span className={`font-bold ${routingPreview.authority === 'PMC' ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {routingPreview.authority === 'PMC' ? 'Pune Municipal Corporation' : 'Outside PMC'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Authority</span>
                      <span className="font-semibold text-slate-900">{routingPreview.authority || 'Not applicable'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Department</span>
                      <span className="font-semibold text-slate-900">{routingPreview.department_name || 'Not assigned'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Geographic Ward</span>
                      <span className="font-semibold text-slate-900">{routingPreview.geographic_ward_number || 'Not determined'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Administrative Ward</span>
                      <span className="font-semibold text-slate-900 max-w-[150px] truncate">{routingPreview.administrative_ward_name || routingPreview.administrative_ward_office || 'Not determined'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Zone</span>
                      <span className="font-semibold text-slate-900">{routingPreview.administrative_zone || 'Not determined'}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 mt-2">
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-500">Assignment</span>
                        <span className={`font-semibold ${routingPreview.assignment_status.includes('Not handled') ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {routingPreview.assignment_status}
                        </span>
                      </div>
                      {routingPreview.assignment_status === 'Ward Office / Manual Triage' && (
                        <div className="text-xs text-slate-500 text-right italic">
                          No verified individual municipal officer is currently assigned.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Possible Related Reports Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Possible Related Reports</span>
                {checkingRelated && <span className="text-indigo-600 lowercase tracking-normal flex items-center gap-1">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
                  checking...
                </span>}
              </div>
              <div className="p-4">
                {!checkingRelated && relatedError && (
                   <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded-md">{relatedError}</div>
                )}
                {!checkingRelated && !relatedError && relatedReports?.length === 0 && (
                   <div className="text-sm text-slate-500 italic">No similar recent reports found nearby.</div>
                )}
                {!checkingRelated && !relatedError && relatedReports?.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-amber-700 bg-amber-50 p-2 rounded-md mb-2">
                      We found {relatedReports?.length} recent {relatedReports?.length === 1 ? 'report' : 'reports'} nearby that might be related to yours. You can still submit your report if it's a different issue.
                    </div>
                    {relatedReports?.map(r => (
                      <div key={r.public_id} className="text-sm border border-slate-200 rounded-md p-3 bg-slate-50 relative overflow-hidden">
                        <div className="flex justify-between items-start mb-1">
                          <div>
                            <div className="font-mono font-bold text-slate-700">{r.public_id}</div>
                            <div className="text-slate-600 capitalize text-xs mt-0.5">{r.status.replace(/_/g, ' ')}</div>
                          </div>
                          <div className="text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full font-medium whitespace-nowrap">{Math.round(r.distance_meters)}m away</div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-500">
                          <strong>Reasons:</strong> {r.match_reasons.join(' • ')}
                        </div>
                        <a href={`/complaints/${r.public_id}`} target="_blank" rel="noreferrer" className="mt-3 block text-center text-xs font-bold bg-white border border-slate-300 text-slate-700 py-1.5 rounded hover:bg-slate-50 transition-colors">
                          View Complaint &rarr;
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} disabled={submitting} className="px-6 py-4 rounded-xl font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-colors">Back</button>
              <button
                onClick={submitComplaint}
                disabled={submitting || loadingPreview}
                className="flex-1 bg-emerald-600 text-white font-bold p-4 rounded-xl shadow-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Submitting complaint...
                  </>
                ) : 'Submit Complaint'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
