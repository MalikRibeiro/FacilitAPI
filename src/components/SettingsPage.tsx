import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { supabase } from '../lib/supabaseClient.js';
import { User, Mail, Shield, Trash2, Save, Key, CreditCard, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    if (user) {
      setName(user.user_metadata?.name || '');
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user?.id)
        .single();
      
      if (error) throw error;
      setUserData(data);
    } catch (error: any) {
      console.error('Error fetching user data:', error);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { name }
      });
      if (error) throw error;

      // Update our users table too
      const res = await fetch('/api/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ name })
      });

      if (!res.ok) throw new Error('Falha ao atualizar perfil no servidor');

      toast.success('Perfil atualizado com sucesso!');
      fetchUserData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user?.email || '', {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('Email de redefinição de senha enviado!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar email');
    }
  };

  const handleDeleteAccount = async () => {
    const confirm1 = window.confirm('Tem certeza que deseja excluir sua conta? Esta ação é irreversível.');
    if (!confirm1) return;
    
    const confirm2 = window.confirm('TODAS as suas integrações e logs serão apagados permanentemente. Confirmar exclusão?');
    if (!confirm2) return;

    toast.error('Funcionalidade de exclusão de conta em desenvolvimento. Entre em contato com o suporte.');
  };

  return (
    <div className="max-w-4xl space-y-8">
      {/* Profile Section */}
      <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50 flex items-center gap-2">
          <User size={18} className="text-zinc-500" />
          <h3 className="font-semibold text-zinc-900">Perfil do Usuário</h3>
        </div>
        <form onSubmit={handleUpdateProfile} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Nome</label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full pl-3 pr-3 py-2 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
              <div className="relative">
                <input
                  type="email"
                  disabled
                  className="w-full pl-3 pr-3 py-2 border border-zinc-200 bg-zinc-50 rounded-xl text-zinc-500 cursor-not-allowed"
                  value={user?.email || ''}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              <Save size={18} />
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </section>

      {/* Plan Section */}
      <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-zinc-500" />
            <h3 className="font-semibold text-zinc-900">Plano e Assinatura</h3>
          </div>
          <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full uppercase tracking-wider">
            {userData?.plan || 'Free'}
          </span>
        </div>
        <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1">
            <p className="font-medium text-zinc-900">Você está no plano {userData?.plan || 'Gratuito'}</p>
            <p className="text-sm text-zinc-500">
              Limite: {userData?.integrations_limit || 3} integrações. 
              Atualmente usando {userData?.integrations_count || 0}.
            </p>
          </div>
          <button className="flex items-center gap-2 px-6 py-2.5 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-all">
            <Zap size={18} className="text-amber-400 fill-amber-400" />
            Fazer Upgrade para Pro
          </button>
        </div>
      </section>

      {/* Security Section */}
      <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50 flex items-center gap-2">
          <Key size={18} className="text-zinc-500" />
          <h3 className="font-semibold text-zinc-900">Segurança</h3>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-zinc-900">Alterar Senha</p>
              <p className="text-sm text-zinc-500">Enviaremos um link de redefinição para seu email.</p>
            </div>
            <button
              onClick={handleResetPassword}
              className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl font-medium hover:bg-zinc-50 transition-all"
            >
              Redefinir Senha
            </button>
          </div>
          <div className="pt-6 border-t border-zinc-100 flex items-center justify-between">
            <div>
              <p className="font-medium text-red-600">Excluir Conta</p>
              <p className="text-sm text-zinc-500">Apaga permanentemente todos os seus dados.</p>
            </div>
            <button
              onClick={handleDeleteAccount}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition-all"
            >
              <Trash2 size={18} />
              Excluir Minha Conta
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
