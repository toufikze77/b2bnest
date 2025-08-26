
import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, fullName?: string, companyName?: string) => Promise<any>;
  signOut: () => Promise<void>;
  signInWithOAuth: (provider: 'google' | 'github' | 'twitter', options?: any) => Promise<any>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (password: string) => Promise<{ error: any }>;
  verify2FA: (email: string, code: string, isLogin: boolean) => Promise<{ error: any }>;
  sendVerificationCode: (email: string, type: 'verification' | 'login') => Promise<{ error: any, code?: string }>;
  signInWithSSO: (domain: string) => Promise<{ error: any }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setSession(session);
      setLoading(false);
    });

    // Listen for changes
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setSession(session);
      setLoading(false);
    });

    return () => {
      subscription?.subscription.unsubscribe();
    };
  }, []);

  // Email + password sign-in
  const signIn = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };

  // Email + password sign-up
  const signUp = async (email: string, password: string, fullName?: string, companyName?: string) => {
    const redirectUrl = window.location.origin.replace('http://', 'https://');
    return await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${redirectUrl}/`,
        data: { full_name: fullName, company_name: companyName }
      }
    });
  };

  // Sign out
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  // OAuth (Google, GitHub, etc.)
  const signInWithOAuth = async (provider: 'google' | 'github' | 'twitter', options = {}) => {
    const redirectUrl = window.location.origin.replace('http://', 'https://');
    return await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl + '/',
        ...options
      }
    });
  };

  // Reset password
  const resetPassword = async (email: string) => {
    const redirectUrl = window.location.origin.replace('http://', 'https://');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${redirectUrl}/reset-password`
    });
    return { error };
  };

  // Update password
  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error };
  };

  // Placeholder 2FA methods (simplified for now)
  const verify2FA = async (email: string, code: string, isLogin: boolean) => {
    // Simplified implementation - in production you'd verify against your database
    return { error: null };
  };

  const sendVerificationCode = async (email: string, type: 'verification' | 'login') => {
    // Simplified implementation - in production you'd send actual codes
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    return { error: null, code };
  };

  // Placeholder SSO method
  const signInWithSSO = async (domain: string) => {
    const redirectUrl = window.location.origin.replace('http://', 'https://');
    const { data, error } = await supabase.auth.signInWithSSO({
      domain,
      options: {
        redirectTo: `${redirectUrl}/`
      }
    });
    return { error };
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    signInWithOAuth,
    resetPassword,
    updatePassword,
    verify2FA,
    sendVerificationCode,
    signInWithSSO
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
