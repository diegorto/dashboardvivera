import React, { useState } from 'react';
import { Layout } from '../components';

const DataNormalizationDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'fields' | 'formats'>('overview');

  const normalizationStats = [
    { field: 'Nome de Paciente', status: 'Normalizado', coverage: 100 },
    { field: 'Data de Nascimento', status: 'Normalizado', coverage: 98 },
    { field: 'Telefone', status: 'Parcialmente', coverage: 85 },
    { field: 'E-mail', status: 'Normalizado', coverage: 92 },
    { field: 'Endereço', status: 'Parcialmente', coverage: 75 },
    { field: 'CPF', status: 'Normalizado', coverage: 96 },
    { field: 'Procedimento', status: 'Parcialmente', coverage: 88 },
    { field: 'Data de Procedimento', status: 'Normalizado', coverage: 99 },
  ];

  return (
    <Layout title="Normalização de Dados - Governança">
      <div className="space-y-6">
        {/* Info */}
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 flex gap-3">
          <div className="text-xl">🔧</div>
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900">Normalização de Dados</h3>
            <p className="text-sm text-blue-800">
              Visualize o status de normalização dos campos de dados em diferentes fontes.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border border-gray-200 rounded-xl p-0">
          <div className="flex border-b border-gray-200">
            {(['overview', 'fields', 'formats'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-6 py-3 text-sm font-medium transition ${
                  activeTab === tab
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab === 'overview' && '📊 Visão Geral'}
                {tab === 'fields' && '📋 Campos'}
                {tab === 'formats' && '🔄 Formatos'}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="text-center p-6 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-4xl font-bold text-green-900">92.3%</p>
                  <p className="text-sm text-green-700 mt-2">Taxa de Normalização Média</p>
                </div>
                <div className="text-center p-6 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-4xl font-bold text-blue-900">8/8</p>
                  <p className="text-sm text-blue-700 mt-2">Campos Processados</p>
                </div>
              </div>
            )}

            {activeTab === 'fields' && (
              <div className="space-y-4">
                {normalizationStats.map((item, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{item.field}</h4>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        item.status === 'Normalizado'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          item.coverage >= 95 ? 'bg-green-500' : 'bg-yellow-500'
                        }`}
                        style={{ width: `${item.coverage}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-2">{item.coverage}% de cobertura</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'formats' && (
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Regras de Normalização Aplicadas</h4>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li>✓ Capitalização consistente de nomes</li>
                    <li>✓ Formato de data padronizado (DD/MM/YYYY)</li>
                    <li>✓ Telefone: (XX) XXXXX-XXXX</li>
                    <li>✓ E-mail: lowercase + domain validation</li>
                    <li>✓ CPF: XXX.XXX.XXX-XX</li>
                    <li>✓ Remoção de espaços e caracteres especiais</li>
                    <li>✓ Encoding UTF-8 em todos os campos</li>
                  </ul>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-3">Próximas Melhorias</h4>
                  <ul className="space-y-2 text-sm text-blue-700">
                    <li>• Integração com banco de dados de CEPs</li>
                    <li>• Validação de endereço com API externa</li>
                    <li>• Detecção de duplicatas aprimorada</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DataNormalizationDashboard;
