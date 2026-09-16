import React from 'react'
import type { Hotspot, WardSummary } from '../types'

interface OperationsSidebarProps {
  hotspots: Hotspot[]
  wardSummaries: WardSummary[]
  onWardSelect: (ward: string) => void
  onHotspotSelect: (lat: number, lng: number, radius: number) => void
}

export const OperationsSidebar: React.FC<OperationsSidebarProps> = ({ hotspots, wardSummaries, onWardSelect, onHotspotSelect }) => {
  return (
    <div className="w-80 bg-white border-l border-gray-200 h-full overflow-y-auto flex flex-col">
      <div className="p-4 border-b border-gray-100 bg-gray-50/50">
        <h2 className="font-semibold text-gray-800">Potential Complaint Hotspots</h2>
        <p className="text-xs text-gray-500 mt-1">Clustered complaints within 200m</p>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {hotspots.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 italic">
            No potential complaint hotspots identified.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {hotspots.map(h => (
              <div 
                key={h.id} 
                className="p-4 hover:bg-red-50/50 cursor-pointer transition-colors"
                onClick={() => onHotspotSelect(h.latitude, h.longitude, h.radius_meters)}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-red-700">{h.category_name || "Uncategorized"}</span>
                  <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-bold">
                    {h.complaint_count}
                  </span>
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  <span className="font-semibold text-gray-700">Wards:</span> {h.administrative_wards.length > 0 ? h.administrative_wards.join(", ") : "Unknown"}
                </div>
                <div className="flex gap-4 text-xs mb-3">
                  <span className="text-gray-500">Open: <span className="font-medium text-gray-800">{h.open_count}</span></span>
                  <span className="text-gray-500">Resolved: <span className="font-medium text-gray-800">{h.resolved_count}</span></span>
                </div>
                <button 
                  className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    onHotspotSelect(h.latitude, h.longitude, h.radius_meters);
                  }}
                >
                  View complaints &rarr;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-y border-gray-100 bg-gray-50/50">
        <h2 className="font-semibold text-gray-800">Ward Summary</h2>
        <p className="text-xs text-gray-500 mt-1">Click to filter map</p>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {wardSummaries.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 italic">
            No ward data available.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {wardSummaries.map(w => (
              <div 
                key={w.administrative_ward_name} 
                className="p-4 hover:bg-primary/5 cursor-pointer transition-colors"
                onClick={() => onWardSelect(w.administrative_ward_name)}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-gray-800">{w.administrative_ward_name}</span>
                  <span className="text-xs font-bold text-gray-500">Total: {w.total_complaints}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-orange-50 text-orange-700 rounded px-2 py-1">
                    Open: <span className="font-semibold">{w.open_complaints}</span>
                  </div>
                  <div className="bg-green-50 text-green-700 rounded px-2 py-1">
                    Resolved: <span className="font-semibold">{w.resolved_complaints}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
