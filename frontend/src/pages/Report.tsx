/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { useNavigate, Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import type { AIAnalysisResponse, RoutingPreview } from '../types'
import AdvisoryModal from '../components/AdvisoryModal'
import { CitizenLayout } from '../components/CitizenLayout'

const VALID_CATEGORIES = [
  "Pothole / Road Damage",
  "Garbage Overflow",
  "Water Leakage",
  "Streetlight Issue",
  "Waterlogging",
  "Illegal Parking",
  "Other Civic Issue"
];

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

  const [confirmedCategory, setConfirmedCategory] = useState<string | null>(null)
  const [showManualCategory, setShowManualCategory] = useState(false)

  // Step 2: Location
  const [pos, setPos] = useState<[number, number] | null>(null)
  const [address, setAddress] = useState<string | null>(null)

  // Scroll to top when changing steps
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

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
  const restoringRef = useRef(false)

  useEffect(() => {
    const draftStr = sessionStorage.getItem('report_draft_state');
    if (draftStr) {
      restoringRef.current = true;
      try {
        const draft = JSON.parse(draftStr);
        if (draft.step) setStep(draft.step);
        if (draft.desc) setDesc(draft.desc);
        if (draft.pos) setPos(draft.pos);
        if (draft.address) setAddress(draft.address);
        if (draft.locationSource) setLocationSource(draft.locationSource);
        if (draft.accuracy) setAccuracy(draft.accuracy);
        if (draft.confirmedCategory) setConfirmedCategory(draft.confirmedCategory);
        if (draft.severity) setSeverity(draft.severity);
        if (draft.relatedReports) setRelatedReports(draft.relatedReports);

        const imgBase64 = sessionStorage.getItem('report_draft_image');
        if (imgBase64) {
          fetch(imgBase64)
            .then(res => res.blob())
            .then(blob => {
              const f = new File([blob], 'image.jpg', { type: blob.type || 'image/jpeg' });
              setFile(f);
              restoringRef.current = false;
            })
            .catch(() => {
              restoringRef.current = false;
            });
        } else {
          restoringRef.current = false;
        }
      } catch (e) {
        restoringRef.current = false;
        console.warn("Failed to parse draft state", e);
      }
      sessionStorage.removeItem('report_draft_state');
    }
  }, [])

  useEffect(() => {
    if (file) {
      const u = URL.createObjectURL(file)
      setPreview(u)
      return () => URL.revokeObjectURL(u)
    }
    if (restoringRef.current) return;

    setPreview('')
    setAnalyzeState('IDLE')
    setAnalysis(null)
    setConfirmedCategory(null)
    setShowManualCategory(false)
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
    if (pos && confirmedCategory) {
      fetchRoutingPreview()
    }
  }, [pos, confirmedCategory])

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
    if (!file || analyzeState === 'LOADING') return

    setAnalyzeState('LOADING')
    setAnalysisError('')

    try {
      // 1. Client-side compression for classification request (preserves original 'file' state)
      const compressedBlob = await compressImage(file)

      // Save compressed image to sessionStorage for draft recovery
      const reader = new FileReader();
      reader.readAsDataURL(compressedBlob);
      reader.onload = () => sessionStorage.setItem('report_draft_image', reader.result as string);

      const fd = new FormData()
      fd.append('file', compressedBlob, file.name || 'image.jpg')

      // 2. Upload and analyze
      const res = await api<AIAnalysisResponse>('/complaints/analyze', token, { method: 'POST', body: fd })
      setAnalysis(res)
      setAnalyzeState('SUCCESS')
      const uncertain = res.category_name.includes('Uncertain') || res.confidence < 0.6
      if (uncertain) {
        setShowManualCategory(true)
      }
    } catch (e: Error | any) {
      setAnalyzeState('ERROR')
      setAnalysisError(e.message || 'Analysis failed due to a server error.')
      setShowManualCategory(true)
    }
  }

  // Helper for fast client-side resizing
  async function compressImage(file: File): Promise<Blob> {
    // Skip compression during vitest execution since JSDOM doesn't support canvas fully
    if (import.meta.env.MODE === 'test') {
      return file;
    }

    return new Promise((resolve) => {
      // Safety fallback for edge cases where canvas or Image doesn't load
      const fallbackTimer = setTimeout(() => resolve(file), 1000);

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = event => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const maxDim = 800;
          let w = img.width;
          let h = img.height;

          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = (h * maxDim) / w;
              w = maxDim;
            } else {
              w = (w * maxDim) / h;
              h = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
             clearTimeout(fallbackTimer);
             return resolve(file);
          }
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(blob => {
            clearTimeout(fallbackTimer);
            if (blob) resolve(blob);
            else resolve(file);
          }, 'image/jpeg', 0.7);
        };
        img.onerror = () => {
          clearTimeout(fallbackTimer);
          resolve(file);
        };
      };
      reader.onerror = () => {
        clearTimeout(fallbackTimer);
        resolve(file);
      };
    });
  }

  async function fetchRoutingPreview() {
    if (!pos || !confirmedCategory) return
    setLoadingPreview(true)
    try {
      const res = await api<RoutingPreview>('/complaints/routing-preview', token, {
        method: 'POST',
        body: JSON.stringify({
          latitude: pos[0],
          longitude: pos[1],
          category_name: confirmedCategory
        }),
      })
      setRoutingPreview(res)
    } catch (e: Error | any) {
      console.error("Failed to load routing preview", e)
    } finally {
      setLoadingPreview(false)
    }
  }

  const [checkingAdvisories, setCheckingAdvisories] = useState(false)
  const [activeAdvisories, setActiveAdvisories] = useState<any[]>([])
  const [showAdvisoryModal, setShowAdvisoryModal] = useState(false)

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

    if (confirmedCategory && pos) {
      setCheckingAdvisories(true)
      try {
        const res = await api<any>(`/complaints/check-advisories?latitude=${pos[0]}&longitude=${pos[1]}&category_name=${encodeURIComponent(confirmedCategory)}`, token)
        if (res.has_advisory && res.advisories.length > 0) {
          setActiveAdvisories(res.advisories)
          setShowAdvisoryModal(true)
          setCheckingAdvisories(false)
          return // Stop and show modal
        }
      } catch (err) {
        console.warn("Failed to check advisories", err)
      } finally {
        setCheckingAdvisories(false)
      }
    }

    proceedToReviewStep()
  }

  function proceedToReviewStep() {
    setShowAdvisoryModal(false)
    setStep(3)

    // Check for related reports
    if (confirmedCategory && pos) {
      setCheckingRelated(true)
      setRelatedError('')
      api<any[]>(`/complaints/check-related?latitude=${pos[0]}&longitude=${pos[1]}&category_name=${encodeURIComponent(confirmedCategory)}`, token)
        .then(res => setRelatedReports(res))
        .catch(err => {
          console.warn("Failed to check related reports", err)
          setRelatedError("Could not verify related reports")
        })
        .finally(() => setCheckingRelated(false))
    }
  }

  async function submitComplaint() {
    if (!file || !pos || !confirmedCategory || submitting) return
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
      fd.append('category_name', confirmedCategory)
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
      <CitizenLayout>
        <div className="max-w-4xl mx-auto animate-in fade-in duration-500 pb-12">

          {/* Upper Panoramic Section */}
          <div className="rounded-3xl overflow-hidden shadow-sm mb-8 bg-white border border-slate-200/50">
            <img
              src="/assets/report/nagarmitra_upper_section.png"
              alt="Complaint Submitted successfully"
              className="w-full h-auto object-contain"
            />
            {isOutsidePMC && (
               <div className="p-4 bg-amber-50 text-amber-800 text-center font-medium border-t border-amber-100 text-sm">
                 ⚠️ This location is outside the supported PMC service area.
               </div>
            )}
          </div>

          {/* Complaint Summary Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-sm mb-8">
            {/* Top Row: Reference & Date */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-6 mb-6 gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl border border-emerald-100/50">
                  <span role="img" aria-label="document">📄</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Complaint Reference</div>
                  <div className="text-2xl font-black text-emerald-700 tracking-tight">{submittedId}</div>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold shadow-sm">
                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                     Submitted
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100 w-full md:w-auto">
                <div className="text-slate-400 text-xl">📅</div>
                <div>
                  <div className="text-xs font-semibold text-slate-500">Submitted on</div>
                  <div className="text-sm font-bold text-slate-900">{new Date().toLocaleString('en-IN', {day:'numeric', month:'short', year:'numeric', hour:'numeric', minute:'2-digit', hour12:true})}</div>
                </div>
              </div>
            </div>

            {/* Bottom Row: Image, Issue Detail, Location */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Left: Image & Issue Detail */}
              <div className="md:col-span-1 flex flex-col gap-5">
                {preview && (
                  <img src={preview} alt="Submitted Evidence" className="w-full h-40 object-cover rounded-2xl border border-slate-200 shadow-sm" />
                )}
                <div className="flex gap-3">
                  <div className="text-slate-400 text-xl mt-0.5">⚠️</div>
                  <div>
                      <div className="text-xs font-semibold text-slate-500 mb-1">Issue Details</div>
                      <div className="text-base font-bold text-slate-900">{confirmedCategory}</div>
                      {desc && <div className="text-sm text-slate-600 mt-1 leading-relaxed">{desc}</div>}
                  </div>
                </div>
              </div>

              {/* Right: Location & Routing */}
              <div className="md:col-span-2">
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/80 h-full">
                  <div className="flex items-center gap-2 text-emerald-600 mb-5 pb-4 border-b border-slate-200/60">
                      <span className="text-xl">📍</span>
                      <span className="text-sm font-bold text-slate-800 uppercase tracking-wider">Location & Routing</span>
                  </div>
                  <div className="space-y-3.5">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500 font-medium">Coordinates</span>
                        <span className="text-sm font-mono font-semibold text-slate-900">{pos?.[0].toFixed(5)}, {pos?.[1].toFixed(5)}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-100 pt-3.5">
                        <span className="text-sm text-slate-500 font-medium">Authority</span>
                        <span className="text-sm font-bold text-slate-900">{routingPreview?.authority || 'Not applicable'}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-100 pt-3.5">
                        <span className="text-sm text-slate-500 font-medium">Department</span>
                        <span className="text-sm font-bold text-slate-900">{routingPreview?.department_name || 'Not assigned'}</span>
                      </div>
                      {routingPreview?.geographic_ward_number != null && (
                      <div className="flex justify-between items-center border-t border-slate-100 pt-3.5">
                        <span className="text-sm text-slate-500 font-medium">Geographic Ward</span>
                        <span className="text-sm font-bold text-slate-900">{routingPreview.geographic_ward_number}</span>
                      </div>
                      )}
                      {(routingPreview?.administrative_ward_name || routingPreview?.administrative_ward_office) && (
                      <div className="flex justify-between items-center border-t border-slate-100 pt-3.5">
                        <span className="text-sm text-slate-500 font-medium">Admin Ward</span>
                        <span className="text-sm font-bold text-slate-900 text-right max-w-[200px] truncate">{routingPreview.administrative_ward_name || routingPreview.administrative_ward_office}</span>
                      </div>
                      )}
                      <div className="flex justify-between items-center border-t border-slate-100 pt-3.5">
                        <span className="text-sm text-slate-500 font-medium">Assignment</span>
                        <span className={`text-sm font-bold ${isOutsidePMC ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {routingPreview?.assignment_status}
                        </span>
                      </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action button */}
          <div className="mb-12">
            <button onClick={() => navigate('/my-reports')} className="w-full bg-slate-900 text-white font-bold p-5 rounded-2xl shadow-md hover:bg-slate-800 hover:shadow-lg transition-all text-lg flex items-center justify-center gap-2">
              Track My Reports →
            </button>
          </div>

          {/* Lower Civic Branding Section */}
          <div className="w-full rounded-3xl overflow-hidden shadow-sm bg-slate-50 border border-slate-200/50">
            <img
              src="/assets/report/nagarmitra_lower_section.png"
              alt="NagarMitra Civic Partnership"
              className="w-full h-auto object-cover md:object-contain object-bottom max-h-[250px]"
            />
          </div>

        </div>
      </CitizenLayout>
    )
  }

  return (
    <CitizenLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 md:mb-8 relative rounded-3xl overflow-hidden shadow-sm flex items-center min-h-[200px]">
            <img src="/assets/report/report-issue-hero.png" alt="Report Issue" className="absolute inset-0 w-full h-full object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/70 to-transparent w-full md:w-3/4 lg:w-3/5"></div>
            <div className="relative z-10 p-8 md:p-12 max-w-2xl">
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">Report an Issue</h1>
              <p className="text-xl font-medium text-emerald-800 mb-2">See it. Report it. Make a difference.</p>
              <p className="text-slate-700 text-sm md:text-base opacity-90">Upload a photo, add the location, and we'll take it from there.</p>
            </div>
          </div>

          <div className="mb-6 md:mb-8 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between relative">
            <div className="absolute top-1/2 left-8 right-8 h-1 bg-slate-100 -translate-y-1/2 z-0 hidden md:block rounded-full"></div>

            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-colors ${step >= 1 ? 'bg-emerald-600 text-white' : 'bg-white border-2 border-slate-200 text-slate-400'}`}>1</div>
              <span className={`text-xs font-bold uppercase tracking-wider ${step >= 1 ? 'text-emerald-900' : 'text-slate-400'}`}>Upload Photo</span>
            </div>

            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-colors ${step >= 2 ? 'bg-emerald-600 text-white' : 'bg-white border-2 border-slate-200 text-slate-400'}`}>2</div>
              <span className={`text-xs font-bold uppercase tracking-wider ${step >= 2 ? 'text-emerald-900' : 'text-slate-400'}`}>Location</span>
            </div>

            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-colors ${step >= 3 ? 'bg-emerald-600 text-white' : 'bg-white border-2 border-slate-200 text-slate-400'}`}>3</div>
              <span className={`text-xs font-bold uppercase tracking-wider ${step >= 3 ? 'text-emerald-900' : 'text-slate-400'}`}>Review</span>
            </div>
          </div>

        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Left Column - Upload */}
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-sm space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-lg font-extrabold text-slate-900">Photo Evidence</label>
                    <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">Step 1 of 3</span>
                  </div>
                  <div className="border-2 border-dashed border-slate-300 rounded-2xl p-4 text-center relative overflow-hidden bg-slate-50 shadow-sm hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors cursor-pointer group">
                    {preview ? (
                      <img src={preview} className="mx-auto h-56 w-full object-cover rounded-xl" alt="Preview" />
                    ) : (
                      <div className="py-12 text-slate-500 group-hover:text-emerald-600 transition-colors">
                        <div className="text-4xl mb-3">📸</div>
                        <div className="text-base font-semibold text-slate-800 group-hover:text-emerald-700">Tap to take photo</div>
                        <div className="text-sm mt-1">or browse files</div>
                      </div>
                    )}
                    <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setFile(e.target.files?.[0] || null)} />
                  </div>
                </div>

                {file && (
                  <div className="space-y-4">
                    {analyzeState === 'IDLE' || analyzeState === 'LOADING' ? (
                      <button
                        onClick={analyzeImage}
                        disabled={analyzeState === 'LOADING'}
                        className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all ${
                          analyzeState === 'LOADING' ? 'bg-emerald-100 text-emerald-700 cursor-wait' :
                          'bg-emerald-600 text-white shadow-md hover:bg-emerald-700'
                        }`}
                      >
                        {analyzeState === 'IDLE' && <><span>✨</span> Analyze Image</>}
                        {analyzeState === 'LOADING' && <>
                          <svg className="animate-spin h-5 w-5 text-emerald-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <div className="flex flex-col items-start text-left ml-1">
                            <span className="leading-tight">Analyzing your photo...</span>
                            <span className="text-xs font-normal opacity-70 leading-tight">Identifying the civic issue</span>
                          </div>
                        </>}
                      </button>
                    ) : null}

                    {analysisError && (
                      <div className="text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-200 text-sm">
                        {analysisError}
                      </div>
                    )}

                    {analyzeState === 'SUCCESS' && !showManualCategory && analysis && (
                      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in zoom-in-95">
                        <div className="flex items-center gap-2 mb-2 text-emerald-600 font-bold text-sm">
                          <span>✨</span>
                          <span>AI detected:</span>
                          {analysis.provider === 'fallback' && <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">Local Fallback</span>}
                        </div>

                        <div className="text-xl font-extrabold text-slate-900">{analysis.category_name}</div>

                        <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <span className="font-semibold text-slate-900 block mb-1">Why:</span>
                          {analysis.rationale.replace(/\[.*?\]\s*/, '')}
                        </div>

                        <div className="pt-4 mt-4 border-t border-slate-100">
                          <div className="text-sm font-semibold text-slate-700 mb-3 text-center">Is this correct?</div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => {
                                setConfirmedCategory(analysis.category_name)
                                setStep(2)
                              }}
                              className="flex-1 bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl shadow-sm hover:bg-emerald-700 transition-colors"
                            >
                              Confirm & Continue
                            </button>
                            <button
                              onClick={() => setShowManualCategory(true)}
                              className="flex-1 bg-white border border-slate-300 text-slate-700 font-bold py-3 px-4 rounded-xl hover:bg-slate-50 transition-colors"
                            >
                              Change Category
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {showManualCategory && (
                      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in zoom-in-95">
                        <div className="text-sm font-semibold text-slate-700 text-center mb-4">
                          {analyzeState === 'ERROR' || (analysis && (analysis.category_name.includes('Uncertain') || analysis.confidence < 0.6))
                            ? "We couldn't confidently identify the issue. Please choose the category."
                            : "Select the correct category:"}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {VALID_CATEGORIES.map(cat => (
                            <button
                              key={cat}
                              onClick={() => {
                                setConfirmedCategory(cat)
                                setStep(2)
                              }}
                              className="text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 font-medium text-slate-800 transition-colors"
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Tips */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
                <h3 className="font-bold text-slate-900 text-lg mb-4 flex items-center gap-2">
                  <span className="text-amber-500">💡</span> Tips for a better report
                </h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 text-sm font-bold">1</div>
                    <p className="text-sm text-slate-600">Ensure the issue is clearly visible and well-lit.</p>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 text-sm font-bold">2</div>
                    <p className="text-sm text-slate-600">Include surrounding landmarks if possible for better context.</p>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 text-sm font-bold">3</div>
                    <p className="text-sm text-slate-600">Avoid capturing faces or license plates.</p>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Left Column — Choose Location */}
              <div className="lg:col-span-3 space-y-6">
                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-sm">
                  <h3 className="font-bold text-slate-900 text-xl mb-1 flex items-center gap-2">
                    <span>📍</span> Choose Location
                  </h3>
                  <p className="text-slate-500 text-sm mb-6">Tell us where the issue is located.</p>

                  <div className="flex flex-col gap-4 mb-6 relative z-20">
                    <button
                      onClick={useCurrentLocation}
                      disabled={isGpsLoading}
                      className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 font-bold py-3 px-4 rounded-xl border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                    >
                      {isGpsLoading ? 'Getting location...' : <><span>📍</span> Use My Current Location</>}
                    </button>

                    <div className="relative">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Search for an area, landmark or address</label>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value)
                          setShowDropdown(true)
                        }}
                        onFocus={() => setShowDropdown(true)}
                        placeholder="Enter area, landmark, address..."
                        className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                      {isSearching && (
                        <div className="absolute right-3 top-[38px] text-xs text-emerald-600 font-semibold flex items-center gap-1">
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

                  <div className="h-[360px] md:h-[420px] w-full rounded-2xl overflow-hidden border border-slate-200 shadow-inner z-0 relative isolate mb-6 bg-slate-100">
                    <MapContainer center={pos || [18.5204, 73.8567]} zoom={13} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      />
                      <MapResizer pos={pos} step={step} />
                      <LocationMarker pos={pos} setPos={setPos} setSource={setLocationSource} />
                    </MapContainer>
                    {!pos && (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
                        <div className="bg-slate-900/80 backdrop-blur-sm text-white px-4 py-2 rounded-full font-medium text-xs shadow-lg shadow-black/10">
                          Search or click the map to place a pin
                        </div>
                      </div>
                    )}
                  </div>

                  {pos && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm p-4 space-y-3">
                      <div className="flex items-start gap-2 mb-2">
                        <span className="text-slate-500 mt-0.5">📍</span>
                        <div>
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Selected Location</div>
                          <div className="text-sm text-slate-900 font-medium leading-snug">
                            {address ? address : <span className="text-amber-600">Address unavailable (coordinates verified)</span>}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-3">
                        <div>
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Location Source</div>
                          <div className="text-sm font-bold text-emerald-700">{locationSource}</div>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Coordinates</div>
                          <div className="text-sm font-mono text-slate-900">{`${pos[0].toFixed(5)}, ${pos[1].toFixed(5)}`}</div>
                        </div>
                        {accuracy !== null && (
                          <div className="flex gap-4 col-span-2">
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
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column — Report Details */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-sm">
                  <h3 className="font-bold text-slate-900 text-xl mb-1">Report Details</h3>
                  <p className="text-slate-500 text-sm mb-6">Add a few details to help the municipality understand the issue.</p>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-2">Description</label>
                      <textarea
                        className="w-full border border-slate-300 rounded-xl text-sm p-4 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                        rows={4}
                        placeholder="Add any helpful details about the issue..."
                        value={desc}
                        onChange={e => setDesc(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1">How severe does this issue appear to you?</label>
                      <p className="text-xs text-slate-500 mb-3">Choose the level that best reflects the urgency you see.</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { val: 'low', label: 'Low', color: 'emerald' },
                          { val: 'medium', label: 'Medium', color: 'amber' },
                          { val: 'high', label: 'High', color: 'red' }
                        ].map(opt => {
                          const isSel = severity === opt.val;
                          return (
                            <button
                              key={opt.val}
                              type="button"
                              onClick={() => setSeverity(opt.val)}
                              className={`py-3 px-2 rounded-xl text-sm font-bold border transition-colors ${
                                isSel
                                  ? `bg-${opt.color}-50 border-${opt.color}-500 text-${opt.color}-700 ring-1 ring-${opt.color}-500 shadow-sm`
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {opt.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Location / Service Area Status */}
                {routingPreview && (
                  <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-sm">
                    {routingPreview.assignment_status === "Not handled by PMC" || routingPreview.assignment_status === "No municipal department" ? (
                      <div>
                        <div className="flex items-center gap-2 text-amber-600 mb-2">
                          <span className="text-xl">⚠️</span>
                          <h4 className="font-bold text-slate-900">Outside Service Area</h4>
                        </div>
                        <p className="text-sm text-slate-600">This location appears to be outside the standard Pune Municipal Corporation service area.</p>
                        {routingPreview.administrative_ward_name && (
                           <div className="mt-3 text-xs font-semibold text-amber-700 bg-amber-50 py-1.5 px-3 rounded-lg inline-block">
                             Detected region: {routingPreview.administrative_ward_name}
                           </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 text-emerald-600 mb-2">
                          <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <h4 className="font-bold text-slate-900">Location recognized</h4>
                        </div>
                        <div className="text-sm text-slate-900 font-semibold mb-1 mt-3">Pune Municipal Corporation</div>
                        {routingPreview.administrative_ward_name && (
                          <div className="text-sm text-slate-600">{routingPreview.administrative_ward_name} Ward</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-200/60 relative z-10">
              <button onClick={() => setStep(1)} className="px-6 py-4 rounded-xl font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors">Back</button>
              <button
                onClick={goToReview}
                disabled={!pos || !desc.trim() || checkingAdvisories}
                className="px-8 py-4 bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-700 disabled:opacity-50 disabled:bg-slate-300 disabled:shadow-none transition-colors flex items-center justify-center min-w-[200px]"
              >
                {checkingAdvisories ? 'Checking Advisories...' : 'Review Report →'}
              </button>
            </div>

            {showAdvisoryModal && (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-8 animate-in fade-in zoom-in-95">
                  <div className="flex items-center gap-3 text-amber-600 mb-6">
                    <span className="text-4xl">⚠️</span>
                    <h3 className="text-xl font-bold text-slate-900">Active Advisory Found</h3>
                  </div>
                  <p className="text-sm text-slate-600 mb-6">
                    The municipality is already aware of issues matching your description in this area. Your report may be a duplicate of these known issues:
                  </p>
                  <div className="bg-amber-50/50 rounded-2xl p-4 mb-8 space-y-4 max-h-48 overflow-y-auto border border-amber-100">
                    {activeAdvisories.map(adv => (
                      <div key={adv.id} className="border-b border-amber-200/50 pb-3 last:border-0 last:pb-0">
                        <div className="font-bold text-amber-900 text-sm mb-1">{adv.title}</div>
                        <div className="text-xs text-amber-700/80 leading-relaxed">{adv.description}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setShowAdvisoryModal(false)}
                      className="flex-1 px-4 py-4 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      Cancel Report
                    </button>
                    <button
                      onClick={proceedToReviewStep}
                      className="flex-1 px-4 py-4 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 shadow-sm transition-colors"
                    >
                      Report Anyway
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Left Column — Issue & Location Details */}
              <div className="lg:col-span-3 space-y-6">
                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-sm">
                  <h3 className="font-bold text-slate-900 text-xl mb-1 flex items-center gap-2">
                    <span>📋</span> Review Report
                  </h3>
                  <p className="text-slate-500 text-sm mb-6">Verify the details before submitting your report.</p>

                  {/* Image & Issue */}
                  <div className="mb-8 border-b border-slate-100 pb-8">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Evidence & Issue</div>
                    <div className="flex flex-col sm:flex-row gap-6">
                      <img src={preview} className="w-full sm:w-48 h-32 object-cover rounded-2xl border border-slate-200 shadow-sm" alt="Evidence" />
                      <div className="flex-1 space-y-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-500 mb-1">Category</div>
                          <div className="text-xl font-bold text-slate-900">{confirmedCategory}</div>
                        </div>
                        {desc && (
                          <div>
                            <div className="text-sm font-semibold text-slate-500 mb-1">Description</div>
                            <div className="text-sm text-slate-700 font-medium bg-slate-50 p-3 rounded-xl border border-slate-200/60 leading-relaxed">
                              {desc}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Location Details */}
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Location Details</div>
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-4">
                      <div>
                        <div className="text-xs text-slate-500 font-semibold mb-1 uppercase tracking-wider">Address</div>
                        <div className="text-sm font-semibold text-slate-900 leading-snug">{address || 'Coordinates Only'}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200/80">
                        <div>
                          <div className="text-xs text-slate-500 font-semibold mb-1 uppercase tracking-wider">Coordinates</div>
                          <div className="text-sm font-mono text-slate-900">{`${pos![0].toFixed(5)}, ${pos![1].toFixed(5)}`}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 font-semibold mb-1 uppercase tracking-wider">Source</div>
                          <div className="text-sm font-bold text-emerald-700">{locationSource}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Possible Related Reports Section */}
                <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
                  <div className="p-5 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Possible Related Reports</span>
                    {checkingRelated && <span className="text-emerald-600 lowercase tracking-normal flex items-center gap-1.5 font-medium text-sm">
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
                      Checking...
                    </span>}
                  </div>
                  <div className="p-5 md:p-6">
                    {!checkingRelated && relatedError && (
                      <div className="text-sm text-amber-700 bg-amber-50 p-4 rounded-xl border border-amber-200/60 flex items-start gap-3">
                        <span className="text-xl leading-none">⚠️</span>
                        <span>{relatedError}</span>
                      </div>
                    )}
                    {!checkingRelated && !relatedError && relatedReports?.length === 0 && (
                      <div className="text-sm text-slate-500 font-medium text-center py-4">No similar recent reports found nearby.</div>
                    )}
                    {!checkingRelated && !relatedError && relatedReports?.length > 0 && (
                      <div className="space-y-4">
                        <div className="text-sm font-medium text-amber-800 bg-amber-50/80 p-4 rounded-xl border border-amber-200/60 leading-relaxed">
                          We found {relatedReports?.length} recent {relatedReports?.length === 1 ? 'report' : 'reports'} nearby that might be related to yours. You can still submit your report if it's a different issue.
                        </div>
                        <div className="grid gap-3">
                          {relatedReports?.map(r => (
                            <div key={r.public_id} className="border border-slate-200/80 rounded-xl p-4 bg-white hover:border-slate-300 transition-colors shadow-sm relative overflow-hidden group">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <div className="font-mono font-bold text-slate-900">{r.public_id}</div>
                                  <div className="text-emerald-700 font-bold capitalize text-xs mt-0.5">{r.status.replace(/_/g, ' ')}</div>
                                </div>
                                <div className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg font-bold border border-slate-200/80">{Math.round(r.distance_meters)}m away</div>
                              </div>
                              <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 leading-relaxed">
                                <strong className="text-slate-900">Reasons:</strong> {r.match_reasons.join(' • ')}
                              </div>
                              <Link
                                to={`/complaints/${r.public_id}?view=public`}
                                state={{ from: "/report" }}
                                onClick={() => {
                                  sessionStorage.setItem('report_draft_state', JSON.stringify({
                                    step, desc, pos, address, locationSource, accuracy, confirmedCategory, severity, relatedReports
                                  }));
                                }}
                                className="mt-4 flex items-center justify-center text-xs font-bold bg-slate-50 border border-slate-200 text-slate-700 py-2.5 rounded-lg group-hover:bg-emerald-50 group-hover:text-emerald-700 group-hover:border-emerald-200 transition-all">
                                View Complaint &rarr;
                              </Link>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column — Routing & Submission */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
                  <div className="p-6 bg-slate-50/50 border-b border-slate-100">
                    <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                      <span>🏢</span> Routing Destination
                    </h3>
                  </div>

                  <div className="p-6">
                    {loadingPreview ? (
                      <div className="flex flex-col items-center justify-center py-8 text-slate-500 space-y-4">
                        <svg className="animate-spin h-8 w-8 text-emerald-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
                        <span className="font-semibold text-sm">Determining jurisdiction...</span>
                      </div>
                    ) : routingPreview && (
                      <div className="space-y-4">
                        <div className={`p-4 rounded-xl border ${routingPreview.authority === 'PMC' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-amber-50/50 border-amber-100'}`}>
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Service Area</div>
                          <div className={`text-base font-bold ${routingPreview.authority === 'PMC' ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {routingPreview.authority === 'PMC' ? 'Pune Municipal Corporation' : 'Outside PMC'}
                          </div>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/60 space-y-3">
                          <div className="flex justify-between items-center pb-3 border-b border-slate-200/60">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Authority</span>
                            <span className="font-bold text-slate-900 text-sm">{routingPreview.authority || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between items-center pb-3 border-b border-slate-200/60">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Department</span>
                            <span className="font-bold text-slate-900 text-sm text-right max-w-[140px] truncate">{routingPreview.department_name || 'Unassigned'}</span>
                          </div>
                          <div className="flex justify-between items-center pb-3 border-b border-slate-200/60">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Admin Ward</span>
                            <span className="font-bold text-slate-900 text-sm text-right max-w-[140px] truncate">{routingPreview.administrative_ward_name || routingPreview.administrative_ward_office || 'N/A'}</span>
                          </div>
                          <div className="pt-1">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Assignment Status</div>
                            <div className={`text-sm font-bold ${routingPreview.assignment_status.includes('Not handled') ? 'text-amber-700' : 'text-indigo-700'}`}>
                              {routingPreview.assignment_status}
                            </div>
                            {routingPreview.assignment_status === 'Ward Office / Manual Triage' && (
                              <div className="text-xs text-slate-500 mt-2 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200">
                                No verified individual municipal officer is currently assigned.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Analysis Badges */}
                {analysis && confirmedCategory === analysis.category_name && (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">AI Analysis Metadata</div>
                    <div className="flex flex-wrap gap-2">
                      <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
                        <span className="text-slate-500 font-semibold">Confidence</span>
                        <span className="font-bold text-slate-900">{(analysis.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
                        <span className="text-slate-500 font-semibold">Provider</span>
                        <span className="font-bold text-slate-900">{analysis.provider === 'gemini' ? 'Gemini' : analysis.provider === 'local' ? 'Local Fallback' : analysis.provider}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-200/60 relative z-10">
              <button onClick={() => setStep(2)} disabled={submitting} className="px-6 py-4 rounded-xl font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-colors">Back</button>
              <button
                onClick={submitComplaint}
                disabled={submitting || loadingPreview}
                className="px-8 py-4 bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-700 disabled:opacity-50 disabled:bg-slate-300 disabled:shadow-none transition-colors flex items-center justify-center min-w-[240px] gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Submitting...
                  </>
                ) : (
                  'Submit Report →'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </CitizenLayout>
  )
}
