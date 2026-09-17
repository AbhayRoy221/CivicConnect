import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { AlertTriangle, Clock, ArrowRight } from 'lucide-react';
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

  const getCategoryName = (id?: string) => {
    if (!id) return null;
    const cat = categories.find(c => c.id === id);
    return cat ? cat.name : 'Category';
  };

  const getWardName = (id?: string) => {
    if (!id) return 'Global';
    const ward = wards.find(w => w.id === id);
    return ward ? `Ward ${ward.ward_number}` : 'Ward';
  };

  if (alerts.length === 0) return null;

  const displayAlerts = alerts.slice(0, 3);

  return (
    <div className="bg-amber-50 border-l-4 border-amber-400 p-4 my-6 rounded-r-md shadow-sm">
      <div className="flex">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-amber-400" aria-hidden="true" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-amber-800">Active Civic Alerts</h3>
          <div className="mt-2 text-sm text-amber-700">
            <ul className="space-y-3">
              {displayAlerts.map((alert) => (
                <li key={alert.id} className="bg-white/60 p-2 rounded border border-amber-200/50">
                  <div className="font-bold flex items-center justify-between">
                    <span>{alert.title}</span>
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                      {getWardName(alert.ward_id)}
                    </span>
                  </div>
                  <div className="text-xs mt-1 text-amber-900/80 line-clamp-2">
                    {alert.description}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-4">
            <Link
              to="/civic-alerts"
              className="text-sm font-medium text-amber-800 hover:text-amber-900 flex items-center"
            >
              View All Civic Alerts <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
