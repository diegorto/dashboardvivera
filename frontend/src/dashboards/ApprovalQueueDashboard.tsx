import React, { useEffect, useState } from 'react';
import { KPICard, Layout } from '../components';
import { governanceAPI } from '../services/api';
import { useAppStore } from '../stores/appStore';

interface ApprovalItem {
  id: string;
  auditItemId: string;
  priority: string;
  status: string;
  createdAt: Date;
  daysWaiting: number;
  isOverdue: boolean;
}

const ApprovalQueueDashboard: React.FC = () => {
  const { addNotification } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadApprovals();
  }, []);

  const loadApprovals = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await governanceAPI.getPendingApprovals();
      setApprovals(response.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar fila';
      setError(errorMessage);
      addNotification('error', `Erro: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      setProcessing(id);
      const userId = 'current_user'; // Future: get from auth
      await governanceAPI.approveItem(id, userId);
      addNotification('success', 'Item aprovado com sucesso');
      await loadApprovals();
    } catch (err) {
      addNotification('error', 'Erro ao aprovar item');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    try {
      setProcessing(id);
      const userId = 'current_user'; // Future: get from auth
      await governanceAPI.rejectItem(id, userId);
      addNotification('success', 'Item rejeitado');
      await loadApprovals();
    } catch (err) {
      addNotification('error', 'Erro ao rejeitar item');
    } finally {
      setProcessing(null);
    }
  };

  const stats = {
    total: approvals.length,
    high: approvals.filter(a => a.priority === 'HIGH').length,
    medium: approvals.filter(a => a.priority === 'MEDIUM').length,
    overdue: approvals.filter(a => a.isOverdue).length,
  };

  if (error) {
    return (
      <Layout title="Fila de Aprovação">
        <div className="flex items-center justify-center h-full">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-lg font-semibold text-red-900 mb-2">Erro ao carregar dados</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={loadApprovals}
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
    <Layout title="Fila de Aprovação - Governança">
      <div className="space-y-6">
        {/* KPIs */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700 mb-4">
            ✅ Resumo da Fila
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Total na Fila"
              value={stats.total}
              change={stats.total > 0 ? 3.2 : 0}
              sub="itens pendentes"
            />
            <KPICard
              label="Prioridade Alta"
              value={stats.high}
              change={1.5}
              sub="exigem ação"
            />
            <KPICard
              label="Prioridade Média"
              value={stats.medium}
              change={0.8}
              sub="rotina"
            />
            <KPICard
              label="Vencidas"
              value={stats.overdue}
              change={stats.overdue > 0 ? -2.0 : 0}
              sub="> 7 dias"
            />
          </div>
        </div>

        {/* Alert */}
        {stats.overdue > 0 && (
          <div className="bg-orange-50 border-l-4 border-orange-500 rounded-lg p-4 flex gap-3">
            <div className="text-xl">⚠️</div>
            <div className="flex-1">
              <h3 className="font-semibold text-orange-900">Itens Vencidos</h3>
              <p className="text-sm text-orange-800">
                {stats.overdue} itens aguardam aprovação há mais de 7 dias.
              </p>
            </div>
          </div>
        )}

        {/* Queue List */}
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="space-y-4">
            {approvals.map(item => (
              <div
                key={item.id}
                className={`border rounded-lg p-6 ${
                  item.isOverdue
                    ? 'bg-orange-50 border-orange-300'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Audit Item: {item.auditItemId}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">ID: {item.id}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      item.priority === 'HIGH'
                        ? 'bg-red-100 text-red-800'
                        : item.priority === 'MEDIUM'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {item.priority}
                    </span>
                    {item.isOverdue && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        🔴 VENCIDA
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                  <div>
                    <span className="font-medium text-gray-900">{item.daysWaiting}</span> dias aguardando
                  </div>
                  <div>
                    Criado em: {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleApprove(item.id)}
                    disabled={processing === item.id}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {processing === item.id ? 'Processando...' : '✓ Aprovar'}
                  </button>
                  <button
                    onClick={() => handleReject(item.id)}
                    disabled={processing === item.id}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {processing === item.id ? 'Processando...' : '✗ Rejeitar'}
                  </button>
                </div>
              </div>
            ))}

            {approvals.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
                <p className="text-green-900 font-medium">✓ Fila vazia</p>
                <p className="text-sm text-green-700 mt-2">Nenhum item aguardando aprovação!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ApprovalQueueDashboard;
