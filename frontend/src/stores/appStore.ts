import { create } from 'zustand';
import { GlobalFilters } from '../types';

interface AppState {
  // UI State
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Global Filters
  filters: GlobalFilters;
  setFilters: (filters: Partial<GlobalFilters>) => void;
  resetFilters: () => void;

  // Current Page
  currentPage: string;
  setCurrentPage: (page: string) => void;

  // Loading States
  isLoading: boolean;
  setLoading: (loading: boolean) => void;

  // Search Query
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Notifications/Alerts
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
    timestamp: number;
  }>;
  addNotification: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  removeNotification: (id: string) => void;

  // User Settings
  userSettings: {
    autoRefresh: boolean;
    refreshInterval: number;
    comparisonPeriod: 'previous-period' | 'previous-year';
    defaultChartType: 'line' | 'bar' | 'pie';
  };
  setUserSettings: (settings: Partial<AppState['userSettings']>) => void;
}

const defaultFilters: GlobalFilters = {
  period: 'month',
};

const defaultUserSettings = {
  autoRefresh: true,
  refreshInterval: 60000, // 1 minute
  comparisonPeriod: 'previous-period' as const,
  defaultChartType: 'line' as const,
};

export const useAppStore = create<AppState>((set) => ({
  // UI State
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  // Global Filters
  filters: defaultFilters,
  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),
  resetFilters: () => set({ filters: defaultFilters }),

  // Current Page
  currentPage: 'executive',
  setCurrentPage: (page) => set({ currentPage: page }),

  // Loading
  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),

  // Search
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  // Notifications
  notifications: [],
  addNotification: (type, message) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        {
          id: Date.now().toString(),
          type,
          message,
          timestamp: Date.now(),
        },
      ],
    })),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  // User Settings
  userSettings: {
    ...defaultUserSettings,
    ...JSON.parse(localStorage.getItem('userSettings') || '{}'),
  },
  setUserSettings: (newSettings) =>
    set((state) => {
      const updated = { ...state.userSettings, ...newSettings };
      localStorage.setItem('userSettings', JSON.stringify(updated));
      return { userSettings: updated };
    }),
}));

// Derived hooks
export const useSidebarOpen = () => useAppStore((state) => state.sidebarOpen);
export const useFilters = () => useAppStore((state) => state.filters);
export const useCurrentPage = () => useAppStore((state) => state.currentPage);
export const useIsLoading = () => useAppStore((state) => state.isLoading);
export const useSearchQuery = () => useAppStore((state) => state.searchQuery);
export const useNotifications = () => useAppStore((state) => state.notifications);
export const useUserSettings = () => useAppStore((state) => state.userSettings);
