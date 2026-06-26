import { createContext, useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';

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
    } catch {
      /* localStorage may be unavailable (private mode, quota) */
    }
  }, [theme]);

  const setTheme = (value) => setThemeState(value === 'dark' ? 'dark' : 'light');

  return (
    <MapsThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </MapsThemeContext.Provider>
  );
}

MapsThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with provider
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

MapsThemeRoot.propTypes = {
  children: PropTypes.node.isRequired,
};
