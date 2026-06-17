import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type ThemeName = 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => Promise<void>;
  toggleTheme: () => void;
  availableThemes: ThemeName[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'b2bnest-theme';

function getInitialTheme(): ThemeName {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeName | null;
    if (stored === 'light' || stored === 'dark') return stored;
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {}
  return 'light';
}

function applyTheme(theme: ThemeName) {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
  root.style.colorScheme = theme;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeName>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
  }, [theme]);

  const setTheme = useCallback(async (t: ThemeName) => {
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const value: ThemeContextValue = {
    theme,
    setTheme,
    toggleTheme,
    availableThemes: ['light', 'dark'],
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
