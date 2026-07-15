import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Download } from 'lucide-react';
import { COLORS, SPACING, BORDER_RADIUS } from '../styles/tokens';

// Simple table component with sorting, filtering, pagination
interface Column<T> {
  id: keyof T | string;
  header: string;
  accessorKey?: keyof T;
  cell?: (value: T[keyof T], row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  format?: 'currency' | 'percentage' | 'number' | 'date' | 'text';
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  pageSize?: number;
  searchable?: boolean;
  sortable?: boolean;
  exportable?: boolean;
  title?: string;
  isLoading?: boolean;
}

const formatValue = (value: any, format?: string): string => {
  if (value === null || value === undefined) return '-';

  switch (format) {
    case 'currency':
      return `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    case 'percentage':
      return `${Number(value).toFixed(1)}%`;
    case 'number':
      return Number(value).toLocaleString('pt-BR');
    case 'date':
      return new Date(value).toLocaleDateString('pt-BR');
    default:
      return String(value);
  }
};

export const DataTable = <T extends Record<string, any>>({
  columns,
  data,
  onRowClick,
  pageSize = 10,
  searchable = true,
  sortable = true,
  exportable = true,
  title,
  isLoading = false,
}: DataTableProps<T>) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; order: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // Filter data
  const filteredData = searchQuery
    ? data.filter((row) =>
        Object.values(row).some((val) => String(val).toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : data;

  // Sort data
  const sortedData = sortConfig
    ? [...filteredData].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortConfig.order === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        return sortConfig.order === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      })
    : filteredData;

  // Paginate
  const paginatedData = sortedData.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (columnId: string) => {
    setSortConfig((prev) => {
      if (prev?.key === columnId) {
        return prev.order === 'asc' ? { key: columnId, order: 'desc' } : null;
      }
      return { key: columnId, order: 'asc' };
    });
    setCurrentPage(0);
  };

  const handleExport = () => {
    const csv = [
      columns.map((col) => col.header).join(','),
      ...sortedData.map((row) =>
        columns
          .map((col) => {
            const key = col.accessorKey || col.id;
            const value = row[key as string];
            return `"${formatValue(value, col.format)}"`;
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dados-${new Date().toISOString()}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <div
        style={{
          backgroundColor: COLORS.neutral[0],
          borderRadius: BORDER_RADIUS.lg,
          padding: SPACING.xl,
          textAlign: 'center',
          color: COLORS.neutral[500],
        }}
      >
        Carregando dados...
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: COLORS.neutral[0],
        borderRadius: BORDER_RADIUS.lg,
        border: `1px solid ${COLORS.neutral[200]}`,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: SPACING.lg, borderBottom: `1px solid ${COLORS.neutral[200]}` }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: SPACING.lg,
            marginBottom: SPACING.md,
          }}
        >
          {title && <h3 style={{ fontSize: '16px', fontWeight: '600' }}>{title}</h3>}
          <div style={{ flex: 1 }} />
          {exportable && (
            <button
              onClick={handleExport}
              style={{
                padding: `${SPACING.sm} ${SPACING.lg}`,
                backgroundColor: COLORS.primary[500],
                color: COLORS.neutral[0],
                border: 'none',
                borderRadius: BORDER_RADIUS.md,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: SPACING.sm,
                fontSize: '12px',
                fontWeight: '600',
              }}
            >
              <Download size={16} />
              Exportar
            </button>
          )}
        </div>

        {searchable && (
          <input
            type="text"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(0);
            }}
            style={{
              width: '100%',
              padding: `${SPACING.sm} ${SPACING.md}`,
              borderRadius: BORDER_RADIUS.md,
              border: `1px solid ${COLORS.neutral[200]}`,
              fontSize: '14px',
            }}
          />
        )}

        <p style={{ fontSize: '12px', color: COLORS.neutral[500], marginTop: SPACING.md }}>
          {sortedData.length} resultado{sortedData.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: COLORS.neutral[50], borderBottom: `1px solid ${COLORS.neutral[200]}` }}>
              {columns.map((col) => (
                <th
                  key={String(col.id)}
                  onClick={() => col.sortable !== false && handleSort(String(col.id))}
                  style={{
                    padding: SPACING.md,
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: COLORS.neutral[700],
                    cursor: col.sortable !== false ? 'pointer' : 'default',
                    userSelect: 'none',
                    width: col.width,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
                    {col.header}
                    {col.sortable !== false && sortConfig?.key === String(col.id) && (
                      sortConfig.order === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                onClick={() => onRowClick?.(row)}
                style={{
                  borderBottom: `1px solid ${COLORS.neutral[100]}`,
                  backgroundColor: rowIdx % 2 === 0 ? COLORS.neutral[0] : COLORS.neutral[50],
                  cursor: onRowClick ? 'pointer' : 'default',
                }}
                onMouseEnter={(e) => {
                  if (onRowClick) {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor = COLORS.primary[50];
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                    rowIdx % 2 === 0 ? COLORS.neutral[0] : COLORS.neutral[50];
                }}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.id)}
                    style={{
                      padding: SPACING.md,
                      fontSize: '14px',
                      color: COLORS.neutral[900],
                    }}
                  >
                    {col.cell
                      ? col.cell(row[col.accessorKey || col.id], row, rowIdx)
                      : formatValue(row[col.accessorKey || col.id], col.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedData.length === 0 && (
        <div
          style={{
            padding: SPACING.xl,
            textAlign: 'center',
            color: COLORS.neutral[500],
          }}
        >
          Nenhum resultado encontrado
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            padding: SPACING.lg,
            borderTop: `1px solid ${COLORS.neutral[200]}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
          }}
        >
          <span style={{ color: COLORS.neutral[600] }}>
            Página {currentPage + 1} de {totalPages}
          </span>

          <div style={{ display: 'flex', gap: SPACING.md }}>
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              style={{
                padding: `${SPACING.sm} ${SPACING.md}`,
                border: `1px solid ${COLORS.neutral[200]}`,
                backgroundColor: COLORS.neutral[0],
                borderRadius: BORDER_RADIUS.md,
                cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 0 ? 0.5 : 1,
              }}
            >
              Anterior
            </button>

            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage === totalPages - 1}
              style={{
                padding: `${SPACING.sm} ${SPACING.md}`,
                border: `1px solid ${COLORS.neutral[200]}`,
                backgroundColor: COLORS.neutral[0],
                borderRadius: BORDER_RADIUS.md,
                cursor: currentPage === totalPages - 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === totalPages - 1 ? 0.5 : 1,
              }}
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
