from datetime import datetime, timezone
from app.models import Complaint, Severity

def calculate_base_priority(complaint: Complaint, related_count: int) -> tuple[int, list[dict]]:
    """
    Calculates the base/stable priority score and reasons.
    Max 35 (Severity) + 20 (Related) + 20 (Escalation) = 75.
    Returns (score, reasons_list)
    """
    score = 0
    reasons = []

    # 1. Severity (max 35)
    # Prefer final severity if assessing, otherwise citizen or system
    effective_severity = complaint.severity
    if isinstance(effective_severity, Severity):
        effective_severity = effective_severity.value
    if isinstance(effective_severity, str):
        effective_severity = effective_severity.lower()

    if effective_severity == Severity.NOT_ASSESSED.value:
        sys_sev = complaint.system_assessed_severity
        cit_sev = complaint.citizen_reported_severity
        
        if sys_sev and isinstance(sys_sev, str) and sys_sev.lower() != Severity.NOT_ASSESSED.value:
            effective_severity = sys_sev.lower()
        elif cit_sev and isinstance(cit_sev, str) and cit_sev.lower() != Severity.NOT_ASSESSED.value:
            effective_severity = cit_sev.lower()
        else:
            effective_severity = Severity.NOT_ASSESSED.value

    if effective_severity == Severity.CRITICAL.value:
        score += 35
        reasons.append({"signal": "Severity", "points": 35, "description": "Critical severity"})
    elif effective_severity == Severity.HIGH.value:
        score += 20
        reasons.append({"signal": "Severity", "points": 20, "description": "High severity"})
    elif effective_severity == Severity.MEDIUM.value:
        score += 10
        reasons.append({"signal": "Severity", "points": 10, "description": "Medium severity"})
    elif effective_severity == Severity.LOW.value:
        reasons.append({"signal": "Severity", "points": 0, "description": "Low severity"})

    # 2. Related impact (max 20)
    if related_count > 0:
        related_pts = min(related_count * 5, 20)
        score += related_pts
        reasons.append({"signal": "Related complaints", "points": related_pts, "description": f"{related_count} related complaints nearby"})

    # 3. Escalation (max 20)
    if complaint.is_escalated:
        score += 20
        reasons.append({"signal": "Escalation", "points": 20, "description": "Complaint is escalated"})

    # Clamp to 100 just in case
    score = min(score, 100)
    
    return score, reasons

def calculate_dynamic_sla_priority(complaint: Complaint) -> tuple[int, list[dict]]:
    """
    Calculates the dynamic SLA portion of the priority score.
    Max 25 pts.
    Returns (additional_score, [reason_dict])
    """
    if not complaint.sla_due_at:
        return 0, []

    now = datetime.now(timezone.utc)
    delta = complaint.sla_due_at - now
    
    if delta.total_seconds() < 0:
        return 25, [{"signal": "SLA", "points": 25, "description": "SLA overdue"}]
    elif delta.total_seconds() <= 86400: # 24h
        return 15, [{"signal": "SLA", "points": 15, "description": "SLA due within 24h"}]
    elif delta.total_seconds() <= 172800: # 48h
        return 5, [{"signal": "SLA", "points": 5, "description": "SLA due within 48h"}]
    
    return 0, []

def get_effective_priority(complaint: Complaint) -> tuple[int, list[dict], int]:
    """
    Returns (effective_priority, all_reasons, engine_priority)
    """
    base_score = complaint.base_priority_score or 0
    base_reasons = complaint.base_priority_reasons or []
    if isinstance(base_reasons, dict):
        base_reasons = [base_reasons] # fallback if it was stored weirdly
        
    sla_score, sla_reasons = calculate_dynamic_sla_priority(complaint)
    
    total_engine_score = min(base_score + sla_score, 100)
    all_reasons = base_reasons + sla_reasons

    if complaint.admin_priority_override is not None:
        # Admin override takes absolute precedence
        override_score = min(max(complaint.admin_priority_override, 0), 100)
        return override_score, all_reasons, total_engine_score
        
    return total_engine_score, all_reasons, total_engine_score
