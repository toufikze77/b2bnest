import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { UserSettings } from '@/utils/userSettingsUtils';

interface UserSettingsContextType {
  settings: UserSettings | null;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  loading: boolean;
}

const UserSettingsContext = createContext<UserSettingsContextType | undefined>(undefined);

export const UserSettingsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('currency_code, timezone, country_code, language_code, date_format, time_format, theme')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user settings:', error);
        return;
      }

      if (data) {
        setSettings({
          currency_code: data.currency_code || 'USD',
          timezone: data.timezone || 'UTC',
          country_code: data.country_code || 'US',
          language_code: data.language_code || 'en',
          date_format: data.date_format || 'MM/DD/YYYY',
          time_format: data.time_format || '12h',
          theme: (data as any).theme || 'light'
        });
      }
    } catch (error) {
      console.error('Error fetching user settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update(newSettings)
        .eq('id', user.id);

      if (error) {
        console.error('Error updating user settings:', error);
        throw error;
      }

      setSettings(prev => prev ? { ...prev, ...newSettings } : null);
    } catch (error) {
      console.error('Error updating user settings:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [user]);

  return (
    <UserSettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </UserSettingsContext.Provider>
  );
};

export const useUserSettings = () => {
  const context = useContext(UserSettingsContext);
  if (context === undefined) {
    throw new Error('useUserSettings must be used within a UserSettingsProvider');
  }
  return context;
};