import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { AlertTriangle, Search, Filter, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AdvisoryModal from '../components/AdvisoryModal';
import { DashboardLayout } from '../components/DashboardLayout';
import { Nav } from '../components/Nav';

interface Advisory {
  id: string;
  public_id: string;
  title: string;
  description: string;
  category_id: string | null;
  ward_id: string | null;
  starts_at: string;
  expires_at: string;
  status: string;
}

export function CivicAlertsPage() {
  const { user, token } = useAuth();
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modal State
  const [selectedAdvisory, setSelectedAdvisory] = useState<Advisory | null>(null);

  useEffect(() => {
    fetchMetadata();
    fetchAdvisories();
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
      console.error("Failed to load metadata", err);
    }
  };

  const fetchAdvisories = async () => {
    try {
      setLoading(true);
      const res = await api<Advisory[]>('/advisories?active_only=true');
      setAdvisories(res);
      setError(null);
    } catch (err: any) {
      setError('Failed to load civic alerts. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryName = (id?: string | null) => {
    if (!id) return null;
    const cat = categories.find(c => c.id === id);
    return cat ? cat.name : 'Category';
  };

  const getWardName = (id?: string | null) => {
    if (!id) return 'Global';
    const ward = wards.find(w => w.id === id);
    return ward ? `Ward ${ward.ward_number}` : 'Ward';
  };

  const filteredAdvisories = useMemo(() => {
    return advisories.filter(adv => {
      // Search
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = adv.title.toLowerCase().includes(searchLower) || adv.description.toLowerCase().includes(searchLower);

      // Ward Filter
      let matchesWard = true;
      if (selectedWard === 'my_ward' && user?.ward_id) {
        matchesWard = adv.ward_id === user.ward_id || adv.ward_id === null; // Global is visible
      } else if (selectedWard !== 'all' && selectedWard !== 'my_ward') {
        matchesWard = adv.ward_id === selectedWard || adv.ward_id === null; // Global is visible
      }

      // Category Filter
      let matchesCategory = true;
      if (selectedCategory !== 'all') {
        matchesCategory = adv.category_id === selectedCategory;
      }

      return matchesSearch && matchesWard && matchesCategory;
    });
  }, [advisories, searchQuery, selectedWard, selectedCategory, user]);

  const hasVerifiedWard = Boolean(user?.ward_id);

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center">
          <AlertTriangle className="mr-3 h-8 w-8 text-amber-500" />
          Civic Alerts
        </h1>
        <p className="text-slate-600 mt-2">Stay updated on important civic advisories, disruptions, and notices across Pune.</p>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-8 space-y-4 md:space-y-0 md:flex md:gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search alerts by title or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
          />
        </div>

        <div className="flex gap-4">
          <select
            value={selectedWard}
            onChange={(e) => setSelectedWard(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All Wards</option>
            {hasVerifiedWard && <option value="my_ward">My Ward</option>}
            {wards.map(w => (
              <option key={w.id} value={w.id}>Ward {w.ward_number}</option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-amber-500" />
          Loading alerts...
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200 text-center">
          {error}
        </div>
      ) : filteredAdvisories.length === 0 ? (
        <div className="bg-slate-50 py-16 px-4 text-center rounded-xl border border-slate-200">
          <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900">No active alerts found</h3>
          <p className="text-slate-500 mt-1">There are no civic alerts matching your filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredAdvisories.map(adv => (
            <div key={adv.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-1 rounded-md">
                  {getWardName(adv.ward_id)}
                </span>
                {getCategoryName(adv.category_id) && (
                  <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                    {getCategoryName(adv.category_id)}
                  </span>
                )}
              </div>
              <h3 className="font-bold text-lg text-slate-900 mb-2 line-clamp-2">{adv.title}</h3>
              <p className="text-slate-600 text-sm mb-4 line-clamp-3 flex-1">{adv.description}</p>

              <button
                onClick={() => setSelectedAdvisory(adv)}
                className="text-amber-700 font-medium text-sm hover:text-amber-800 flex items-center mt-auto self-start"
              >
                Read Full Advisory &rarr;
              </button>
            </div>
          ))}
        </div>
      )}

      <AdvisoryModal
        advisory={selectedAdvisory}
        isOpen={!!selectedAdvisory}
        onClose={() => setSelectedAdvisory(null)}
        getCategoryName={getCategoryName}
        getWardName={getWardName}
        isAdminView={false}
      />
    </div>
  );
}
