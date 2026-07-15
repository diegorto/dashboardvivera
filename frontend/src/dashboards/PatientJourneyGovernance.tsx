import React, { useEffect, useState } from 'react';
import { KPICard, Layout } from '../components';
import { governanceAPI } from '../services/api';
import { useAppStore } from '../stores/appStore';

interface PatientJourney {
  patientId: string;
  currentStage: string;
  priority: string;
  isDuplicate: boolean;
  hasConflicts: boolean;
  lastContactDays: number;
  totalEvents: number;
  stageDuration: number;
  recentEvents: any[];
}

const PatientJourneyGovernance: React.FC = () => {
  const { addNotification } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState('Novo Lead');
  const [patients, setPatients] = useState<PatientJourney[]>([]);
  const [stages] = useState([
    'Novo Lead',
    'Lead Qualificado',
    'Agendado',
    'Compareceu',
    'Procedimento Realizado',
    'Pós-Operatório',
    'Alta',
    'Jornada Concluída'
  ]);

  useEffect(() => {
    loadPatientsByStage(selectedStage);
  }, [selectedStage]);

  const loadPatientsByStage = async (stage: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await governanceAPI.listPatientsByStage(stage);
      setPatients(response.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar pacientes';
      setError(errorMessage);
      addNotification('error', `Erro: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <Layout title="Jornada do Paciente">
        <div className="flex items-center justify-center h-full">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-lg font-semibold text-red-900 mb-2">Erro ao carregar dados</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={() => loadPatientsByStage(selectedStage)}
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
    <Layout title="Jornada do Paciente - Governança">
      <div className="space-y-6">
        {/* Stage Selector */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700 mb-4">
            📊 Selecione o Estágio da Jornada
          </h2>
          <div className="flex flex-wrap gap-2">
            {stages.map(stage => (
              <button
                key={stage}
                onClick={() => setSelectedStage(stage)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedStage === stage
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {stage}
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 flex gap-3">
          <div className="text-xl">ℹ️</div>
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900">Análise de Jornada</h3>
            <p className="text-sm text-blue-800">
              {patients.length} pacientes no estágio "{selectedStage}". Clique em um paciente para detalhes completos.
            </p>
          </div>
        </div>

        {/* Patients Table */}
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">ID Paciente</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Estágio</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Prioridade</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Duplicata</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Conflitos</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Dias s/ Contato</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Eventos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {patients.map(patient => (
                    <tr key={patient.patientId} className="hover:bg-gray-50 cursor-pointer transition">
                      <td className="px-6 py-4 text-sm text-gray-900">{patient.patientId}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{patient.currentStage}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          patient.priority.includes('Crítico')
                            ? 'bg-red-100 text-red-800'
                            : patient.priority.includes('Alto')
                            ? 'bg-orange-100 text-orange-800'
                            : patient.priority.includes('Médio')
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {patient.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {patient.isDuplicate ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            ⚠️ Sim
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {patient.hasConflicts ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            ⚠️ Sim
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{patient.lastContactDays}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{patient.totalEvents}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PatientJourneyGovernance;
