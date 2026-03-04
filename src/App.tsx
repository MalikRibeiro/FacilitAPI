import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import AuthPage from './components/AuthPage.js';
import Dashboard from './components/Dashboard.js';
import Layout from './components/Layout.js';
import SettingsPage from './components/SettingsPage.js';
import { Toaster } from 'react-hot-toast';
import { supabase } from './lib/supabaseClient.js';
import { AlertCircle, ExternalLink } from 'lucide-react';

function ConfigurationWarning() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-zinc-200 p-8 text-center">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Configuração Necessária</h1>
        <p className="text-zinc-600 mb-8">
          O FacilitAPI requer uma conexão com o Supabase para funcionar. 
          Por favor, configure as variáveis de ambiente no painel de Secrets do AI Studio.
        </p>
        
        <div className="space-y-4 text-left bg-zinc-50 p-4 rounded-2xl border border-zinc-100 mb-8">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Variáveis Necessárias:</p>
          <ul className="space-y-2">
            {['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'DATABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ENCRYPTION_KEY'].map(key => (
              <li key={key} className="flex items-center gap-2 text-sm font-mono text-zinc-700">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {key}
              </li>
            ))}
          </ul>
        </div>

        <a 
          href="https://supabase.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-indigo-600 font-medium hover:underline mb-6"
        >
          Criar conta no Supabase <ExternalLink className="w-4 h-4" />
        </a>

        <div className="pt-6 border-t border-zinc-100">
          <p className="text-sm text-zinc-500">
            Após configurar as variáveis, reinicie o servidor ou recarregue a página.
          </p>
          <div className="mt-4 p-3 bg-blue-50 rounded-xl text-xs text-blue-700 text-left">
            <strong>Dica:</strong> No Supabase, vá em <strong>Authentication &gt; Providers</strong> e certifique-se de que o provedor <strong>Email</strong> está ativado (e desative "Confirm Email" se quiser testar rápido).
          </div>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (!supabase) {
    return <ConfigurationWarning />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-zinc-500 font-medium animate-pulse">Carregando FacilitAPI...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'dashboard' && <Dashboard />}
      {activeTab === 'integrations' && <Dashboard />}
      {activeTab === 'settings' && <SettingsPage />}
      {activeTab === 'logs' && <Dashboard />}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster 
        position="top-right"
        toastOptions={{
          className: 'rounded-2xl font-medium text-sm',
          duration: 4000,
          style: {
            background: '#fff',
            color: '#18181b',
            border: '1px solid #e4e4e7',
            padding: '12px 16px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          },
        }}
      />
    </AuthProvider>
  );
}
