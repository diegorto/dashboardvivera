import React, { useEffect, useState } from 'react';
import { KPICard, Layout } from '../components';
import { governanceAPI } from '../services/api';
import { useAppStore } from '../stores/appStore';

interface Conflict {
  id: string;
  entityType: string;
  fieldName: string;
  source1: string;
  value1: string;
  source2: string;
  value2: string;
  severity: string;
  suggestion: string;
  status: string;
}

const ConflictsDashboard: React.FC = () => {
  const { addNotification } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    loadConflicts();
  }, []);

  const loadConflicts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await governanceAPI.getUnresolvedConflicts();
      setConflicts(response.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar conflitos';
      setError(errorMessage);
      addNotification('error', `Erro: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (conflictId: string, suggestion: string) => {
    try {
      setResolving(conflictId);
      await governanceAPI.resolveConflict(conflictId, suggestion);
      addNotification('success', 'Conflito resolvido com sucesso');
      await loadConflicts();
    } catch (err) {
      addNotification('error', 'Erro ao resolver conflito');
    } finally {
      setResolving(null);
    }
  };

  const stats = {
    total: conflicts.length,
    critical: conflicts.filter(c => c.severity === 'crítico').length,
    high: conflicts.filter(c => c.severity === 'alto').length,
    medium: conflicts.filter(c => c.severity === 'médio').length,
  };

  if (error) {
    return (
      <Layout title="Conflitos">
        <div className="flex items-center justify-center h-full">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-lg font-semibold text-red-900 mb-2">Erro ao carregar dados</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={loadConflicts}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Conflitos - Governança">
      <div className="space-y-6">
        {/* KPIs */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700 mb-4">
            ⚠️ Resumo de Conflitos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Total de Conflitos"
              value={stats.total}
              change={stats.total > 0 ? 5.0 : -2.0}
              sub="não resolvidos"
            />
            <KPICard
              label="Críticos"
              value={stats.critical}
              change={1.0}
              sub="prioridade alta"
            />
            <KPICard
              label="Altos"
              value={stats.high}
              change={2.5}
              sub="exigem atenção"
            />
            <KPICard
              label="Médios"
              value={stats.medium}
              change={0.5}
              sub="baixa prioridade"
            />
          </div>
        </div>

        {/* Alert */}
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex gap-3">
          <div className="text-xl">🔴</div>
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Conflitos Ativos</h3>
            <p className="text-sm text-red-800">
              Existem {stats.total} conflitos aguardando resolução. Clique em um item para visualizar e aprovar.
            </p>
          </div>
        </div>

        {/* Conflicts List */}
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" />
          </div>
        ) : (
          <div className="space-y-4">
            {conflicts.map(conflict => (
              <div key={conflict.id} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {conflict.entityType} - {conflict.fieldName}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">ID: {conflict.id}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    conflict.severity === 'crítico'
                      ? 'bg-red-100 text-red-800'
                      : conflict.severity === 'alto'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {conflict.severity.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Fonte 1</p>
                    <p className="font-medium text-gray-900">{conflict.source1}</p>
                    <p className="text-sm text-gray-700 bg-blue-50 rounded p-2 mt-2 break-words">
                      {conflict.value1}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Fonte 2</p>
                    <p className="font-medium text-gray-900">{conflict.source2}</p>
                    <p className="text-sm text-gray-700 bg-orange-50 rounded p-2 mt-2 break-words">
                      {conflict.value2}
                    </p>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded p-3 mb-4">
                  <p className="text-xs text-green-700 font-medium">SUGESTÃO</p>
                  <p className="text-sm text-green-900 mt-1">{conflict.suggestion}</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleResolve(conflict.id, conflict.suggestion)}
                    disabled={resolving === conflict.id}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {resolving === conflict.id ? 'Processando...' : '✓ Aprovar Sugestão'}
                  </button>
                  <button
                    onClick={() => addNotification('info', 'Funcionalidade de revisão em desenvolvimento')}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    📝 Revisar
                  </button>
                </div>
              </div>
            ))}

            {conflicts.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
                <p className="text-green-900 font-medium">✓ Nenhum conflito pendente</p>
                <p className="text-sm text-green-700 mt-2">Todos os conflitos foram resolvidos!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ConflictsDashboard;
