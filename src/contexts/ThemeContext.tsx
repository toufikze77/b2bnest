import React, { createContext, useContext } from 'react';

export type ThemeName = 'light';

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => Promise<void>;
  availableThemes: ThemeName[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = {
    theme: 'light' as ThemeName,
    setTheme: async () => {}, // No-op since we only have light theme
    availableThemes: ['light'] as ThemeName[],
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}