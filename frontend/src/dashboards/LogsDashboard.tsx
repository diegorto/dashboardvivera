import React, { useState } from 'react';
import { Layout } from '../components';

const LogsDashboard: React.FC = () => {
  const [selectedLevel, setSelectedLevel] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const logs = [
    {
      id: 1,
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      level: 'info',
      source: 'GovernanceService',
      message: 'Iniciando sincronização com Clairis',
      details: 'Sync ID: sync_12345',
    },
    {
      id: 2,
      timestamp: new Date(Date.now() - 4 * 60 * 1000),
      level: 'info',
      source: 'MockPatientRepository',
      message: 'Carregando 100 pacientes do repositório mock',
      details: 'Tempo: 45ms',
    },
    {
      id: 3,
      timestamp: new Date(Date.now() - 3 * 60 * 1000),
      level: 'warning',
      source: 'DataConflictRepository',
      message: 'Conflito detectado: divergência de telefone',
      details: 'Patient ID: patient_42 | Clairis: (11) 98765-4321 vs Pipedrive: (11) 9876-54321',
    },
    {
      id: 4,
      timestamp: new Date(Date.now() - 2 * 60 * 1000),
      level: 'info',
      source: 'AuditService',
      message: 'Auditoria concluída com sucesso',
      details: 'Registros processados: 1.247 | Conflitos: 8 | Tempo: 2.3s',
    },
    {
      id: 5,
      timestamp: new Date(Date.now() - 1 * 60 * 1000),
      level: 'error',
      source: 'WhatsAppDataSource',
      message: 'Erro ao conectar com API WhatsApp',
      details: 'Erro: Connection timeout | Retry em 30s',
    },
    {
      id: 6,
      timestamp: new Date(Date.now() - 30 * 1000),
      level: 'info',
      source: 'ApprovalQueueRepository',
      message: 'Item aprovado pelo usuário',
      details: 'Approval ID: appr_789 | User: manager@example.com | Timestamp: 2026-07-15T14:32:00Z',
    },
  ];

  const filteredLogs = logs.filter(log => {
    const matchesLevel = selectedLevel === 'all' || log.level === selectedLevel;
    const matchesSearch = searchTerm === '' ||
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.source.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const getLevelColor = (level: string) => {
    switch(level) {
      case 'error': return { bg: 'bg-red-100', text: 'text-red-800', icon: '❌' };
      case 'warning': return { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '⚠️' };
      case 'info': return { bg: 'bg-blue-100', text: 'text-blue-800', icon: 'ℹ️' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-800', icon: '•' };
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const logStats = {
    total: logs.length,
    errors: logs.filter(l => l.level === 'error').length,
    warnings: logs.filter(l => l.level === 'warning').length,
    info: logs.filter(l => l.level === 'info').length,
  };

  return (
    <Layout title="Logs - Governança">
      <div className="space-y-6">
        {/* Info */}
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 flex gap-3">
          <div className="text-xl">📝</div>
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900">Logs do Sistema</h3>
            <p className="text-sm text-blue-800">
              Visualize os logs de operações, erros e eventos do sistema de governança.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-600 uppercase">Total</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{logStats.total}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-blue-600 uppercase">Info</p>
            <p className="text-2xl font-bold text-blue-900 mt-2">{logStats.info}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-xs text-yellow-600 uppercase">Warnings</p>
            <p className="text-2xl font-bold text-yellow-900 mt-2">{logStats.warnings}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-xs text-red-600 uppercase">Errors</p>
            <p className="text-2xl font-bold text-red-900 mt-2">{logStats.errors}</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Pesquisar nos logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            {(['all', 'info', 'warning', 'error'] as const).map(level => (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  selectedLevel === level
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                {level === 'all' && 'Todos'}
                {level === 'info' && 'Info'}
                {level === 'warning' && 'Avisos'}
                {level === 'error' && 'Erros'}
              </button>
            ))}
          </div>
        </div>

        {/* Logs Table */}
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const colors = getLevelColor(log.level);
            return (
              <div key={log.id} className={`border rounded-lg p-4 ${colors.bg}`}>
                <div className="flex items-start gap-3">
                  <span className="text-xl">{colors.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`font-semibold ${colors.text}`}>{log.source}</span>
                      <span className={`text-xs px-2 py-1 rounded uppercase font-medium ${colors.text} ${colors.bg} border border-current`}>
                        {log.level}
                      </span>
                      <span className={`text-xs ${colors.text}`}>
                        {formatTime(log.timestamp)}
                      </span>
                    </div>
                    <p className={`text-sm font-medium ${colors.text} mb-1`}>{log.message}</p>
                    <p className={`text-xs ${colors.text} opacity-75`}>{log.details}</p>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredLogs.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>Nenhum log encontrado</p>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-600 uppercase font-medium mb-2">Informação</p>
          <p className="text-sm text-gray-700">
            Os logs são mantidos em memória. Em produção, considere usar ELK Stack, Datadog ou CloudWatch.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default LogsDashboard;
