import React from 'react';

export default function GlobalSettingsForm({
  configForm,
  setConfigForm,
  handleSaveConfig
}) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Global Settings</h2>
      <p className="text-sm text-gray-500 mb-6">These settings apply to all items.</p>
      
      <form onSubmit={handleSaveConfig} className="space-y-4">
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
      </form>
    </div>
  );
}

// Made with Bob
