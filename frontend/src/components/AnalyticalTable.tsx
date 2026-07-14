import React, { useState, useMemo } from 'react';
import { Search, Download, ChevronUp, ChevronDown } from 'lucide-react';
import { COLORS, SPACING, BORDER_RADIUS } from '../styles/tokens';

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  format?: 'currency' | 'percentage' | 'number' | 'text';
}

interface AnalyticalTableProps {
  columns: Column[];
  data: Record<string, any>[];
  onRowClick?: (row: Record<string, any>) => void;
  title?: string;
  exportable?: boolean;
}

const AnalyticalTable: React.FC<AnalyticalTableProps> = ({
  columns,
  data,
  onRowClick,
  title,
  exportable = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filteredData = useMemo(() => {
    return data.filter((row) =>
      Object.values(row).some((val) =>
        String(val).toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [data, searchQuery]);

  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [filteredData, sortKey, sortOrder]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const formatValue = (value: any, format?: string): string => {
    if (value === null || value === undefined) return '-';

    switch (format) {
      case 'currency':
        return `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      case 'percentage':
        return `${Number(value).toFixed(1)}%`;
      case 'number':
        return Number(value).toLocaleString('pt-BR');
      default:
        return String(value);
    }
  };

  const handleExport = () => {
    const csv = [
      columns.map((col) => col.label).join(','),
      ...sortedData.map((row) =>
        columns.map((col) => `"${formatValue(row[col.key], col.format)}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dados-${new Date().toISOString()}.csv`;
    link.click();
  };

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
          }}
        >
          {title && <h3 style={{ fontSize: '16px', fontWeight: '600' }}>{title}</h3>}

          <div
            style={{
              flex: 1,
              display: 'flex',
              gap: SPACING.md,
            }}
          >
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: SPACING.md,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: COLORS.neutral[400],
                }}
              />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: `${SPACING.sm} ${SPACING.md} ${SPACING.sm} ${SPACING.xl}`,
                  borderRadius: BORDER_RADIUS.md,
                  border: `1px solid ${COLORS.neutral[200]}`,
                  fontSize: '14px',
                }}
              />
            </div>

            {/* Export */}
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
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                <Download size={16} />
                Exportar
              </button>
            )}
          </div>
        </div>

        {/* Results counter */}
        <p style={{ fontSize: '12px', color: COLORS.neutral[500], marginTop: SPACING.md }}>
          {sortedData.length} resultado{sortedData.length !== 1 ? 's' : ''} encontrado
          {searchQuery && `s para "${searchQuery}"`}
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
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  style={{
                    padding: SPACING.md,
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: COLORS.neutral[700],
                    cursor: col.sortable ? 'pointer' : 'default',
                    userSelect: 'none',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: SPACING.sm,
                    }}
                  >
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, idx) => (
              <tr
                key={idx}
                onClick={() => onRowClick?.(row)}
                style={{
                  borderBottom: `1px solid ${COLORS.neutral[100]}`,
                  backgroundColor: idx % 2 === 0 ? COLORS.neutral[0] : COLORS.neutral[50],
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background-color 200ms',
                }}
                onMouseEnter={(e) => {
                  if (onRowClick) {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor = COLORS.primary[50];
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                    idx % 2 === 0 ? COLORS.neutral[0] : COLORS.neutral[50];
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: SPACING.md,
                      fontSize: '14px',
                      color: COLORS.neutral[900],
                    }}
                  >
                    {formatValue(row[col.key], col.format)}
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
            fontSize: '14px',
          }}
        >
          Nenhum resultado encontrado
        </div>
      )}
    </div>
  );
};

export default AnalyticalTable;
