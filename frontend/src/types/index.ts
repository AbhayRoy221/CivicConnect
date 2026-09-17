/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
export type User = {
  id: string
  name: string
  email: string
  role: 'citizen' | 'municipal_officer' | 'administrator'
  department_id?: string
  department_name?: string
  ward_name?: string
  phone?: string
  language: string
  created_at: string
}

export type Category = { id: string; name: string; description: string }
export type Department = { id: string; name: string; description: string; authority?: string }
export type DuplicateLink = { id: string; possible_duplicate_id: string; similarity_score: number; status: string }

export type Complaint = {
  id: string
  public_id: string
  category?: Category
  category_id?: string
  category_name?: string
  description: string
  image_url: string
  latitude: number
  longitude: number
  address: string
  severity: string
  status: string
  created_at: string
  resolved_at?: string
  department?: Department
  department_id?: string
  department_name?: string
  authority?: string
  citizen?: User
  citizen_id?: string
  officer?: User
  officer_id?: string
  officer_name?: string
  is_escalated: boolean
  upvotes: number
  duplicates?: DuplicateLink[]
  ward_name?: string
  geographic_ward_number?: number
  administrative_ward_name?: string
  administrative_ward_office?: string
  administrative_zone?: string
  resolution_evidence?: ResolutionEvidence
  sla_due_at?: string
  citizen_reported_severity?: string
  system_assessed_severity?: string
  priority_score?: number
  priority_reasons?: any[]
  admin_priority_override?: number
  admin_priority_remarks?: string
  effective_priority?: number
  is_sla_breached?: boolean
  is_sla_approaching?: boolean
}

export type ResolutionEvidence = {
  id: string
  image_url: string
  remarks: string
  created_at: string
}

export type ComplaintHistory = {
  id: string
  old_status: string
  new_status: string
  remarks: string
  timestamp: string
  changed_by_user?: User
}

export type AuditLog = {
  id: string
  action: string
  entity_type: string
  entity_id: string
  timestamp: string
  actor?: User
  actor_id?: string
  metadata?: any
  metadata_json?: any
}

export type Notification = {
  id: string
  title: string
  message: string
  is_read: boolean
  created_at: string
  complaint_id?: string
}

export type RoutingPreview = {
  authority: string | null
  department_name: string | null
  geographic_ward_number: number | null
  administrative_ward_office: string | null
  administrative_ward_name: string | null
  administrative_zone: string | null
  assignment_status: string
}

export type AIAnalysisResponse = {
  category_name: string
  confidence: number
  rationale: string
  provider: string | null
  model: string | null
}

export type MapComplaint = {
  id: string;
  public_id: string;
  latitude: number;
  longitude: number;
  category_name: string | null;
  severity: string;
  status: string;
  geographic_ward_number: number | null;
  administrative_ward_name: string | null;
  administrative_zone: string | null;
  authority: string | null;
  department_name: string | null;
  officer_name: string | null;
}

export type Hotspot = {
  id: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  category_name: string | null;
  complaint_count: number;
  open_count: number;
  resolved_count: number;
  status_breakdown: Record<string, number>;
  severity_breakdown: Record<string, number>;
  administrative_wards: string[];
  zones: string[];
}

export type WardSummary = {
  administrative_ward_name: string;
  total_complaints: number;
  open_complaints: number;
  resolved_complaints: number;
  in_progress_complaints: number;
  overdue_complaints: number;
}
