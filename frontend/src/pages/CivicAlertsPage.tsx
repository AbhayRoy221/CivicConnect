import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { AlertTriangle, Search, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AdvisoryModal from '../components/AdvisoryModal';
import { CitizenLayout } from '../components/CitizenLayout';

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
    <CitizenLayout>
      <div className="w-full pb-12 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* HERO SECTION */}
        <div className="relative rounded-[32px] overflow-hidden shadow-sm border border-slate-200 bg-white mb-6 w-full">
          <img 
            src="/assets/civic-alerts/civic-alerts-hero.png" 
            alt="Civic Alerts Background" 
            className="w-full h-auto block"
          />
        </div>

        {/* Filters */}
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-200 mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search alerts by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none text-slate-700 placeholder:text-slate-400 text-sm font-medium transition"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 shrink-0">
            <select
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 text-slate-700 text-sm font-semibold transition"
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
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 text-slate-700 text-sm font-semibold transition"
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-8 rounded-3xl text-center border border-red-100">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-bold mb-2">Something went wrong</h3>
            <p>{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-6 px-6 py-2 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition"
            >
              Try Again
            </button>
          </div>
        ) : filteredAdvisories.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl text-center border border-slate-200 shadow-sm">
            <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">No active alerts</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              There are currently no civic alerts matching your filters.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
            {filteredAdvisories.map(adv => (
              <div key={adv.id} className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm hover:shadow-lg hover:border-emerald-200 transition-all duration-300 flex flex-col">
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
                    adv.status === 'ACTIVE' ? 'bg-rose-100 text-rose-800' :
                    adv.status === 'CANCELLED' ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {adv.status}
                  </span>
                  <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg">
                    {getWardName(adv.ward_id)}
                  </span>
                  {getCategoryName(adv.category_id) && (
                    <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg truncate max-w-[200px]">
                      {getCategoryName(adv.category_id)}
                    </span>
                  )}
                </div>
                
                <h3 className="font-extrabold text-xl text-slate-900 mb-2 line-clamp-2 leading-tight">{adv.title}</h3>
                <p className="text-slate-600 text-[15px] leading-relaxed mb-6 line-clamp-3 flex-1">{adv.description}</p>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100 mt-auto">
                  <div className="text-xs font-medium text-slate-500 space-y-1">
                    <div>Starts: <span className="text-slate-700">{new Date(adv.starts_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
                    <div>Expires: <span className="text-slate-700">{new Date(adv.expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
                  </div>
                  
                  <button
                    onClick={() => setSelectedAdvisory(adv)}
                    className="inline-flex justify-center items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 hover:border-slate-300 transition shrink-0"
                  >
                    Read Full Advisory &rarr;
                  </button>
                </div>
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
    </CitizenLayout>
  );
}
