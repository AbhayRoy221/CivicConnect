import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AlertTriangle, Plus, Calendar, MapPin, Tag, Eye } from 'lucide-react';
import AdvisoryModal from '../components/AdvisoryModal';

interface CivicAdvisory {
    id: string;
    public_id: string;
    title: string;
    description: string;
    category_id: string | null;
    ward_id: string | null;
    starts_at: string;
    expires_at: string;
    status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
    created_at: string;
    created_by: string;
}

export default function AdminAdvisories() {
    const { user, token } = useAuth();
    const [advisories, setAdvisories] = useState<CivicAdvisory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [categories, setCategories] = useState<any[]>([]);
    const [wards, setWards] = useState<any[]>([]);

    // Form states
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        starts_at: '',
        expires_at: '',
        category_id: '',
        ward_id: '',
    });
    const [formLoading, setFormLoading] = useState(false);

    // Modal states
    const [selectedAdvisory, setSelectedAdvisory] = useState<CivicAdvisory | null>(null);

    useEffect(() => {
        fetchAdvisories();
        fetchMetadata();
    }, []);

    const fetchMetadata = async () => {
        try {
            const [catRes, wardRes] = await Promise.all([
                api<any[]>('/categories', token),
                api<any[]>('/pune-wards', token)
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
            const res = await api<CivicAdvisory[]>('/advisories', token);
            setAdvisories(res);
        } catch (err: any) {
            setError(err.message || 'Failed to load advisories');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setFormLoading(true);
            const payload = {
                title: formData.title,
                description: formData.description,
                starts_at: formData.starts_at ? new Date(formData.starts_at).toISOString() : new Date().toISOString(),
                expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : new Date(Date.now() + 86400000).toISOString(),
                category_id: formData.category_id || null,
                ward_id: formData.ward_id || null,
            };
            await api('/advisories', token, { method: 'POST', body: JSON.stringify(payload) });
            setShowForm(false);
            setFormData({ title: '', description: '', starts_at: '', expires_at: '', category_id: '', ward_id: '' });
            fetchAdvisories();
        } catch (err: any) {
            alert(err.message || 'Failed to create advisory');
        } finally {
            setFormLoading(false);
        }
    };

    const handleCancelAdvisory = async (id: string) => {
        if (!window.confirm('Are you sure you want to cancel this advisory?')) return;
        try {
            await api(`/advisories/${id}`, token, { method: 'PATCH', body: JSON.stringify({ status: 'CANCELLED' }) });
            fetchAdvisories();
        } catch (err: any) {
            alert('Failed to cancel advisory');
        }
    };

    const getCategoryName = (id?: string | null) => {
        if (!id) return null;
        const cat = categories.find(c => c.id === id);
        return cat ? cat.name : 'Unknown';
    };

    const getWardName = (id?: string | null) => {
        if (!id) return 'Global (All Wards)';
        const ward = wards.find(w => w.id === id);
        return ward ? `Ward ${ward.ward_number}` : 'Unknown';
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading advisories...</div>;
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center">
                        <AlertTriangle className="mr-3 h-6 w-6 text-amber-500" />
                        Civic Advisories
                    </h1>
                    <p className="text-slate-500 mt-1">Manage active public advisories and alerts</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    New Advisory
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200">
                    {error}
                </div>
            )}

            {showForm && (
                <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <h2 className="text-lg font-bold text-slate-900 mb-4 border-b pb-2">Create New Advisory</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                            <input
                                type="text"
                                required
                                maxLength={200}
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 outline-none"
                                placeholder="e.g. Heavy Rain Alert for Downtown"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                            <textarea
                                required
                                rows={3}
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 outline-none"
                                placeholder="Detailed description of the advisory..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Category (Optional)</label>
                            <select
                                value={formData.category_id}
                                onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 outline-none"
                            >
                                <option value="">Global Category</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Target Ward (Optional)</label>
                            <select
                                value={formData.ward_id}
                                onChange={e => setFormData({ ...formData, ward_id: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 outline-none"
                            >
                                <option value="">Global (All Wards)</option>
                                {wards.map(w => (
                                    <option key={w.id} value={w.id}>Ward {w.ward_number}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Starts At (Optional)</label>
                            <input
                                type="datetime-local"
                                value={formData.starts_at}
                                onChange={e => setFormData({ ...formData, starts_at: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Expires At (Optional)</label>
                            <input
                                type="datetime-local"
                                value={formData.expires_at}
                                onChange={e => setFormData({ ...formData, expires_at: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                        <button type="submit" disabled={formLoading} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">
                            {formLoading ? 'Publishing...' : 'Publish Advisory'}
                        </button>
                    </div>
                </form>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {advisories.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">No advisories found.</div>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {advisories.map((adv) => (
                            <li key={adv.id} className="p-6 hover:bg-slate-50 transition-colors">
                                <div className="flex flex-col md:flex-row justify-between gap-4">
                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-lg font-bold text-slate-900">{adv.title}</h3>
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                                adv.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                adv.status === 'CANCELLED' ? 'bg-red-50 text-red-700 border-red-200' :
                                                'bg-slate-100 text-slate-700 border-slate-200'
                                            }`}>
                                                {adv.status}
                                            </span>
                                        </div>
                                        <p className="text-slate-600 text-sm line-clamp-2">{adv.description}</p>
                                        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
                                            <div className="flex items-center"><MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" /> {getWardName(adv.ward_id)}</div>
                                            {adv.category_id && <div className="flex items-center"><Tag className="w-3.5 h-3.5 mr-1 text-slate-400" /> {getCategoryName(adv.category_id)}</div>}
                                            <div className="flex items-center"><Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" /> Expires: {new Date(adv.expires_at).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <button
                                            onClick={() => setSelectedAdvisory(adv)}
                                            className="px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 flex items-center transition-colors"
                                        >
                                            <Eye className="w-4 h-4 mr-1" /> View Full
                                        </button>
                                        {adv.status === 'ACTIVE' && (
                                            <button
                                                onClick={() => handleCancelAdvisory(adv.id)}
                                                className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <AdvisoryModal
              advisory={selectedAdvisory}
              isOpen={!!selectedAdvisory}
              onClose={() => setSelectedAdvisory(null)}
              getCategoryName={getCategoryName}
              getWardName={getWardName}
              isAdminView={true}
            />
        </div>
    );
}
