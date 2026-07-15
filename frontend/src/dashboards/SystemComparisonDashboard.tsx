import React, { useState } from 'react';
import { Layout } from '../components';

const SystemComparisonDashboard: React.FC = () => {
  const [selectedSources] = useState(['Pipedrive', 'Clairis', 'WhatsApp']);

  const comparisonData = [
    { entity: 'Pacientes', pipedrive: 1243, clairis: 1198, whatsapp: 1156, conflicts: 12 },
    { entity: 'Procedimentos', pipedrive: 856, clairis: 892, whatsapp: 0, conflicts: 5 },
    { entity: 'Agendamentos', pipedrive: 342, clairis: 328, whatsapp: 301, conflicts: 8 },
    { entity: 'Mensagens', pipedrive: 0, clairis: 0, whatsapp: 5234, conflicts: 0 },
    { entity: 'Deals', pipedrive: 423, clairis: 0, whatsapp: 0, conflicts: 0 },
  ];

  return (
    <Layout title="Comparação entre Sistemas - Governança">
      <div className="space-y-6">
        {/* Info */}
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 flex gap-3">
          <div className="text-xl">🔄</div>
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900">Comparação de Fontes</h3>
            <p className="text-sm text-blue-800">
              Visualize as diferenças entre os dados das diferentes fontes de integração.
            </p>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Entidade</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700">Pipedrive</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700">Clairis</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700">WhatsApp</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700">Conflitos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {comparisonData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.entity}</td>
                    <td className="px-6 py-4 text-sm text-center text-gray-700">
                      <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-900 font-semibold">
                        {row.pipedrive}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-center text-gray-700">
                      <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-900 font-semibold">
                        {row.clairis}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-center text-gray-700">
                      <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 text-orange-900 font-semibold">
                        {row.whatsapp}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      {row.conflicts > 0 ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          ⚠️ {row.conflicts}
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900">Pipedrive</h3>
            <p className="text-sm text-blue-700 mt-2">CRM principal com informações de deals e pacientes</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900">Clairis</h3>
            <p className="text-sm text-green-700 mt-2">Sistema de saúde com dados clínicos e procedimentos</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h3 className="font-semibold text-orange-900">WhatsApp</h3>
            <p className="text-sm text-orange-700 mt-2">Canal de comunicação com pacientes</p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SystemComparisonDashboard;
