import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'mkd-maps-theme';

const MapsThemeContext = createContext({
  theme: 'light',
  setTheme: () => {},
});

export function MapsThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (_) {}
  }, [theme]);

  const setTheme = (value) => setThemeState(value === 'dark' ? 'dark' : 'light');

  return (
    <MapsThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </MapsThemeContext.Provider>
  );
}

export function useMapsTheme() {
  const ctx = useContext(MapsThemeContext);
  if (!ctx) throw new Error('useMapsTheme must be used within MapsThemeProvider');
  return ctx;
}

export function MapsThemeRoot({ children }) {
  const { theme } = useMapsTheme();
  return (
    <div className={`maps-root maps-theme--${theme}`}>
      {children}
    </div>
  );
}
