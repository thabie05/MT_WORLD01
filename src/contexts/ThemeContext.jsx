import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

const KEY = 'mtworld_theme_session';

// The app opens in light mode each time it is launched. A theme chosen during
// the session is kept in sessionStorage, so it survives page reloads such as
// going to the Fingerprint Kiosk and back, but resets when the app is closed.
const readSession = () => {
  try { return sessionStorage.getItem(KEY) || 'light'; } catch { return 'light'; }
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readSession);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { sessionStorage.setItem(KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);