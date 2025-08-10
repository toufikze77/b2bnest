import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserSettings } from '@/hooks/useUserSettings';
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
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const [theme, setThemeState] = useState<ThemeName>('light');

  useEffect(() => {
    const stored = (localStorage.getItem('theme') as ThemeName | null) || null;
    const fromProfile = (settings as any)?.theme as ThemeName | undefined;
    const initial: ThemeName = fromProfile || stored || 'light';
    setThemeState(initial);
    applyThemeToDocument(initial);
  }, [settings]);

  const setTheme = useCallback(async (newTheme: ThemeName) => {
    setThemeState(newTheme);
    applyThemeToDocument(newTheme);
    localStorage.setItem('theme', newTheme);

    try {
      if (user) {
        await supabase.from('profiles' as any).update({ theme: newTheme }).eq('id', user.id);
      }
    } catch (e) {
      console.warn('Unable to persist theme to profile:', e);
    }
  }, [user]);

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