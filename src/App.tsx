/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import Dashboard from './components/Dashboard';

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      <header className="bg-white border-b border-zinc-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">F</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight">FacilitAPI</h1>
          </div>
          <div className="text-sm text-zinc-500">
            User: demo_user_123
          </div>
        </div>
      </header>
      
      <main className="max-w-5xl mx-auto py-8 px-6">
        <Dashboard />
      </main>
    </div>
  );
}
