import React, { useState } from 'react';
import { Layout } from '../components';

const HistoryDashboard: React.FC = () => {
  const [selectedType, setSelectedType] = useState<'all' | 'sync' | 'conflict' | 'approval'>('all');

  const historyEvents = [
    {
      id: 1,
      type: 'sync',
      title: 'Sincronização Clairis',
      description: 'Sincronizou 1.247 registros com sucesso',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'success',
    },
    {
      id: 2,
      type: 'conflict',
      title: 'Conflito Detectado',
      description: 'Campo "telefone" diferente entre Pipedrive e Clairis',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      status: 'warning',
    },
    {
      id: 3,
      type: 'approval',
      title: 'Mudança Aprovada',
      description: 'Mudança na data de procedimento foi aprovada',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
      status: 'success',
    },
    {
      id: 4,
      type: 'sync',
      title: 'Sincronização WhatsApp',
      description: 'Sincronizou 3.421 mensagens',
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      status: 'success',
    },
    {
      id: 5,
      type: 'conflict',
      title: 'Duplicata Detectada',
      description: 'Possível paciente duplicado identificado (Score: 92%)',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      status: 'warning',
    },
  ];

  const filteredEvents = selectedType === 'all'
    ? historyEvents
    : historyEvents.filter(e => e.type === selectedType);

  const getIcon = (type: string) => {
    switch(type) {
      case 'sync': return '🔄';
      case 'conflict': return '⚠️';
      case 'approval': return '✅';
      default: return '📋';
    }
  };

  const getTypeLabel = (type: string) => {
    switch(type) {
      case 'sync': return 'Sincronização';
      case 'conflict': return 'Conflito';
      case 'approval': return 'Aprovação';
      default: return 'Evento';
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 1) return 'Há poucos minutos';
    if (hours < 24) return `Há ${hours}h`;
    if (days < 7) return `Há ${days}d`;
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <Layout title="Histórico - Governança">
      <div className="space-y-6">
        {/* Info */}
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 flex gap-3">
          <div className="text-xl">📜</div>
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900">Histórico de Eventos</h3>
            <p className="text-sm text-blue-800">
              Visualize o histórico completo de sincronizações, conflitos e aprovações.
            </p>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          {(['all', 'sync', 'conflict', 'approval'] as const).map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedType === type
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              {type === 'all' && '📋 Todos'}
              {type === 'sync' && '🔄 Sincronizações'}
              {type === 'conflict' && '⚠️ Conflitos'}
              {type === 'approval' && '✅ Aprovações'}
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          {filteredEvents.map((event, idx) => (
            <div
              key={event.id}
              className={`border-l-4 pl-4 py-4 ${
                event.status === 'success' ? 'border-green-500' : 'border-yellow-500'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{getIcon(event.type)}</span>
                    <h3 className="font-semibold text-gray-900">{event.title}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      event.status === 'success'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {event.status === 'success' ? 'Sucesso' : 'Atenção'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{event.description}</p>
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                  {formatTime(event.timestamp)}
                </span>
              </div>
            </div>
          ))}

          {filteredEvents.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>Nenhum evento de {getTypeLabel(selectedType).toLowerCase()} encontrado</p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-700">Sincronizações Sucesso</p>
            <p className="text-2xl font-bold text-green-900 mt-2">
              {historyEvents.filter(e => e.type === 'sync').length}
            </p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-700">Conflitos Detectados</p>
            <p className="text-2xl font-bold text-yellow-900 mt-2">
              {historyEvents.filter(e => e.type === 'conflict').length}
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700">Mudanças Aprovadas</p>
            <p className="text-2xl font-bold text-blue-900 mt-2">
              {historyEvents.filter(e => e.type === 'approval').length}
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default HistoryDashboard;
