import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { api } from '../services/api';
import type { Complaint } from '../types';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import AdvisoryModal from '../components/AdvisoryModal';
import { CitizenLayout } from '../components/CitizenLayout';

import {
  LayoutDashboard,
  PlusCircle,
  FileText,
  BellRing,
  Award,
  LogOut,
  ShieldCheck,
  Search,
  Bell,
  ChevronDown,
  Sparkles,
  ArrowRight,
  MapPin,
  FolderCheck,
  Clock3,
  CheckCircle2,
  Hourglass,
  Camera,
  ChevronRight,
  Database,
  AlertTriangle,
  Map as MapIcon,
  Sprout
} from 'lucide-react';

// Fix Leaflet default icon issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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

export function CitizenDashboard() {
  const { user, token, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [selectedAdvisory, setSelectedAdvisory] = useState<Advisory | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api<Complaint[]>('/complaints/my', token),
      api<Advisory[]>('/advisories?active_only=true')
    ]).then(([compRes, advRes]) => {
      // Sort complaints by date descending
      const sorted = [...compRes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setComplaints(sorted);
      setAdvisories(advRes);
    }).catch(err => {
      console.error('Failed to load dashboard data', err);
    }).finally(() => {
      setLoading(false);
    });
  }, [token]);

  const metrics = {
    submitted: complaints.length,
    inProgress: complaints.filter(c => ['in_progress', 'assigned', 'acknowledged'].includes(c.status)).length,
    resolved: complaints.filter(c => c.status === 'resolved').length,
    pending: complaints.filter(c => c.status === 'pending').length,
  };

  const recentReports = complaints.slice(0, 3);
  const topAdvisory = advisories.length > 0 ? advisories[0] : null;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const createStatusIcon = (status: string) => {
    let color = '#f59e0b'; // amber
    if (status === 'resolved') color = '#059669'; // emerald
    if (status === 'pending') color = '#f43f5e'; // rose

    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });
  };

  return (
    <>
      <CitizenLayout>
        {/* 3. HERO / WELCOME AREA */}
          <div className="relative rounded-3xl overflow-hidden shadow-md border border-emerald-900/10 min-h-[260px] flex items-center bg-slate-900">
            {/* Hero Background Image */}
            <img
              src="/assets/dashboard/citizen-dashboard-hero.png"
              alt="NagarMitra City Panoramic Banner"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
            {/* Gentle soft white/glass gradient overlay for legibility */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/60 to-transparent w-full md:w-3/4 lg:w-3/5"></div>

            {/* Hero Content */}
            <div className="relative z-10 p-6 md:p-10 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100/80 border border-emerald-200/60 text-emerald-800 text-xs font-semibold mb-3 backdrop-blur-sm">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Civic Partner Portal</span>
              </div>

              <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Good Morning, <br/>
                <span className="text-emerald-800 font-black">{user?.name.split(' ')[0]}</span>
              </h1>

              <p className="text-slate-700 text-sm md:text-base mt-2 font-medium leading-relaxed">
                Together, we build cleaner, safer, and smarter communities.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {/* Primary CTA */}
                <button
                  onClick={() => navigate('/report')}
                  className="inline-flex items-center gap-2.5 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-800/20 hover:shadow-lg hover:shadow-emerald-800/30 transition transform active:scale-95"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Report an Issue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {/* Location Ward Indicator */}
                {user?.ward_name && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/80 backdrop-blur-md rounded-xl border border-slate-200/80 text-xs text-slate-700 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{user.ward_name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4. QUICK STATUS OVERVIEW CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-200 transition flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <FolderCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Reports Submitted</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-2xl font-extrabold text-slate-900">{loading ? '-' : metrics.submitted}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-amber-200 transition flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Clock3 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">In Progress</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-2xl font-extrabold text-amber-600">{loading ? '-' : metrics.inProgress}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-teal-200 transition flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Resolved</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-2xl font-extrabold text-teal-700">{loading ? '-' : metrics.resolved}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-rose-200 transition flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Hourglass className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Pending Review</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-2xl font-extrabold text-slate-800">{loading ? '-' : metrics.pending}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 5. MAIN CONTENT: TWO COLUMN (MY REPORTS & CIVIC ALERTS) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* LEFT COLUMN: MY REPORTS (7 Cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">My Reports</h2>
                      <p className="text-xs text-slate-500">Citizen complaints and resolution status</p>
                    </div>
                  </div>
                  <Link to="/my-reports" className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition group">
                    <span>View All</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>

                <div className="divide-y divide-slate-100 mt-2">
                  {loading ? (
                    <div className="py-8 text-center text-slate-400 text-sm">Loading reports...</div>
                  ) : recentReports.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 text-sm">No reports filed yet.</div>
                  ) : (
                    recentReports.map(c => {
                      const isResolved = c.status === 'resolved';
                      const isPending = c.status === 'pending';

                      return (
                        <Link key={c.id} to={`/complaints/${c.id}`} className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 p-2 rounded-xl transition cursor-pointer group">
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center text-slate-400 relative">
                              {c.image_url ? (
                                <img src={`http://localhost:8000${c.image_url}`} alt="Complaint" className="w-full h-full object-cover" />
                              ) : (
                                <Camera className="w-5 h-5 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900 truncate group-hover:text-emerald-700 transition">
                                  {c.category_name || 'Uncategorized'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                <span className="flex items-center gap-1 truncate max-w-[150px] sm:max-w-[200px]">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{c.administrative_ward_name || c.address || 'Location provided'}</span>
                                </span>
                                <span>•</span>
                                <span>{new Date(c.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                              isResolved ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              isPending ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                isResolved ? 'bg-emerald-600' :
                                isPending ? 'bg-rose-500' :
                                'bg-amber-500'
                              }`}></span>
                              {c.status.replace('_', ' ')}
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </Link>
                      )
                    })
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Showing recent {recentReports.length} complaints</span>
                  <span className="text-slate-400 flex items-center gap-1">
                    <Database className="w-3 h-3" /> Syncs with Municipal GIS
                  </span>
                </div>
              </div>

              {/* Citizen Community Impact card */}
              <div className="bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-white rounded-2xl border border-emerald-100 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Community Participation Level</h4>
                    <p className="text-[11px] text-slate-600">Active Citizen Contributor in {user?.ward_name || 'your area'}</p>
                  </div>
                </div>
                <Link to="/leaderboard" className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-white hover:bg-emerald-50 rounded-xl border border-emerald-200 transition shrink-0 self-end sm:self-auto">
                  View Leaderboard
                </Link>
              </div>
            </div>

            {/* RIGHT COLUMN: CIVIC ALERTS & MAP (5 Cols) */}
            <div className="lg:col-span-5 space-y-6">

              {/* Active Civic Alerts Card */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Active Civic Alerts</h2>
                      <p className="text-[11px] text-slate-500">Municipal advisories for your area</p>
                    </div>
                  </div>
                  <Link to="/civic-alerts" className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition group">
                    <span>View All</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>

                {loading ? (
                  <div className="py-8 text-center text-slate-400 text-sm">Loading alerts...</div>
                ) : topAdvisory ? (
                  <div
                    className="mt-4 p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-2 cursor-pointer hover:bg-amber-50 transition-colors"
                    onClick={() => setSelectedAdvisory(topAdvisory)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        Active Advisory
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500 truncate max-w-[120px]">
                        {user?.ward_name || 'General'}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                      {topAdvisory.title}
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                      {topAdvisory.description}
                    </p>
                    <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-amber-200/50 mt-2">
                      <span>Until: {new Date(topAdvisory.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className="text-amber-700 font-semibold truncate max-w-[100px]">Municipal Dept</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100 text-center text-sm text-slate-500">
                    No active civic alerts in your area.
                  </div>
                )}
              </div>

              {/* Issue Map */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col h-[300px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <MapIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Issue Map</h3>
                      <p className="text-[11px] text-slate-500">Geotagged locations of your reports</p>
                    </div>
                  </div>
                  <Link to="/my-reports" className="text-xs font-bold text-emerald-700 hover:text-emerald-800 transition">View Full Map →</Link>
                </div>

                <div className="mt-3.5 relative flex-1 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 z-0">
                  {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">Loading map...</div>
                  ) : complaints.filter(c => c.latitude && c.longitude).length > 0 ? (
                    <MapContainer
                      center={[complaints[0].latitude, complaints[0].longitude]}
                      zoom={12}
                      className="w-full h-full"
                      zoomControl={false}
                    >
                      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                      {complaints.filter(c => c.latitude && c.longitude).map(c => (
                        <Marker
                          key={c.id}
                          position={[c.latitude, c.longitude]}
                          icon={createStatusIcon(c.status)}
                        >
                          <Popup>
                            <div className="text-xs font-sans">
                              <strong>{c.category_name || 'Report'}</strong>
                              <br />
                              <span className="capitalize">{c.status.replace('_', ' ')}</span>
                            </div>
                          </Popup>
                        </Marker>
                      ))}
                    </MapContainer>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm text-center px-4">
                      No coordinates found for your reports.
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    <span>Resolved</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#f59e0b]"></span>
                    <span>In Progress</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#f43f5e]"></span>
                    <span>Pending</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* 6. BOTTOM DECORATIVE SECTION */}
          <section
            className="relative rounded-3xl overflow-hidden border border-emerald-900/10 shadow-sm min-h-[140px] md:min-h-[170px] bg-gradient-to-r from-[#e7f6ef] via-[#f1faf5] to-[#ebf7f1] flex items-center"
            style={{
              backgroundImage: 'url(/assets/dashboard/citizen-dashboard-bottom.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center bottom'
            }}
          >
            {/* Gradient overlay for text legibility */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/70 to-transparent w-full md:w-2/3"></div>

            {/* Content overlay */}
            <div className="relative z-10 p-6 md:p-8 max-w-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-700/20 shrink-0">
                  <Sprout className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-extrabold text-slate-900 tracking-tight">
                    Citizens Today. A Better Tomorrow.
                  </h3>
                  <p className="text-xs md:text-sm text-slate-700 font-medium">
                    Your voice powers faster civic resolution across India.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Footer Meta line */}
          <footer className="pt-2 pb-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 border-t border-slate-200/60">
            <p>© 2024 NagarMitra — Smarter Civic Response. Developed for citizen engagement.</p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 sm:mt-0 font-medium">
              <a href="#" className="hover:text-emerald-700 transition">Grievance Redressal Policy</a>
              <span className="hidden sm:inline">•</span>
              <a href="#" className="hover:text-emerald-700 transition">Municipal Portal</a>
              <span className="hidden sm:inline">•</span>
              <a href="#" className="hover:text-emerald-700 transition">Helpdesk 1800-CIVIC</a>
            </div>
          </footer>
      </CitizenLayout>

      <AdvisoryModal
        advisory={selectedAdvisory as any}
        isOpen={!!selectedAdvisory}
        onClose={() => setSelectedAdvisory(null)}
        getCategoryName={() => 'General Advisory'}
        getWardName={() => 'Your Ward'}
        isAdminView={false}
      />
    </>
  );
}
