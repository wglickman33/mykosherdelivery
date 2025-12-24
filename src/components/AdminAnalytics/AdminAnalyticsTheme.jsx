import { createTheme } from '@mui/material/styles';

const adminAnalyticsTheme = createTheme({
  palette: {
    primary: {
      main: '#3b82f6',
      dark: '#2563eb',
      light: '#60a5fa',
    },
    secondary: {
      main: '#10b981',
      dark: '#059669',
      light: '#34d399',
    },
    background: {
      default: '#ffffff',
      paper: '#ffffff',
    },
    text: {
      primary: '#061757',
      secondary: '#6b7280',
    },
    divider: '#e5e7eb',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '1.5rem',
      fontWeight: 600,
      color: '#061757',
    },
    h2: {
      fontSize: '1.25rem',
      fontWeight: 600,
      color: '#061757',
    },
    h3: {
      fontSize: '1.1rem',
      fontWeight: 600,
      color: '#061757',
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid #f1f5f9',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: '6px',
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
        },
      },
    },
  },
});

export default adminAnalyticsTheme;
