import React from 'react';
import { X, Clock, MapPin, Tag, User } from 'lucide-react';

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
  created_at?: string;
  created_by?: string;
}

interface AdvisoryModalProps {
  advisory: Advisory | null;
  isOpen: boolean;
  onClose: () => void;
  getCategoryName: (id?: string | null) => string | null;
  getWardName: (id?: string | null) => string;
  isAdminView?: boolean;
}

export default function AdvisoryModal({
  advisory,
  isOpen,
  onClose,
  getCategoryName,
  getWardName,
  isAdminView = false
}: AdvisoryModalProps) {
  if (!isOpen || !advisory) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900 pr-4">{advisory.title}</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-wrap gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              advisory.status === 'ACTIVE' ? 'bg-amber-100 text-amber-800' :
              advisory.status === 'CANCELLED' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-800'
            }`}>
              {advisory.status}
            </span>
            <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium flex items-center">
              <MapPin className="w-3 h-3 mr-1" />
              {getWardName(advisory.ward_id)}
            </span>
            {getCategoryName(advisory.category_id) && (
              <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium flex items-center">
                <Tag className="w-3 h-3 mr-1" />
                {getCategoryName(advisory.category_id)}
              </span>
            )}
          </div>

          <div className="prose prose-slate max-w-none text-slate-700 whitespace-pre-wrap text-sm md:text-base">
            {advisory.description}
          </div>

          <div className="bg-slate-50 p-4 rounded-lg space-y-3 text-sm text-slate-600 border border-slate-100">
            <div className="flex items-start sm:items-center flex-col sm:flex-row gap-1 sm:gap-4">
              <div className="flex items-center w-32 font-medium">
                <Clock className="w-4 h-4 mr-2" />
                Starts
              </div>
              <div className="text-slate-900">{new Date(advisory.starts_at).toLocaleString()}</div>
            </div>
            <div className="flex items-start sm:items-center flex-col sm:flex-row gap-1 sm:gap-4">
              <div className="flex items-center w-32 font-medium">
                <Clock className="w-4 h-4 mr-2" />
                Expires
              </div>
              <div className="text-slate-900">{new Date(advisory.expires_at).toLocaleString()}</div>
            </div>

            {isAdminView && advisory.created_at && (
              <div className="flex items-start sm:items-center flex-col sm:flex-row gap-1 sm:gap-4 pt-2 border-t border-slate-200 mt-2">
                <div className="flex items-center w-32 font-medium">
                  <Clock className="w-4 h-4 mr-2" />
                  Created
                </div>
                <div className="text-slate-900">{new Date(advisory.created_at).toLocaleString()}</div>
              </div>
            )}

            {isAdminView && advisory.created_by && (
              <div className="flex items-start sm:items-center flex-col sm:flex-row gap-1 sm:gap-4 pt-2 border-t border-slate-200 mt-2">
                <div className="flex items-center w-32 font-medium">
                  <User className="w-4 h-4 mr-2" />
                  Created By
                </div>
                <div className="text-slate-900 font-mono text-xs">{advisory.created_by}</div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
