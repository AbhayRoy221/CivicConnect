import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Advisory {
  id: string;
  public_id: string;
  title: string;
  description: string;
  starts_at: string;
  category_id?: string;
  ward_id?: string;
}

export default function CivicAlerts() {
  const [alerts, setAlerts] = useState<Advisory[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);

  useEffect(() => {
    fetchMetadata();
    fetchAlerts();
  }, []);

  const fetchMetadata = async () => {
    try {
      const [catRes, wardRes] = await Promise.all([
        api<any[]>('/categories'),
        api<any[]>('/pune-wards')
      ]);
      setCategories(catRes);
      setWards(wardRes);
    } catch (err) {
      console.error('Failed to load metadata', err);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await api<Advisory[]>('/advisories?active_only=true');
      setAlerts(res);
    } catch (err) {
      console.error('Failed to fetch advisories', err);
    }
  };

  const getWardName = (id?: string) => {
    if (!id) return 'Global';
    const ward = wards.find(w => w.id === id);
    return ward ? `Ward ${ward.ward_number}` : 'Ward';
  };

  if (alerts.length === 0) {
    return (
      <div className="bg-white/80 backdrop-blur-md border border-white/60 p-4 rounded-2xl shadow-lg flex items-center justify-between">
         <div className="flex items-center gap-2">
            <div className="bg-slate-100 p-1.5 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-semibold text-slate-500">No active alerts</h3>
         </div>
         <Link to="/civic-alerts" className="text-[10px] uppercase font-bold text-slate-400 hover:text-slate-600 transition-colors tracking-wider">
           View History
         </Link>
      </div>
    );
  }

  const displayAlerts = alerts.slice(0, 2); // Show only 2 in the compact view

  return (
    <div className="bg-white/80 backdrop-blur-md border border-white/60 p-4 rounded-2xl shadow-lg">
      <div className="flex items-center gap-2 mb-3">
        <div className="bg-amber-100 p-1.5 rounded-lg flex items-center justify-center animate-pulse">
          <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">Active Civic Alerts</h3>
      </div>

      <div className="space-y-2 mb-3">
        {displayAlerts.map((alert) => (
          <div key={alert.id} className="bg-white/60 p-2.5 rounded-xl border border-amber-200/50 hover:bg-white/80 transition-colors">
            <div className="flex items-center justify-between mb-1 gap-2">
              <span className="font-semibold text-xs text-slate-800 line-clamp-1">{alert.title}</span>
              <span className="text-[10px] font-medium bg-amber-100/80 text-amber-800 px-2 py-0.5 rounded-full whitespace-nowrap">
                {getWardName(alert.ward_id)}
              </span>
            </div>
            <div className="text-[10px] text-slate-600 line-clamp-2 leading-relaxed">
              {alert.description}
            </div>
          </div>
        ))}
      </div>

      <Link
        to="/civic-alerts"
        className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1 w-fit group"
      >
        View All Civic Alerts <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
}
