import React, { useState } from 'react';
import Layout from './components/Layout';
import ExecutiveDashboard from './dashboards/ExecutiveDashboard';

type Page = 'executive' | 'marketing' | 'comercial' | 'crm' | 'agenda' | 'campanhas' | 'conjuntos' | 'criativos' | 'pacientes' | 'profissionais' | 'sdrs' | 'whatsapp' | 'financeiro' | 'ia' | 'configuracoes';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('executive');

  const renderDashboard = () => {
    switch (currentPage) {
      case 'executive':
        return <ExecutiveDashboard />;
      default:
        return (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <h2>Página em desenvolvimento: {currentPage}</h2>
            <p style={{ color: '#666', marginTop: '16px' }}>
              Este dashboard será implementado na próxima fase.
            </p>
          </div>
        );
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={(page) => setCurrentPage(page as Page)}>
      {renderDashboard()}
    </Layout>
  );
};

export default App;
