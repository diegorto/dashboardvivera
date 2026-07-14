import React, { ReactNode } from 'react';
import { useAppStore } from '../stores/appStore';
import { useTheme } from '../contexts/ThemeContext';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  breadcrumb?: string[];
}

const Layout: React.FC<LayoutProps> = ({ children, title, breadcrumb }) => {
  const { sidebarOpen } = useAppStore();
  const { mode } = useTheme();

  const bgColor = mode === 'dark' ? '#0f172a' : '#f8fafc';
  const textColor = mode === 'dark' ? '#f8fafc' : '#0f172a';

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        backgroundColor: bgColor,
        color: textColor,
        overflow: 'hidden',
      }}
    >
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* TopBar */}
        <TopBar title={title} breadcrumb={breadcrumb} />

        {/* Content Area */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            backgroundColor: bgColor,
          }}
        >
          {children}
        </main>

        {/* Footer */}
        <footer
          style={{
            backgroundColor: mode === 'dark' ? '#1e293b' : '#ffffff',
            borderTop: `1px solid ${mode === 'dark' ? '#1e293b' : '#e2e8f0'}`,
            padding: '12px 24px',
            fontSize: '12px',
            color: mode === 'dark' ? '#64748b' : '#94a3b8',
            textAlign: 'center',
          }}
        >
          Vivera Command Center | Dados atualizados em tempo real
        </footer>
      </div>
    </div>
  );
};

export default Layout;
