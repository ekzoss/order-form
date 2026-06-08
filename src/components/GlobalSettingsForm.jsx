import React from 'react';
import { ChevronUp, ChevronDown, Upload, Trash2 } from 'lucide-react';

export default function GlobalSettingsForm({
  configForm,
  setConfigForm,
  handleSaveConfig,
  pageInfoExpanded,
  setPageInfoExpanded,
  tshirtBgLibraryExpanded,
  setTshirtBgLibraryExpanded,
  tshirtBackgrounds,
  handleTshirtBgUpload,
  handleDeleteTshirtBg
}) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">Global Settings</h2>
      <p className="text-sm text-gray-600 mb-4">These settings apply to all items.</p>
      
      <form onSubmit={handleSaveConfig} className="space-y-4">
        {/* Page Information - Collapsible */}
        <div className="pb-4">
          <button
            type="button"
            onClick={() => setPageInfoExpanded(!pageInfoExpanded)}
            className="flex items-center gap-2 text-sm font-bold text-gray-900 hover:text-indigo-600 transition-colors mb-3"
          >
            {pageInfoExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            <span>Page Information</span>
          </button>
          
          {pageInfoExpanded && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Page Title</label>
                <input
                  type="text"
                  value={configForm.pageTitle}
                  onChange={e => setConfigForm({...configForm, pageTitle: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="Enter page title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Page Description</label>
                <textarea
                  value={configForm.pageDescription}
                  onChange={e => setConfigForm({...configForm, pageDescription: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="Enter page description (optional)"
                  rows="3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order notification email</label>
                <input
                  type="email"
                  value={configForm.notificationEmail}
                  onChange={e => setConfigForm({...configForm, notificationEmail: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Processing Fee
                  <span className="text-xs text-gray-500 ml-2">(optional)</span>
                </label>
                <input
                  type="text"
                  value={configForm.processingFee}
                  onChange={e => setConfigForm({...configForm, processingFee: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="e.g., 2.90% + $0.30 or $1.50 or 3%"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter a flat fee ($1.50), percentage (3%), or combination (2.90% + $0.30) to cover Square transaction fees
                </p>
              </div>
            </div>
          )}
        </div>

        {/* T-shirt Background Library Management - Collapsible */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setTshirtBgLibraryExpanded(!tshirtBgLibraryExpanded)}
            className="flex items-center gap-2 text-sm font-bold text-gray-900 hover:text-indigo-600 transition-colors"
          >
            {tshirtBgLibraryExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            <span>T-shirt Background Library</span>
          </button>
          
          {tshirtBgLibraryExpanded && (
            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-3">Upload t-shirt background images to use when compositing items. These will be available for both front and back images.</p>
              
              {/* Solid Color Backgrounds - Quarter Size, Single Row */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-700 mb-2">Solid Colors</p>
                <div className="flex flex-wrap gap-2">
                  {tshirtBackgrounds.filter(bg => bg.color).map(bg => (
                    <div key={bg.id} className="relative group">
                      <div className="w-12 h-12 rounded border-2 border-gray-300 overflow-hidden">
                        <img src={bg.url} alt={bg.name} className="w-full h-full object-cover" />
                      </div>
                      <p className="text-[10px] text-gray-600 mt-0.5 text-center truncate w-12">{bg.name}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Custom/Graphical Backgrounds - Half Size Grid */}
              {tshirtBackgrounds.filter(bg => !bg.color).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Custom Backgrounds</p>
                  <div className="grid grid-cols-6 md:grid-cols-8 gap-2 mb-3">
                    {tshirtBackgrounds.filter(bg => !bg.color).map(bg => (
                      <div key={bg.id} className="relative group">
                        <div className="aspect-square rounded border-2 border-gray-300 overflow-hidden">
                          <img src={bg.url} alt={bg.name} className="w-full h-full object-cover" />
                        </div>
                        <p className="text-[10px] text-gray-600 mt-0.5 truncate">{bg.name}</p>
                        {bg.id.startsWith('custom-') && (
                          <button
                            onClick={() => handleDeleteTshirtBg(bg.id)}
                            className="absolute top-0.5 right-0.5 bg-red-500 text-white p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors text-sm font-medium border border-gray-300">
                <Upload className="w-4 h-4" />
                <span>Add T-shirt Background</span>
                <input
                  type="file"
                  accept="image/jpeg, image/png"
                  className="hidden"
                  onChange={handleTshirtBgUpload}
                />
              </label>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

// Made with Bob
