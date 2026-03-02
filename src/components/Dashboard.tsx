import React, { useState, useEffect } from 'react';
import { Database, Key, Play, Plus, Server, Activity, CheckCircle2, XCircle, ArrowRight, Edit2, Trash2, Download, FileJson, RefreshCw } from 'lucide-react';

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

export default function Dashboard() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<number | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  
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

  const userId = 'demo_user_123';

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const res = await fetch(`/api/integrations/${userId}`);
      const data = await res.json();
      setIntegrations(data);
    } catch (error) {
      console.error("Failed to fetch integrations", error);
    }
  };

  const fetchLogs = async (id: number) => {
    try {
      const res = await fetch(`/api/integrations/${id}/logs`);
      const data = await res.json();
      setLogs(data);
      setSelectedIntegration(id);
    } catch (error) {
      console.error("Failed to fetch logs", error);
    }
  };

  const openCreateModal = () => {
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
    setHeadersConfig([]); // For security, we don't fetch headers back to client. User must re-enter if they want to change.
    setOutputType(integration.output_type);
    setDestDb(integration.destination_db_string || '');
    setTargetTable(integration.target_table || '');
    setDataMapping([{jsonPath: '', dbColumn: ''}]); // Same for mapping, we'd normally fetch it, but for MVP we reset or require re-entry
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
    if (window.confirm('Tem certeza que deseja excluir esta integração? Todos os logs associados também serão apagados.')) {
      try {
        await fetch(`/api/integrations/${id}`, { method: 'DELETE' });
        fetchIntegrations();
        if (selectedIntegration === id) {
          setSelectedIntegration(null);
        }
      } catch (error) {
        console.error("Failed to delete integration", error);
      }
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

      // Filter out empty headers/mappings
      const validHeaders = headersConfig.filter(h => h.key.trim() !== '');
      const validMapping = dataMapping.filter(m => m.jsonPath.trim() !== '' && m.dbColumn.trim() !== '');

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
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
      closeModal();
      fetchIntegrations();
    } catch (error) {
      console.error("Failed to save integration", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSync = async (id: number) => {
    try {
      await fetch(`/api/integrations/${id}/sync`, { method: 'POST' });
      alert('Sync started in background! Check logs in a few seconds.');
      setTimeout(() => fetchLogs(id), 3000);
    } catch (error) {
      console.error("Failed to sync", error);
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
      alert("Por favor, preencha a URL da API no Passo 1.");
      return;
    }
    
    setIsLoadingKeys(true);
    try {
      const validHeaders = headersConfig.filter(h => h.key.trim() !== '');
      const res = await fetch('/api/integrations/test-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          alert("A API retornou sucesso, mas o objeto está vazio.");
        }
      } else {
        alert(data.error || "Erro ao buscar campos da API.");
      }
    } catch (error) {
      console.error("Failed to load API fields", error);
      alert("Erro de rede ao tentar buscar campos da API.");
    } finally {
      setIsLoadingKeys(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Your Integrations</h2>
          <p className="text-zinc-500 mt-1">Manage your API connections and data pipelines.</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={18} />
          New Integration
        </button>
      </div>

      {/* Integrations List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {integrations.length === 0 ? (
          <div className="col-span-full bg-white border border-dashed border-zinc-300 rounded-xl p-12 text-center">
            <Database className="mx-auto h-12 w-12 text-zinc-400 mb-4" />
            <h3 className="text-lg font-medium text-zinc-900">No integrations yet</h3>
            <p className="text-zinc-500 mt-1">Create your first integration to start syncing data.</p>
          </div>
        ) : (
          integrations.map((integration) => (
            <div key={integration.id} className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Server size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{integration.name}</h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
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
                    className="text-zinc-400 hover:text-green-600 transition-colors p-2 ml-2"
                    title="Run Sync Now"
                  >
                    <Play size={20} />
                  </button>
                </div>
              </div>
              
              <div className="space-y-3 text-sm text-zinc-600 mb-6">
                <div className="flex items-center gap-2">
                  <FileJson size={16} className="text-zinc-400" />
                  <span className="truncate" title={integration.custom_url}>
                    {integration.http_method} {integration.custom_url.substring(0, 30)}...
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {integration.output_type === 'database' ? (
                    <Database size={16} className="text-zinc-400" />
                  ) : (
                    <Download size={16} className="text-zinc-400" />
                  )}
                  <span>Output: {integration.output_type === 'database' ? `DB (${integration.target_table})` : 'CSV Download'}</span>
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-4">
                <button 
                  onClick={() => fetchLogs(integration.id)}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <Activity size={16} />
                  View Execution Logs
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Logs Modal */}
      {selectedIntegration && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50 flex justify-between items-center shrink-0">
              <h3 className="font-semibold flex items-center gap-2">
                <Activity size={18} className="text-zinc-500" />
                Recent Executions
              </h3>
              <button onClick={() => setSelectedIntegration(null)} className="text-zinc-400 hover:text-zinc-600">
                <XCircle size={20} />
              </button>
            </div>
            <div className="divide-y divide-zinc-100 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="p-6 text-center text-zinc-500 text-sm">No executions yet. Run a sync to see logs.</div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {log.status === 'success' ? (
                        <CheckCircle2 size={18} className="text-green-500" />
                      ) : (
                        <XCircle size={18} className="text-red-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-zinc-900">
                          {log.status === 'success' ? `Synced ${log.records_processed} records` : 'Sync Failed'}
                        </p>
                        <p className="text-xs text-zinc-500">{new Date(log.executed_at).toLocaleString()}</p>
                      </div>
                    </div>
                    {log.error_message && (
                      <div className={`text-xs px-2 py-1 rounded max-w-xs truncate ${log.status === 'success' ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`} title={log.error_message}>
                        {log.error_message.includes('/downloads/') ? (
                          <a href={log.error_message.split('Arquivo: ')[1]} target="_blank" rel="noreferrer" className="underline font-medium">Download CSV</a>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center shrink-0">
              <h3 className="font-semibold text-lg">
                {editingId ? 'Editar Integração' : 'Nova Integração'} - Passo {modalStep} de 4
              </h3>
              <button onClick={closeModal} className="text-zinc-400 hover:text-zinc-600">
                <XCircle size={20} />
              </button>
            </div>
            
            {/* Progress Bar */}
            <div className="flex h-1 bg-zinc-100 shrink-0">
              <div className="bg-indigo-600 transition-all duration-300" style={{ width: `${(modalStep / 4) * 100}%` }}></div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
              {/* Step 1: Endpoint */}
              {modalStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Nome da Integração</label>
                    <input 
                      required type="text" placeholder="Ex: Meus Repositórios do GitHub"
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={name} onChange={e => setName(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="w-1/3">
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Método</label>
                      <select 
                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        value={httpMethod} onChange={e => setHttpMethod(e.target.value)}
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                      </select>
                    </div>
                    <div className="w-2/3">
                      <label className="block text-sm font-medium text-zinc-700 mb-1">URL da API</label>
                      <input 
                        required type="url" placeholder="https://api.exemplo.com/dados"
                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={customUrl} onChange={e => setCustomUrl(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Headers */}
              {modalStep === 2 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="block text-sm font-medium text-zinc-700">Headers & Autenticação</label>
                    <button type="button" onClick={addHeader} className="text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1">
                      <Plus size={14} /> Adicionar Header
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500">Estes valores serão criptografados no banco de dados.</p>
                  
                  {headersConfig.map((header, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <input 
                        type="text" placeholder="Key (ex: Authorization)"
                        className="w-1/3 px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        value={header.key} onChange={e => updateHeader(index, 'key', e.target.value)}
                      />
                      <input 
                        type="text" placeholder="Value (ex: Bearer token...)"
                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        value={header.value} onChange={e => updateHeader(index, 'value', e.target.value)}
                      />
                      <button type="button" onClick={() => removeHeader(index)} className="p-2 text-zinc-400 hover:text-red-500 mt-0.5">
                        <XCircle size={18} />
                      </button>
                    </div>
                  ))}
                  {headersConfig.length === 0 && (
                    <div className="text-center p-4 border border-dashed border-zinc-300 rounded-lg text-sm text-zinc-500">
                      Nenhum header configurado.
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Destination */}
              {modalStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-3">Onde salvar os dados?</label>
                    <div className="grid grid-cols-2 gap-4">
                      <label className={`border rounded-xl p-4 cursor-pointer transition-colors ${outputType === 'database' ? 'border-indigo-600 bg-indigo-50' : 'border-zinc-200 hover:border-zinc-300'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <input type="radio" name="output" value="database" checked={outputType === 'database'} onChange={() => setOutputType('database')} className="text-indigo-600" />
                          <span className="font-medium text-zinc-900">Banco de Dados</span>
                        </div>
                        <p className="text-xs text-zinc-500 ml-6">Inserir em PostgreSQL/Supabase</p>
                      </label>
                      <label className={`border rounded-xl p-4 cursor-pointer transition-colors ${outputType === 'csv' ? 'border-indigo-600 bg-indigo-50' : 'border-zinc-200 hover:border-zinc-300'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <input type="radio" name="output" value="csv" checked={outputType === 'csv'} onChange={() => setOutputType('csv')} className="text-indigo-600" />
                          <span className="font-medium text-zinc-900">Arquivo CSV</span>
                        </div>
                        <p className="text-xs text-zinc-500 ml-6">Gerar link para download</p>
                      </label>
                    </div>
                  </div>

                  {outputType === 'database' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">String de Conexão (PostgreSQL)</label>
                        <input 
                          required type="text" placeholder="postgres://user:pass@db.supabase.co:5432/postgres"
                          className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                          value={destDb} onChange={e => setDestDb(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Nome da Tabela de Destino</label>
                        <input 
                          required type="text" placeholder="ex: github_repos"
                          className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                          value={targetTable} onChange={e => setTargetTable(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Mapping */}
              {modalStep === 4 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="block text-sm font-medium text-zinc-700">Mapeamento de Dados (Data Mapping)</label>
                    <div className="flex gap-3">
                      <button 
                        type="button" 
                        onClick={handleLoadApiFields} 
                        disabled={isLoadingKeys}
                        className="text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-2 py-1 rounded font-medium flex items-center gap-1 disabled:opacity-50 transition-colors"
                      >
                        <RefreshCw size={12} className={isLoadingKeys ? "animate-spin" : ""} />
                        {isLoadingKeys ? 'Carregando...' : 'Carregar Campos da API'}
                      </button>
                      <button type="button" onClick={addMapping} className="text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1">
                        <Plus size={14} /> Adicionar Campo
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500">Mapeie os campos do JSON da API para as colunas do seu Banco (ou CSV).</p>
                  
                  <div className="grid grid-cols-2 gap-2 mb-1 px-1">
                    <span className="text-xs font-medium text-zinc-500">Caminho no JSON (ex: id, owner.login)</span>
                    <span className="text-xs font-medium text-zinc-500">Coluna no Destino (ex: id, author_name)</span>
                  </div>

                  {dataMapping.map((mapping, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      {availableJsonKeys.length > 0 && !manualMode[index] ? (
                        <select 
                          required
                          className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
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
                          className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                          value={mapping.jsonPath} onChange={e => updateMapping(index, 'jsonPath', e.target.value)}
                        />
                      )}
                      <input 
                        required type="text" placeholder="Coluna no destino"
                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        value={mapping.dbColumn} onChange={e => updateMapping(index, 'dbColumn', e.target.value)}
                      />
                      <button type="button" onClick={() => removeMapping(index)} className="p-2 text-zinc-400 hover:text-red-500 mt-0.5">
                        <XCircle size={18} />
                      </button>
                    </div>
                  ))}
                  {dataMapping.length === 0 && (
                    <div className="text-center p-4 border border-dashed border-zinc-300 rounded-lg text-sm text-zinc-500">
                      Nenhum mapeamento configurado. O JSON será salvo bruto se for CSV.
                    </div>
                  )}
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="pt-6 mt-6 border-t border-zinc-100 flex gap-3">
                {modalStep > 1 && (
                  <button 
                    type="button" onClick={() => setModalStep(modalStep - 1)}
                    className="w-1/3 bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700 py-2.5 rounded-lg font-medium transition-colors"
                  >
                    Voltar
                  </button>
                )}
                <button 
                  type="submit" disabled={isSubmitting}
                  className={`${modalStep > 1 ? 'w-2/3' : 'w-full'} bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-medium flex justify-center items-center gap-2 transition-colors disabled:opacity-70`}
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
