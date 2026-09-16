import math
from typing import Any

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in meters between two coordinates."""
    R = 6371000  # radius of Earth in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def calculate_hotspots(complaints: list[Any], radius_meters: float = 200.0) -> list[dict]:
    """
    Cluster complaints deterministically.
    complaints should be a list of objects or dicts with:
    - id
    - category_name
    - latitude
    - longitude
    - status
    - severity
    - administrative_ward_name
    - administrative_zone
    """
    hotspots = []
    
    # Group by category
    by_category = {}
    for c in complaints:
        cat = c.category_name if hasattr(c, "category_name") else c.get("category_name")
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(c)

    # Cluster within each category
    for cat, items in by_category.items():
        clusters = [] # list of lists of complaints
        
        for item in items:
            lat = item.latitude if hasattr(item, "latitude") else item.get("latitude")
            lon = item.longitude if hasattr(item, "longitude") else item.get("longitude")
            if lat is None or lon is None:
                continue
                
            placed = False
            for cluster in clusters:
                # check distance to first item in cluster as center
                clat = cluster[0].latitude if hasattr(cluster[0], "latitude") else cluster[0].get("latitude")
                clon = cluster[0].longitude if hasattr(cluster[0], "longitude") else cluster[0].get("longitude")
                
                if haversine_distance(lat, lon, clat, clon) <= radius_meters:
                    cluster.append(item)
                    placed = True
                    break
            
            if not placed:
                clusters.append([item])
                
        # Format hotspots
        for i, cluster in enumerate(clusters):
            if len(cluster) < 2: continue
            
            # Calculate centroid
            clat = sum((c.latitude if hasattr(c, "latitude") else c.get("latitude")) for c in cluster) / len(cluster)
            clon = sum((c.longitude if hasattr(c, "longitude") else c.get("longitude")) for c in cluster) / len(cluster)
            
            open_count = 0
            resolved_count = 0
            status_brk = {}
            sev_brk = {}
            wards = set()
            zones = set()
            
            for c in cluster:
                status_val = c.status if hasattr(c, "status") else c.get("status")
                status = status_val.name if hasattr(status_val, "name") else str(status_val)
                
                sev_val = c.severity if hasattr(c, "severity") else c.get("severity")
                sev = sev_val.name if hasattr(sev_val, "name") else str(sev_val)
                
                status_brk[status] = status_brk.get(status, 0) + 1
                sev_brk[sev] = sev_brk.get(sev, 0) + 1
                
                if status in ("RESOLVED", "resolved", "CLOSED", "closed"):
                    resolved_count += 1
                else:
                    open_count += 1
                    
                w = c.administrative_ward_name if hasattr(c, "administrative_ward_name") else c.get("administrative_ward_name")
                if w: wards.add(w)
                
                z = c.administrative_zone if hasattr(c, "administrative_zone") else c.get("administrative_zone")
                if z: zones.add(z)
                
            hotspots.append({
                "id": f"hotspot_{cat}_{i}",
                "latitude": clat,
                "longitude": clon,
                "radius_meters": radius_meters,
                "category_name": cat,
                "complaint_count": len(cluster),
                "open_count": open_count,
                "resolved_count": resolved_count,
                "status_breakdown": status_brk,
                "severity_breakdown": sev_brk,
                "administrative_wards": list(wards),
                "zones": list(zones)
            })
            
    return hotspots
