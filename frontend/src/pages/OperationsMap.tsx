import React, { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { DashboardLayout } from '../components/DashboardLayout'
import { MapFilters } from '../components/MapFilters'
import { OperationsSidebar } from '../components/OperationsSidebar'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import type { MapComplaint, Hotspot, WardSummary } from '../types'

// Custom CivicConnect Marker
const CivicIcon = L.divIcon({
  html: `<div class="relative flex items-center justify-center w-8 h-8">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-red-600 drop-shadow-md">
             <path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
           </svg>
         </div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
})

const createClusterCustomIcon = function (cluster: any) {
  const count = cluster.getChildCount();
  return L.divIcon({
    html: `<div class="bg-red-600 bg-opacity-90 text-white font-bold rounded-full w-10 h-10 flex items-center justify-center border-2 border-white shadow-lg ring-2 ring-red-500 ring-opacity-50">${count}</div>`,
    className: 'custom-marker-cluster',
    iconSize: [40, 40]
  });
}

// Helper component to center map
function FitBounds({ complaints, center, zoom }: { complaints: MapComplaint[], center: [number, number], zoom: number }) {
  const map = useMap()
  useEffect(() => {
    const validComplaints = complaints.filter(c => c.latitude !== null && c.longitude !== null)
    if (validComplaints.length > 0) {
      const bounds = L.latLngBounds(validComplaints.map(c => [c.latitude!, c.longitude!]))
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
    } else {
      map.setView(center, zoom)
    }
  }, [complaints, center, zoom, map])
  return null
}

export default function OperationsMap() {
  const { token, user } = useAuth()
  
  const [complaints, setComplaints] = useState<MapComplaint[]>([])
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [wardSummaries, setWardSummaries] = useState<WardSummary[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filters
  const [status, setStatus] = useState('')
  const [severity, setSeverity] = useState('')
  const [category, setCategory] = useState('')
  const [ward, setWard] = useState('')
  const [department, setDepartment] = useState('')
  const [authority, setAuthority] = useState('')

  const [mapCenter, setMapCenter] = useState<[number, number]>([18.5204, 73.8567])
  const [mapZoom, setMapZoom] = useState(12)

  // Fetch filter metadata once on mount
  useEffect(() => {
    if (!token) return
    Promise.all([
      api<any[]>('/categories', token),
      api<any[]>('/departments', token)
    ]).then(([catRes, depRes]) => {
      setCategories(catRes)
      setDepartments(depRes)
    }).catch(console.error)
  }, [token])

  const fetchData = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    
    try {
      // Build query string
      const params = new URLSearchParams()
      if (status) params.append('status', status)
      if (severity) params.append('severity', severity)
      if (category) params.append('category_id', category)
      if (ward) params.append('administrative_ward_name', ward)
      if (department) params.append('department_id', department)
      if (authority) params.append('authority', authority)
      
      const query = params.toString() ? `?${params.toString()}` : ''

      const [mapRes, hotspotRes, wardRes] = await Promise.all([
        api<MapComplaint[]>(`/admin/complaints/map${query}`, token),
        api<Hotspot[]>(`/admin/hotspots${query}`, token),
        api<WardSummary[]>('/admin/ward-summary', token)
      ])

      setComplaints(mapRes)
      setHotspots(hotspotRes)
      setWardSummaries(wardRes)

    } catch (err: any) {
      setError("Unable to load operations map. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [status, severity, category, ward, department, authority, token])

  const clearFilters = () => {
    setStatus('')
    setSeverity('')
    setCategory('')
    setWard('')
    setDepartment('')
    setAuthority('')
    setMapCenter([18.5204, 73.8567])
    setMapZoom(12)
  }

  const handleHotspotSelect = (lat: number, lng: number, radius: number) => {
    setMapCenter([lat, lng])
    setMapZoom(17)
  }

  const handleWardSelect = (w: string) => {
    setWard(w)
  }

  if (user?.role !== 'administrator') {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-red-500 font-medium">Access Denied: Administrators only.</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-80px)] -m-4 sm:-m-6 lg:-m-8">
        
        {/* Banner */}
        <div className="bg-amber-50 border-b border-amber-200 p-2 text-center text-xs text-amber-800 font-medium z-10">
          Live PMC GIS refresh unavailable; using last verified database snapshot (41 Geographic Wards, 15 Administrative Ward Offices).
        </div>

        {/* Content Split */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main Map Area */}
          <div className="flex-1 flex flex-col p-4 bg-gray-50/50">
            <div className="mb-0">
              <MapFilters 
                status={status} setStatus={setStatus}
                severity={severity} setSeverity={setSeverity}
                category={category} setCategory={setCategory}
                ward={ward} setWard={setWard}
                department={department} setDepartment={setDepartment}
                authority={authority} setAuthority={setAuthority}
                categories={categories}
                departments={departments}
                wards={wardSummaries}
                onClear={clearFilters}
              />
            </div>

            <div className="flex-1 relative rounded-xl overflow-hidden border border-gray-200 shadow-inner min-h-[400px]">
              {loading && (
                <div className="absolute inset-0 bg-white/70 z-[1000] flex items-center justify-center backdrop-blur-sm">
                  <div className="text-primary font-medium flex items-center gap-2">
                    <span className="loading loading-spinner loading-md"></span>
                    Loading operations map...
                  </div>
                </div>
              )}
              
              {error && !loading && (
                <div className="absolute inset-0 bg-red-50 z-[1000] flex items-center justify-center">
                  <div className="text-red-600 font-medium">{error}</div>
                </div>
              )}

              {!loading && !error && complaints.length === 0 && (
                <div className="absolute inset-0 bg-gray-50 z-[1000] flex items-center justify-center">
                  <div className="text-gray-500 font-medium">No complaints with valid coordinates found for current filters.</div>
                </div>
              )}

              <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%' }}>
                <FitBounds complaints={complaints} center={mapCenter} zoom={mapZoom} />
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
                />
                
                <MarkerClusterGroup chunkedLoading maxClusterRadius={50} iconCreateFunction={createClusterCustomIcon}>
                  {complaints.filter(c => c.latitude !== null && c.longitude !== null).map(c => (
                    <Marker key={c.id} position={[c.latitude, c.longitude]} icon={CivicIcon}>
                      <Popup className="operations-popup">
                        <div className="min-w-[200px]">
                          <div className="font-bold border-b pb-1 mb-2 text-gray-800 flex justify-between items-center">
                            <span>{c.public_id}</span>
                            <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded font-semibold uppercase">{c.status}</span>
                          </div>
                          
                          <div className="text-sm space-y-1 mb-3">
                            <p><span className="font-semibold text-gray-600">Category:</span> {c.category_name || 'Not determined'}</p>
                            <p><span className="font-semibold text-gray-600">Severity:</span> <span className="uppercase text-xs">{c.severity}</span></p>
                            
                            <hr className="my-1"/>
                            
                            <p><span className="font-semibold text-gray-600">Admin Ward:</span> {c.administrative_ward_name || 'Not determined'}</p>
                            <p><span className="font-semibold text-gray-600">Geo Ward:</span> {c.geographic_ward_number || 'Not determined'}</p>
                            <p><span className="font-semibold text-gray-600">Zone:</span> {c.administrative_zone || 'Not determined'}</p>
                            
                            <hr className="my-1"/>
                            
                            <p><span className="font-semibold text-gray-600">Authority:</span> {c.authority || 'Not determined'}</p>
                            <p><span className="font-semibold text-gray-600">Dept:</span> {c.department_name || 'Not determined'}</p>
                            <p><span className="font-semibold text-gray-600">Officer:</span> {c.officer_name || 'Awaiting assignment'}</p>
                          </div>
                          <a href={`/admin/complaints/${c.public_id}`} target="_blank" rel="noopener noreferrer" className="block w-full text-center py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-medium text-xs rounded transition-colors">
                            View Complaint &rarr;
                          </a>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MarkerClusterGroup>
              </MapContainer>
            </div>
          </div>

          {/* Sidebar */}
          <OperationsSidebar 
            hotspots={hotspots}
            wardSummaries={wardSummaries}
            onWardSelect={handleWardSelect}
            onHotspotSelect={handleHotspotSelect}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}
