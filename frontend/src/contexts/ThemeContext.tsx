import React, { createContext, useContext, useEffect, useState } from 'react';
import { COLORS } from '../styles/tokens';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  colors: typeof COLORS;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    // Check localStorage or system preference
    const stored = localStorage.getItem('theme-mode');
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('theme-mode', mode);

    // Update CSS variables for theme
    if (mode === 'dark') {
      document.documentElement.style.setProperty('--bg-primary', COLORS.neutral[900]);
      document.documentElement.style.setProperty('--bg-secondary', COLORS.neutral[800]);
      document.documentElement.style.setProperty('--text-primary', COLORS.neutral[0]);
      document.documentElement.style.setProperty('--text-secondary', COLORS.neutral[300]);
      document.documentElement.style.setProperty('--border-color', COLORS.neutral[700]);
    } else {
      document.documentElement.style.setProperty('--bg-primary', COLORS.neutral[0]);
      document.documentElement.style.setProperty('--bg-secondary', COLORS.neutral[50]);
      document.documentElement.style.setProperty('--text-primary', COLORS.neutral[900]);
      document.documentElement.style.setProperty('--text-secondary', COLORS.neutral[600]);
      document.documentElement.style.setProperty('--border-color', COLORS.neutral[200]);
    }
  }, [mode]);

  const toggleTheme = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, colors: COLORS }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

// Helper hook to get theme-aware colors
export const useThemeColors = () => {
  const { mode, colors } = useTheme();
  return {
    mode,
    colors,
    bg: {
      primary: mode === 'dark' ? colors.neutral[900] : colors.neutral[0],
      secondary: mode === 'dark' ? colors.neutral[800] : colors.neutral[50],
      tertiary: mode === 'dark' ? colors.neutral[700] : colors.neutral[100],
    },
    text: {
      primary: mode === 'dark' ? colors.neutral[0] : colors.neutral[900],
      secondary: mode === 'dark' ? colors.neutral[300] : colors.neutral[600],
      tertiary: mode === 'dark' ? colors.neutral[400] : colors.neutral[500],
    },
    border: mode === 'dark' ? colors.neutral[700] : colors.neutral[200],
  };
};
