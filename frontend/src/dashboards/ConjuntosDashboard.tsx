import React from 'react';

const ConjuntosDashboard: React.FC = () => {
  return (
    <div style={{ padding: '32px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '16px' }}>
        Conjuntos Dashboard
      </h1>
      <p style={{ color: '#666', marginBottom: '24px', fontSize: '14px' }}>
        Este dashboard será implementado nas próximas fases do projeto.
      </p>

      <div
        style={{
          backgroundColor: '#f0f7ff',
          borderLeft: '4px solid #0284c7',
          borderRadius: '8px',
          padding: '16px',
        }}
      >
        <p style={{ color: '#0284c7', fontWeight: '600', marginBottom: '8px' }}>
          Estrutura de Dados:
        </p>
        <ul style={{ color: '#0284c7', marginLeft: '20px', fontSize: '14px' }}>
          <li>API integrada e tipada</li>
          <li>Componentes base prontos para uso</li>
          <li>Filtros globais conectados</li>
          <li>Estado global (Zustand) disponível</li>
        </ul>
      </div>

      <div
        style={{
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
          padding: '16px',
          marginTop: '24px',
          fontSize: '12px',
          color: '#666',
        }}
      >
        <p>
          <strong>Layout:</strong> Sidebar + Header + Filtros Globais
        </p>
        <p>
          <strong>Temas:</strong> Dark Mode / Light Mode (automático)
        </p>
        <p>
          <strong>Design System:</strong> Tokens, Cores, Tipografia
        </p>
      </div>
    </div>
  );
};

export default ConjuntosDashboard;
