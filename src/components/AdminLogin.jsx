import React from 'react';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

export default function AdminLogin({ adminError, onLogin, onBackToStore }) {
  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mt-12">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Admin Access</h2>
        <p className="text-gray-500 text-sm mt-1">Sign in with your authorized Google account to view orders.</p>
      </div>
      
      <div className="space-y-4">
        {adminError && <p className="text-red-600 text-sm text-center bg-red-50 p-2 rounded">{adminError}</p>}
        <button
          type="button"
          onClick={onLogin}
          className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-lg font-medium transition-colors"
        >
          Sign in with Google
        </button>
        <button
          type="button"
          onClick={onBackToStore}
          className="w-full py-2 text-gray-500 hover:text-gray-800 text-sm flex items-center justify-center gap-1 mt-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Store
        </button>
      </div>
    </div>
  );
}

// Made with Bob
