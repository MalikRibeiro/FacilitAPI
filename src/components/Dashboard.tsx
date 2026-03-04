import React, { useState, useEffect } from 'react';
import { Database, Key, Play, Plus, Server, Activity, CheckCircle2, XCircle, ArrowRight, Edit2, Trash2, Download, FileJson, RefreshCw, AlertCircle, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { supabase } from '../lib/supabaseClient.js';
import toast from 'react-hot-toast';

interface Integration {
  id: number;
  name: string;
  custom_url: string;
  http_method: string;
  output_type: string;
  destination_db_string: string;
  target_table: string;
  status: string;
  created_at: string;
}

interface Log {
  id: number;
  status: string;
  records_processed: number;
  error_message: string;
  executed_at: string;
}

interface UserStats {
  integrations_count: number;
  integrations_limit: number;
}

const flattenObject = (obj: any, prefix = ''): string[] => {
  let keys: string[] = [];
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        keys = keys.concat(flattenObject(obj[key], newKey));
      } else {
        keys.push(newKey);
      }
    }
  }
  return keys;
};

const Skeleton = () => (
  <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm animate-pulse">
    <div className="flex justify-between items-start mb-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-zinc-100 rounded-lg w-10 h-10"></div>
        <div className="space-y-2">
          <div className="h-4 bg-zinc-100 rounded w-32"></div>
          <div className="h-3 bg-zinc-100 rounded w-16"></div>
        </div>
      </div>
    </div>
    <div className="space-y-3 mb-6">
      <div className="h-3 bg-zinc-100 rounded w-full"></div>
      <div className="h-3 bg-zinc-100 rounded w-2/3"></div>
    </div>
    <div className="border-t border-zinc-100 pt-4">
      <div className="h-3 bg-zinc-100 rounded w-24"></div>
    </div>
  </div>
);

