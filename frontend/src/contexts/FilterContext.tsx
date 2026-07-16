import React, { createContext, useContext, useCallback } from 'react';
import { GlobalFilters } from '../types';
import { useAppStore } from '../stores/appStore';

interface FilterContextType {
  filters: GlobalFilters;
  setFilter: (key: keyof GlobalFilters, value: any) => void;
  setFilters: (filters: Partial<GlobalFilters>) => void;
  resetFilters: () => void;
  applyDateRange: (startDate: Date, endDate: Date) => void;
  getPeriodLabel: () => string;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { filters, setFilters, resetFilters } = useAppStore();

  const setFilter = useCallback(
    (key: keyof GlobalFilters, value: any) => {
      setFilters({ [key]: value });
    },
    [setFilters]
  );

  const applyDateRange = useCallback(
    (startDate: Date, endDate: Date) => {
      setFilters({
        dateRange: { startDate, endDate },
      });
    },
    [setFilters]
  );

  const getPeriodLabel = useCallback(() => {
    if (filters.period === 'custom' && filters.dateRange) {
      const f = (d: Date) =>
        new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      return `${f(filters.dateRange.startDate)} – ${f(filters.dateRange.endDate)}`;
    }
    const labels: Record<string, string> = {
      today: 'Hoje',
      week: 'Esta semana',
      lastWeek: 'Semana passada',
      month: 'Este mês',
      lastMonth: 'Mês passado',
      last30: 'Últimos 30 dias',
      year: 'Este ano',
    };
    return labels[filters.period] || 'Período personalizado';
  }, [filters.period, filters.dateRange]);

  return (
    <FilterContext.Provider
      value={{
        filters,
        setFilter,
        setFilters,
        resetFilters,
        applyDateRange,
        getPeriodLabel,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
};

export const useFilters = () => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within FilterProvider');
  }
  return context;
};

// Helper hook to get specific filter
export const useFilterValue = (key: keyof GlobalFilters) => {
  const { filters } = useFilters();
  return filters[key];
};
