import React from 'react'

interface MapFiltersProps {
  status: string
  setStatus: (v: string) => void
  severity: string
  setSeverity: (v: string) => void
  category: string
  setCategory: (v: string) => void
  ward: string
  setWard: (v: string) => void
  department: string
  setDepartment: (v: string) => void
  authority: string
  setAuthority: (v: string) => void
  onClear: () => void
  categories: any[]
  departments: any[]
  wards: any[]
}

export const MapFilters: React.FC<MapFiltersProps> = ({
  status, setStatus, severity, setSeverity, category, setCategory, ward, setWard, department, setDepartment, authority, setAuthority, onClear, categories, departments, wards
}) => {
  return (
    <div className="bg-white p-4 rounded-xl shadow border border-gray-100 flex flex-wrap gap-4 items-end mb-6">
      <div className="flex flex-col gap-1 min-w-[150px] flex-1">
        <label htmlFor="filter-status" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</label>
        <select id="filter-status" value={status} onChange={e => setStatus(e.target.value)} className="input input-sm h-10 w-full border border-gray-200 rounded-lg px-3 outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">All Statuses</option>
          <option value="submitted">Submitted</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      
      <div className="flex flex-col gap-1 min-w-[150px] flex-1">
        <label htmlFor="filter-severity" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Severity</label>
        <select id="filter-severity" value={severity} onChange={e => setSeverity(e.target.value)} className="input input-sm h-10 w-full border border-gray-200 rounded-lg px-3 outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">All Severities</option>
          <option value="not_assessed">Not Assessed</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      <div className="flex flex-col gap-1 min-w-[150px] flex-1">
        <label htmlFor="filter-category" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</label>
        <select id="filter-category" value={category} onChange={e => setCategory(e.target.value)} className="input input-sm h-10 w-full border border-gray-200 rounded-lg px-3 outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">All Categories</option>
          {categories.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1 min-w-[150px] flex-1">
        <label htmlFor="filter-ward" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Administrative Ward</label>
        <select id="filter-ward" value={ward} onChange={e => setWard(e.target.value)} className="input input-sm h-10 w-full border border-gray-200 rounded-lg px-3 outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">All Wards</option>
          {wards.map((w: any) => (
            <option key={w.administrative_ward_name} value={w.administrative_ward_name}>{w.administrative_ward_name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1 min-w-[150px] flex-1">
        <label htmlFor="filter-department" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</label>
        <select id="filter-department" value={department} onChange={e => setDepartment(e.target.value)} className="input input-sm h-10 w-full border border-gray-200 rounded-lg px-3 outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">All Departments</option>
          {departments.map((d: any) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1 min-w-[150px] flex-1">
        <label htmlFor="filter-authority" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Authority</label>
        <select id="filter-authority" value={authority} onChange={e => setAuthority(e.target.value)} className="input input-sm h-10 w-full border border-gray-200 rounded-lg px-3 outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">All Authorities</option>
          <option value="PMC">PMC</option>
          <option value="PUNE_TRAFFIC_POLICE">Pune Traffic Police</option>
          <option value="NONE">None</option>
        </select>
      </div>

      <button onClick={onClear} className="btn bg-gray-100 hover:bg-gray-200 text-gray-700 h-10 px-6 rounded-lg font-medium transition-colors whitespace-nowrap">
        Clear Filters
      </button>
    </div>
  )
}