export default function Dashboard() {
  const { session } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<number | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UserStats | null>(null);
  
  // Form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalStep, setModalStep] = useState(1);
  
  const [name, setName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [httpMethod, setHttpMethod] = useState('GET');
  const [headersConfig, setHeadersConfig] = useState<{key: string, value: string}[]>([]);
  const [outputType, setOutputType] = useState('database');
  const [destDb, setDestDb] = useState('');
  const [targetTable, setTargetTable] = useState('');
  const [dataMapping, setDataMapping] = useState<{jsonPath: string, dbColumn: string}[]>([]);
  
  const [availableJsonKeys, setAvailableJsonKeys] = useState<string[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [manualMode, setManualMode] = useState<Record<number, boolean>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (session) {
      fetchIntegrations();
      fetchStats();
    }
  }, [session]);

  const fetchIntegrations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/integrations', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      if (!res.ok) throw new Error('Falha ao buscar integrações');
      const data = await res.json();
      setIntegrations(data);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/me', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      if (!res.ok) throw new Error('Falha ao buscar estatísticas');
      const data = await res.json();
      setStats(data);
    } catch (error: any) {
      console.error(error);
    }
  };

  const fetchLogs = async (id: number) => {
    try {
      const res = await fetch(`/api/integrations/${id}/logs`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      if (!res.ok) throw new Error('Falha ao buscar logs');
      const data = await res.json();
      setLogs(data);
      setSelectedIntegration(id);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const openCreateModal = () => {
    if (stats && stats.integrations_count >= stats.integrations_limit) {
      toast.error('Limite de integrações atingido! Faça upgrade para criar mais.', {
        icon: '🚀',
        duration: 5000
      });
      return;
    }

    setEditingId(null);
    setModalStep(1);
    setName('');
    setCustomUrl('');
    setHttpMethod('GET');
    setHeadersConfig([{key: 'Authorization', value: 'Bearer '}]);
    setOutputType('database');
    setDestDb('');
    setTargetTable('');
    setDataMapping([{jsonPath: '', dbColumn: ''}]);
    setAvailableJsonKeys([]);
    setManualMode({});
    setIsModalOpen(true);
  };

  const openEditModal = (integration: Integration) => {
    setEditingId(integration.id);
    setModalStep(1);
    setName(integration.name);
    setCustomUrl(integration.custom_url);
    setHttpMethod(integration.http_method);
    setHeadersConfig([]); // For security, we don't fetch headers back to client.
    setOutputType(integration.output_type);
    setDestDb(integration.destination_db_string || '');
    setTargetTable(integration.target_table || '');
    setDataMapping([{jsonPath: '', dbColumn: ''}]); 
    setAvailableJsonKeys([]);
    setManualMode({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalStep(1);
    setEditingId(null);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await new Promise((resolve) => {
      const toastId = toast((t) => (
        <div className="flex flex-col gap-3">
          <p className="font-medium">Excluir esta integração?</p>
          <div className="flex gap-2">
            <button 
              onClick={() => { toast.dismiss(t.id); resolve(true); }}
              className="bg-red-600 text-white px-3 py-1 rounded-lg text-sm font-medium"
            >
              Excluir
            </button>
            <button 
              onClick={() => { toast.dismiss(t.id); resolve(false); }}
              className="bg-zinc-100 text-zinc-700 px-3 py-1 rounded-lg text-sm font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      ), { duration: 10000 });
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/integrations/${id}`, { 
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      if (!res.ok) throw new Error('Falha ao excluir integração');
      
      toast.success('Integração excluída');
      fetchIntegrations();
      fetchStats();
      if (selectedIntegration === id) {
        setSelectedIntegration(null);
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalStep < 4) {
      setModalStep(modalStep + 1);
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingId ? `/api/integrations/${editingId}` : '/api/integrations';
      const method = editingId ? 'PUT' : 'POST';

      const validHeaders = headersConfig.filter(h => h.key.trim() !== '');
      const validMapping = dataMapping.filter(m => m.jsonPath.trim() !== '' && m.dbColumn.trim() !== '');

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          name,
          customUrl,
          httpMethod,
          headersConfig: validHeaders,
          dataMapping: validMapping,
          outputType,
          destinationDb: outputType === 'database' ? destDb : null,
          targetTable: outputType === 'database' ? targetTable : null
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao salvar integração');
      }

      toast.success(editingId ? 'Integração atualizada' : 'Integração criada com sucesso!');
      closeModal();
      fetchIntegrations();
      fetchStats();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSync = async (id: number) => {
    const toastId = toast.loading('Iniciando sincronização...');
    try {
      const res = await fetch(`/api/integrations/${id}/sync`, { 
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      if (!res.ok) throw new Error('Falha ao iniciar sincronização');
      
      toast.success('Sincronização iniciada em segundo plano!', { id: toastId });
      setTimeout(() => fetchLogs(id), 3000);
    } catch (error: any) {
      toast.error(error.message, { id: toastId });
    }
  };

  // Helpers for dynamic arrays
  const addHeader = () => setHeadersConfig([...headersConfig, {key: '', value: ''}]);
  const updateHeader = (index: number, field: 'key'|'value', val: string) => {
    const newHeaders = [...headersConfig];
    newHeaders[index][field] = val;
    setHeadersConfig(newHeaders);
  };
  const removeHeader = (index: number) => setHeadersConfig(headersConfig.filter((_, i) => i !== index));

  const addMapping = () => setDataMapping([...dataMapping, {jsonPath: '', dbColumn: ''}]);
  const updateMapping = (index: number, field: 'jsonPath'|'dbColumn', val: string) => {
    const newMapping = [...dataMapping];
    newMapping[index][field] = val;
    setDataMapping(newMapping);
  };
  const removeMapping = (index: number) => setDataMapping(dataMapping.filter((_, i) => i !== index));

  const handleLoadApiFields = async () => {
    if (!customUrl) {
      toast.error("Por favor, preencha a URL da API no Passo 1.");
      return;
    }
    
    setIsLoadingKeys(true);
    try {
      const validHeaders = headersConfig.filter(h => h.key.trim() !== '');
      const res = await fetch('/api/integrations/test-fetch', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          customUrl,
          httpMethod,
          headersConfig: validHeaders
        })
      });
      
      const data = await res.json();
      if (data.success && data.sample) {
        const keys = flattenObject(data.sample);
        setAvailableJsonKeys(keys);
        setManualMode({});
        if (keys.length === 0) {
          toast.error("A API retornou sucesso, mas o objeto está vazio.");
        } else {
          toast.success(`${keys.length} campos descobertos!`);
        }
      } else {
        toast.error(data.error || "Erro ao buscar campos da API.");
      }
    } catch (error: any) {
      toast.error("Erro de rede ao tentar buscar campos da API.");
    } finally {
      setIsLoadingKeys(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Stats Banner */}
      {stats && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Zap size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-900">Uso do Plano</p>
              <p className="text-xs text-zinc-500">
                {stats.integrations_count} de {stats.integrations_limit} integrações utilizadas
              </p>
            </div>
          </div>
          <div className="w-48 h-2 bg-zinc-100 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${stats.integrations_count >= stats.integrations_limit ? 'bg-red-500' : 'bg-indigo-600'}`}
              style={{ width: `${Math.min((stats.integrations_count / stats.integrations_limit) * 100, 100)}%` }}
            ></div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Suas Integrações</h2>
          <p className="text-zinc-500 mt-1">Gerencie suas conexões de API e pipelines de dados.</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-indigo-100"
        >
          <Plus size={18} />
          Nova Integração
        </button>
      </div>

      {/* Integrations List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          [1, 2, 3, 4].map(i => <Skeleton key={i} />)
        ) : integrations.length === 0 ? (
          <div className="col-span-full bg-white border border-dashed border-zinc-300 rounded-2xl p-12 text-center">
            <Database className="mx-auto h-12 w-12 text-zinc-300 mb-4" />
            <h3 className="text-lg font-medium text-zinc-900">Nenhuma integração ainda</h3>
            <p className="text-zinc-500 mt-1">Crie sua primeira integração para começar a sincronizar dados.</p>
          </div>
        ) : (
          integrations.map((integration) => (
            <div key={integration.id} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <Server size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900">{integration.name}</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      integration.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-600'
                    }`}>
                      {integration.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => openEditModal(integration)}
                    className="text-zinc-400 hover:text-indigo-600 transition-colors p-2"
                    title="Editar"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(integration.id)}
                    className="text-zinc-400 hover:text-red-600 transition-colors p-2"
                    title="Excluir"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button 
                    onClick={() => handleSync(integration.id)}
                    className="text-zinc-400 hover:text-green-600 transition-colors p-2 ml-1"
                    title="Executar Agora"
                  >
                    <Play size={20} className="fill-current" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-3 text-sm text-zinc-600 mb-6">
                <div className="flex items-center gap-2">
                  <FileJson size={16} className="text-zinc-400" />
                  <span className="truncate max-w-[200px]" title={integration.custom_url}>
                    <span className="font-bold text-zinc-400 mr-1">{integration.http_method}</span>
                    {integration.custom_url}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {integration.output_type === 'database' ? (
                    <Database size={16} className="text-zinc-400" />
                  ) : (
                    <Download size={16} className="text-zinc-400" />
                  )}
                  <span>Destino: {integration.output_type === 'database' ? `DB (${integration.target_table})` : 'Arquivo CSV'}</span>
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-4 flex justify-between items-center">
                <button 
                  onClick={() => fetchLogs(integration.id)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 uppercase tracking-wider"
                >
                  <Activity size={14} />
                  Logs de Execução
                </button>
                <span className="text-[10px] text-zinc-400">Criado em {new Date(integration.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Logs Modal */}
      {selectedIntegration && (
        <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[80vh] flex flex-col border border-zinc-200">
            <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-100 rounded-xl">
                  <Activity size={18} className="text-zinc-600" />
                </div>
                <h3 className="font-bold text-zinc-900">Histórico de Execuções</h3>
              </div>
              <button onClick={() => setSelectedIntegration(null)} className="text-zinc-400 hover:text-zinc-600 p-1 hover:bg-zinc-100 rounded-lg transition-all">
                <XCircle size={24} />
              </button>
            </div>
            <div className="divide-y divide-zinc-100 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="p-12 text-center text-zinc-500">
                  <AlertCircle className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
                  <p className="text-sm">Nenhuma execução registrada. Inicie uma sincronização para ver os logs.</p>
                </div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="px-6 py-4 flex items-center justify-between hover:bg-zinc-50/50 transition-colors">
                    <div className="flex items-center gap-4">
                      {log.status === 'success' ? (
                        <div className="p-1.5 bg-green-100 text-green-600 rounded-full">
                          <CheckCircle2 size={18} />
                        </div>
                      ) : (
                        <div className="p-1.5 bg-red-100 text-red-600 rounded-full">
                          <XCircle size={18} />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-zinc-900">
                          {log.status === 'success' ? `Sincronizado: ${log.records_processed} registros` : 'Falha na Sincronização'}
                        </p>
                        <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">{new Date(log.executed_at).toLocaleString()}</p>
                      </div>
                    </div>
                    {log.error_message && (
                      <div className={`text-xs px-3 py-1.5 rounded-xl max-w-xs truncate font-medium ${log.status === 'success' ? 'text-green-700 bg-green-50 border border-green-100' : 'text-red-600 bg-red-50 border border-red-100'}`} title={log.error_message}>
                        {log.error_message.includes('/downloads/') ? (
                          <a href={log.error_message.split('Arquivo: ')[1]} target="_blank" rel="noreferrer" className="flex items-center gap-1 underline">
                            <Download size={12} /> Baixar CSV
                          </a>
                        ) : (
                          log.error_message
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-zinc-200">
            <div className="px-6 py-5 border-b border-zinc-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-xl text-zinc-900 tracking-tight">
                {editingId ? 'Editar Integração' : 'Nova Integração'}
                <span className="ml-3 text-sm font-medium text-zinc-400">Passo {modalStep} de 4</span>
              </h3>
              <button onClick={closeModal} className="text-zinc-400 hover:text-zinc-600 p-1 hover:bg-zinc-100 rounded-lg transition-all">
                <XCircle size={24} />
              </button>
            </div>
            
            {/* Progress Bar */}
            <div className="flex h-1.5 bg-zinc-100 shrink-0">
              <div className="bg-indigo-600 transition-all duration-500 ease-out" style={{ width: `${(modalStep / 4) * 100}%` }}></div>
            </div>

            <form onSubmit={handleSubmit} className="p-8 overflow-y-auto flex-1">
              {/* Step 1: Endpoint */}
              {modalStep === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-2">Nome da Integração</label>
                    <input 
                      required type="text" placeholder="Ex: Meus Repositórios do GitHub"
                      className="w-full px-4 py-3 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      value={name} onChange={e => setName(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="w-1/3">
                      <label className="block text-sm font-bold text-zinc-700 mb-2">Método</label>
                      <select 
                        className="w-full px-4 py-3 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white transition-all"
                        value={httpMethod} onChange={e => setHttpMethod(e.target.value)}
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                      </select>
                    </div>
                    <div className="w-2/3">
                      <label className="block text-sm font-bold text-zinc-700 mb-2">URL da API</label>
                      <input 
                        required type="url" placeholder="https://api.exemplo.com/dados"
                        className="w-full px-4 py-3 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        value={customUrl} onChange={e => setCustomUrl(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Headers */}
              {modalStep === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="flex justify-between items-center">
                    <div>
                      <label className="block text-sm font-bold text-zinc-700">Headers & Autenticação</label>
                      <p className="text-xs text-zinc-400 mt-1">Estes valores serão criptografados no servidor.</p>
                    </div>
                    <button type="button" onClick={addHeader} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl font-bold hover:bg-indigo-100 transition-all flex items-center gap-1">
                      <Plus size={14} /> Adicionar
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {headersConfig.map((header, index) => (
                      <div key={index} className="flex gap-3 items-start">
                        <input 
                          type="text" placeholder="Chave (ex: Authorization)"
                          className="w-1/3 px-4 py-2.5 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                          value={header.key} onChange={e => updateHeader(index, 'key', e.target.value)}
                        />
                        <input 
                          type="text" placeholder="Valor (ex: Bearer token...)"
                          className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                          value={header.value} onChange={e => updateHeader(index, 'value', e.target.value)}
                        />
                        <button type="button" onClick={() => removeHeader(index)} className="p-2.5 text-zinc-300 hover:text-red-500 transition-all">
                          <XCircle size={20} />
                        </button>
                      </div>
                    ))}
                    {headersConfig.length === 0 && (
                      <div className="text-center py-10 border-2 border-dashed border-zinc-100 rounded-3xl text-sm text-zinc-400">
                        Nenhum header configurado.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Destination */}
              {modalStep === 3 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-4">Onde salvar os dados?</label>
                    <div className="grid grid-cols-2 gap-4">
                      <label className={`relative border-2 rounded-2xl p-5 cursor-pointer transition-all ${outputType === 'database' ? 'border-indigo-600 bg-indigo-50/50' : 'border-zinc-100 hover:border-zinc-200'}`}>
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`p-2 rounded-lg ${outputType === 'database' ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-500'}`}>
                            <Database size={18} />
                          </div>
                          <span className={`font-bold ${outputType === 'database' ? 'text-indigo-900' : 'text-zinc-900'}`}>Banco de Dados</span>
                          <input type="radio" name="output" value="database" checked={outputType === 'database'} onChange={() => setOutputType('database')} className="sr-only" />
                        </div>
                        <p className="text-xs text-zinc-500 leading-relaxed">Inserir registros em uma tabela PostgreSQL ou Supabase.</p>
                      </label>
                      <label className={`relative border-2 rounded-2xl p-5 cursor-pointer transition-all ${outputType === 'csv' ? 'border-indigo-600 bg-indigo-50/50' : 'border-zinc-100 hover:border-zinc-200'}`}>
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`p-2 rounded-lg ${outputType === 'csv' ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-500'}`}>
                            <Download size={18} />
                          </div>
                          <span className={`font-bold ${outputType === 'csv' ? 'text-indigo-900' : 'text-zinc-900'}`}>Arquivo CSV</span>
                          <input type="radio" name="output" value="csv" checked={outputType === 'csv'} onChange={() => setOutputType('csv')} className="sr-only" />
                        </div>
                        <p className="text-xs text-zinc-500 leading-relaxed">Gerar um arquivo CSV para download manual.</p>
                      </label>
                    </div>
                  </div>

                  {outputType === 'database' && (
                    <div className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
                      <div>
                        <label className="block text-sm font-bold text-zinc-700 mb-2">String de Conexão (PostgreSQL)</label>
                        <input 
                          required type="text" placeholder="postgres://user:pass@db.supabase.co:5432/postgres"
                          className="w-full px-4 py-3 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          value={destDb} onChange={e => setDestDb(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-zinc-700 mb-2">Nome da Tabela de Destino</label>
                        <input 
                          required type="text" placeholder="ex: github_repos"
                          className="w-full px-4 py-3 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          value={targetTable} onChange={e => setTargetTable(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Mapping */}
              {modalStep === 4 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="flex justify-between items-center">
                    <div>
                      <label className="block text-sm font-bold text-zinc-700">Mapeamento de Dados</label>
                      <p className="text-xs text-zinc-400 mt-1">Conecte o JSON da origem às colunas do destino.</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        type="button" 
                        onClick={handleLoadApiFields} 
                        disabled={isLoadingKeys}
                        className="text-[10px] uppercase tracking-wider bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 transition-all"
                      >
                        <RefreshCw size={12} className={isLoadingKeys ? "animate-spin" : ""} />
                        Auto-Discovery
                      </button>
                      <button type="button" onClick={addMapping} className="text-[10px] uppercase tracking-wider bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl font-bold hover:bg-indigo-100 transition-all flex items-center gap-1">
                        <Plus size={12} /> Adicionar
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {dataMapping.map((mapping, index) => (
                      <div key={index} className="flex gap-3 items-start">
                        {availableJsonKeys.length > 0 && !manualMode[index] ? (
                          <select 
                            required
                            className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white transition-all"
                            value={mapping.jsonPath || ''}
                            onChange={e => {
                              if (e.target.value === '__manual__') {
                                setManualMode({...manualMode, [index]: true});
                                updateMapping(index, 'jsonPath', '');
                              } else {
                                updateMapping(index, 'jsonPath', e.target.value);
                              }
                            }}
                          >
                            <option value="" disabled>Selecione um campo...</option>
                            {availableJsonKeys.map(key => (
                              <option key={key} value={key}>{key}</option>
                            ))}
                            <option value="__manual__">Outro (Digitar manualmente...)</option>
                          </select>
                        ) : (
                          <input 
                            required type="text" placeholder="Caminho no JSON (ex: id)"
                            className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                            value={mapping.jsonPath} onChange={e => updateMapping(index, 'jsonPath', e.target.value)}
                          />
                        )}
                        <input 
                          required type="text" placeholder="Coluna no destino"
                          className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                          value={mapping.dbColumn} onChange={e => updateMapping(index, 'dbColumn', e.target.value)}
                        />
                        <button type="button" onClick={() => removeMapping(index)} className="p-2.5 text-zinc-300 hover:text-red-500 transition-all">
                          <XCircle size={20} />
                        </button>
                      </div>
                    ))}
                    {dataMapping.length === 0 && (
                      <div className="text-center py-10 border-2 border-dashed border-zinc-100 rounded-3xl text-sm text-zinc-400">
                        Nenhum mapeamento configurado.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="pt-8 mt-8 border-t border-zinc-100 flex gap-4">
                {modalStep > 1 && (
                  <button 
                    type="button" onClick={() => setModalStep(modalStep - 1)}
                    className="w-1/3 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 py-3.5 rounded-2xl font-bold transition-all"
                  >
                    Voltar
                  </button>
                )}
                <button 
                  type="submit" disabled={isSubmitting}
                  className={`${modalStep > 1 ? 'w-2/3' : 'w-full'} bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg shadow-indigo-100 disabled:opacity-70`}
                >
                  {modalStep < 4 ? (
                    <>Avançar <ArrowRight size={18} /></>
                  ) : (
                    isSubmitting ? 'Salvando...' : (editingId ? 'Atualizar Integração' : 'Salvar Integração')
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
