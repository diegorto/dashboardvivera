// Design System Tokens - Vivera Command Center

export const COLORS = {
  // Primary
  primary: {
    50: '#f0f7ff',
    100: '#e0efff',
    200: '#bae6ff',
    300: '#7dd3ff',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c3d66',
  },

  // Status
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    500: '#22c55e',
    700: '#15803d',
    900: '#0f5d31',
  },

  alert: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    500: '#eab308',
    700: '#ca8a04',
    900: '#713f12',
  },

  critical: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    500: '#ef4444',
    700: '#b91c1c',
    900: '#7f1d1d',
  },

  info: {
    50: '#ecf8ff',
    100: '#cff9ff',
    200: '#a5f7ff',
    500: '#06b6d4',
    700: '#0891b2',
    900: '#0c4a6e',
  },

  // Neutral
  neutral: {
    0: '#ffffff',
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
};

export const TYPOGRAPHY = {
  // Heading sizes
  heading: {
    h1: {
      fontSize: '32px',
      fontWeight: '700',
      lineHeight: '1.2',
    },
    h2: {
      fontSize: '28px',
      fontWeight: '700',
      lineHeight: '1.3',
    },
    h3: {
      fontSize: '24px',
      fontWeight: '600',
      lineHeight: '1.3',
    },
    h4: {
      fontSize: '20px',
      fontWeight: '600',
      lineHeight: '1.4',
    },
  },

  // Body text
  body: {
    lg: {
      fontSize: '16px',
      fontWeight: '400',
      lineHeight: '1.5',
    },
    base: {
      fontSize: '14px',
      fontWeight: '400',
      lineHeight: '1.5',
    },
    sm: {
      fontSize: '12px',
      fontWeight: '400',
      lineHeight: '1.4',
    },
  },

  // Captions
  caption: {
    fontSize: '12px',
    fontWeight: '500',
    lineHeight: '1.4',
    letterSpacing: '0.02em',
  },
};

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
};

export const BORDER_RADIUS = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
};

export const SHADOWS = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
};

export const TRANSITIONS = {
  fast: '150ms ease-in-out',
  normal: '200ms ease-in-out',
  slow: '300ms ease-in-out',
};
