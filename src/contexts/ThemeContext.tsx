import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ThemeName = 'light' | 'dark' | 'ocean' | 'emerald' | 'rose';

interface ThemeDefinition {
  name: ThemeName;
  isDark: boolean;
}

const THEME_DEFINITIONS: Record<ThemeName, ThemeDefinition> = {
  light: { name: 'light', isDark: false },
  dark: { name: 'dark', isDark: true },
  ocean: { name: 'ocean', isDark: true },
  emerald: { name: 'emerald', isDark: false },
  rose: { name: 'rose', isDark: false },
};

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => Promise<void>;
  availableThemes: ThemeName[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyThemeToDocument(theme: ThemeName) {
  const def = THEME_DEFINITIONS[theme];
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.classList.toggle('dark', !!def.isDark);
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeName>('light');

  // Initialize theme from localStorage
  useEffect(() => {
    const stored = (localStorage.getItem('theme') as ThemeName | null) || 'light';
    setThemeState(stored);
    applyThemeToDocument(stored);
  }, []);

  const setTheme = useCallback(async (newTheme: ThemeName) => {
    setThemeState(newTheme);
    applyThemeToDocument(newTheme);
    localStorage.setItem('theme', newTheme);

    // Persist to Supabase profile if logged in
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({ theme: newTheme }).eq('id', user.id);
      }
    } catch (e) {
      console.warn('Unable to persist theme to profile:', e);
    }
  }, []);

  const value = useMemo(() => ({
    theme,
    setTheme,
    availableThemes: Object.keys(THEME_DEFINITIONS) as ThemeName[],
  }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}