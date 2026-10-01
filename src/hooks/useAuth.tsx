
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
  
};

const AuthContext = createContext<AuthContextType | null>(null);

const SIGN_UP_FEEDBACK_TIMEOUT_MS = 8000;

const signUpFeedbackTimeout = () =>
  new Promise<never>((_, reject) => {
    window.setTimeout(() => {
      reject({
        status: 504,
        code: 'request_timeout',
        message: 'The activation email service is taking longer than expected.',
      });
    }, SIGN_UP_FEEDBACK_TIMEOUT_MS);
  });

const normalizeAuthError = (error: unknown) => {
  const authError = error as { message?: unknown; status?: unknown; code?: unknown } | null;
  const message = typeof authError?.message === 'string' ? authError.message.trim() : '';
  const status = typeof authError?.status === 'number' ? authError.status : undefined;
  const code = typeof authError?.code === 'string' ? authError.code : '';

  if (status === 504 || code === 'request_timeout' || message === '{}' || message.toLowerCase().includes('deadline exceeded')) {
    return {
      code: 'email_delivery_timeout',
      message: 'Your request was received, but the confirmation email is taking longer than expected. Check your inbox and spam folder. If it does not arrive within one minute, try again.',
    };
  }

  return {
    code: code || 'signup_failed',
    message: message || 'We could not create your account. Please wait one minute and try again.',
  };
};

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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password }); return { data, error: error ? normalizeAuthError(error) : null };
  };

  // Email + password sign-up
  const signUp = async (email: string, password: string, fullName?: string, companyName?: string) => {
    try {
      // Only force HTTPS for production, keep localhost as HTTP for development
      const redirectUrl = window.location.origin.includes('localhost') 
        ? window.location.origin 
        : window.location.origin.replace('http://', 'https://');
      
      // Wait for the real result: abandoning early made created accounts look failed.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${redirectUrl}/`,
          data: { full_name: fullName, company_name: companyName }
        }
      });

      if (error) {
        return {
          error: normalizeAuthError(error),
          needsVerification: false,
        };
      }

      // Email already registered: Supabase returns a user with no identities
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        return {
          error: { message: 'An account with this email already exists. Please sign in or reset your password.' },
          needsVerification: false,
        };
      }

      // New users are not signed in until they confirm their email, so the
      // confirmation link sent by the auth system is the verification step.
      return { error: null, needsVerification: false, needsEmailConfirmation: !data.session };
    } catch (err: unknown) {
      return {
        error: normalizeAuthError(err),
        needsVerification: false,
      };
    }
  };

  // Sign out
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  // OAuth (Google, GitHub, etc.)
  const signInWithOAuth = async (provider: 'google' | 'github' | 'twitter', options = {}) => {
    // Only force HTTPS for production, keep localhost as HTTP for development
    const redirectUrl = window.location.origin.includes('localhost') 
      ? window.location.origin 
      : window.location.origin.replace('http://', 'https://');
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
    // Only force HTTPS for production, keep localhost as HTTP for development
    const redirectUrl = window.location.origin.includes('localhost') 
      ? window.location.origin 
      : window.location.origin.replace('http://', 'https://');
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

  // 2FA verification - delegated to secure edge function (table is no longer client-readable)
  const verify2FA = async (email: string, code: string, isLogin: boolean) => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-2fa-code', {
        body: {
          email,
          code,
          code_type: isLogin ? 'login' : 'verification',
        },
      });

      if (error || !data?.success) {
        return { error: { message: data?.error || 'Invalid or expired verification code' } };
      }

      return { error: null };
    } catch (error: any) {
      return { error: { message: error.message || 'Verification failed' } };
    }
  };


  // Send verification code - server-side generates & stores the code securely
  const sendVerificationCode = async (email: string, type: 'verification' | 'login') => {
    try {
      const { error } = await supabase.functions.invoke('send-2fa-email', {
        body: {
          email,
          type,
          name: email.split('@')[0],
        },
      });

      if (error) {
        console.error('Error sending 2FA email:', error);
        return { error };
      }

      return { error: null };
    } catch (error: any) {
      console.error('Error in sendVerificationCode:', error);
      return { error: { message: error.message || 'Failed to send verification code' } };
    }
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
    
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
