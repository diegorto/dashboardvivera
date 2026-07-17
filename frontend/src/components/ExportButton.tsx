import React, { useState } from 'react';
import ExportService from '../services/exportService';

interface ExportButtonProps {
  data: Record<string, any>;
  cardTitle: string;
  filename?: string;
  variant?: 'icon' | 'text' | 'full';
  className?: string;
}

const ExportButton: React.FC<ExportButtonProps> = ({
  data,
  cardTitle,
  filename,
  variant = 'icon',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleExportCSV = () => {
    ExportService.exportCardToCSV(cardTitle, data, {
      filename: filename || cardTitle.toLowerCase().replace(/\s+/g, '-'),
    });
    setIsOpen(false);
  };

  const handleExportJSON = () => {
    ExportService.exportCardToJSON(cardTitle, data, {
      filename: filename || cardTitle.toLowerCase().replace(/\s+/g, '-'),
    });
    setIsOpen(false);
  };

  const handleCopyJSON = () => {
    const json = JSON.stringify(data, null, 2);
    ExportService.copyToClipboard(json, 'JSON copiado!');
    setIsOpen(false);
  };

  if (variant === 'icon') {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`p-2 hover:bg-gray-100 rounded-lg transition ${className}`}
          title="Exportar dados"
        >
          📥
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 mt-2 w-48 bg-white border border-[#e2e8f0] rounded-lg shadow-lg z-50">
              <button
                onClick={handleExportCSV}
                className="w-full text-left px-4 py-2 text-sm text-[#0f172a] hover:bg-[#f8fafc] first:rounded-t-lg"
              >
                📊 Exportar CSV
              </button>
              <button
                onClick={handleExportJSON}
                className="w-full text-left px-4 py-2 text-sm text-[#0f172a] hover:bg-[#f8fafc]"
              >
                📄 Exportar JSON
              </button>
              <button
                onClick={handleCopyJSON}
                className="w-full text-left px-4 py-2 text-sm text-[#0f172a] hover:bg-[#f8fafc] last:rounded-b-lg"
              >
                📋 Copiar JSON
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (variant === 'text') {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`text-sm px-3 py-1 text-[#6366f1] hover:text-[#4f46e5] ${className}`}
        >
          Exportar ▼
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 mt-2 w-48 bg-white border border-[#e2e8f0] rounded-lg shadow-lg z-50">
              <button
                onClick={handleExportCSV}
                className="w-full text-left px-4 py-2 text-sm text-[#0f172a] hover:bg-[#f8fafc]"
              >
                CSV
              </button>
              <button
                onClick={handleExportJSON}
                className="w-full text-left px-4 py-2 text-sm text-[#0f172a] hover:bg-[#f8fafc]"
              >
                JSON
              </button>
              <button
                onClick={handleCopyJSON}
                className="w-full text-left px-4 py-2 text-sm text-[#0f172a] hover:bg-[#f8fafc]"
              >
                Copiar
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleExportCSV}
        className={`px-4 py-2 text-sm font-medium text-white bg-[#6366f1] rounded-lg hover:bg-[#4f46e5] transition ${className}`}
      >
        📊 CSV
      </button>
      <button
        onClick={handleExportJSON}
        className={`px-4 py-2 text-sm font-medium text-white bg-[#6366f1] rounded-lg hover:bg-[#4f46e5] transition ${className}`}
      >
        📄 JSON
      </button>
      <button
        onClick={handleCopyJSON}
        className={`px-4 py-2 text-sm font-medium text-white bg-[#6366f1] rounded-lg hover:bg-[#4f46e5] transition ${className}`}
      >
        📋 Copiar
      </button>
    </div>
  );
};

export default ExportButton;
