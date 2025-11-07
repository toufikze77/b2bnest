import { supabase } from '@/integrations/supabase/client';

type HMRCAuth = {
  accessToken: string;
  expiresAt: number;
};

type EmployerDetails = {
  payeReference: string; // e.g., 123/AB456
  accountsOfficeRef: string; // e.g., 123PA12345678
};

type EmployeeFPSRecord = {
  employeeId: string;
  niNumber?: string;
  firstName: string;
  lastName: string;
  payDate: string; // YYYY-MM-DD
  taxCode: string; // e.g., 1257L
  niCategory: string; // e.g., A
  payFrequency: 'W1' | 'M1' | 'MTH' | 'WK' | 'IRR';
  grossPay: number;
  taxablePay: number;
  taxDeducted: number;
  employeeNIC: number;
  employerNIC: number;
};

type FPSSumbission = {
  employer: EmployerDetails;
  period: string; // e.g., 2024-09
  submissions: EmployeeFPSRecord[];
};

type HMRCSettings = {
  companyName: string;
  companyNumber: string;
  utr: string;
  vatNumber: string;
  payeReference: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  autoSubmitVAT: boolean;
  emailNotifications: boolean;
  reminderDays: number;
  sandboxMode: boolean;
};

type SubmissionLog = {
  id: string;
  submission_type: string;
  submission_id: string | null;
  period: string | null;
  status: string;
  submitted_at: string;
  error_message: string | null;
};

export const hmrcService = {
  // OAuth flow
  getAuthorizeUrl(clientId: string, redirectUri: string, state: string, sandboxMode: boolean): string {
    const baseUrl = sandboxMode
      ? 'https://test-www.tax.service.gov.uk/oauth/authorize'
      : 'https://www.tax.service.gov.uk/oauth/authorize';
    
    const url = new URL(baseUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('scope', 'read:vat write:vat read:customs-financials-api');
    return url.toString();
  },

  async startOAuth(clientId: string, redirectUri: string, sandboxMode: boolean): Promise<{ authUrl: string; state: string }> {
    const state = Math.random().toString(36).slice(2);
    sessionStorage.setItem('hmrc_oauth_state', state);
    const authUrl = this.getAuthorizeUrl(clientId, redirectUri, state, sandboxMode);
    return { authUrl, state };
  },

  async handleOAuthCallback(code: string, state: string): Promise<void> {
    const expectedState = sessionStorage.getItem('hmrc_oauth_state');
    if (state !== expectedState) {
      throw new Error('Invalid OAuth state');
    }

    const settings = await this.getSettings();
    if (!settings) {
      throw new Error('HMRC settings not found');
    }

    const { data, error } = await supabase.functions.invoke('oauth-hmrc', {
      body: {
        code,
        state,
        clientId: settings.clientId,
        clientSecret: settings.clientSecret,
        redirectUri: settings.redirectUri,
        sandboxMode: settings.sandboxMode,
      },
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'OAuth failed');

    sessionStorage.removeItem('hmrc_oauth_state');
  },

  async getToken(): Promise<HMRCAuth | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('hmrc_integrations')
      .select('access_token, expires_at')
      .eq('user_id', user.id)
      .eq('is_connected', true)
      .single();

    if (error || !data) return null;

    const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
    if (expiresAt <= Date.now()) return null;

    // Decrypt token
    const { data: decryptedToken } = await supabase.rpc('decrypt_hmrc_token', {
      encrypted_token: data.access_token,
    });

    return {
      accessToken: decryptedToken || '',
      expiresAt,
    };
  },

  async isConnected(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  },

  async submitFPS(payload: FPSSumbission): Promise<{ submissionId: string }> {
    const token = await this.getToken();
    if (!token) throw new Error('Not authenticated with HMRC');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Simulate submission (in production, call real HMRC API)
    await new Promise((r) => setTimeout(r, 800));
    const submissionId = `FPS-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

    // Log submission
    await this.logSubmission({
      submission_type: 'FPS',
      submission_id: submissionId,
      period: payload.period,
      status: 'submitted',
      request_payload: payload,
    });

    return { submissionId };
  },

  async submitEPS(period: string, employer: EmployerDetails, adjustments: Record<string, number>): Promise<{ submissionId: string }> {
    const token = await this.getToken();
    if (!token) throw new Error('Not authenticated with HMRC');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    await new Promise((r) => setTimeout(r, 800));
    const submissionId = `EPS-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

    // Log submission
    await this.logSubmission({
      submission_type: 'EPS',
      submission_id: submissionId,
      period,
      status: 'submitted',
      request_payload: { employer, adjustments },
    });

    return { submissionId };
  },

  async logSubmission(log: {
    submission_type: string;
    submission_id: string | null;
    period: string | null;
    status: string;
    request_payload?: any;
    response_data?: any;
    error_message?: string | null;
  }): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    await supabase.from('hmrc_submission_logs').insert({
      user_id: user.id,
      organization_id: orgMember?.organization_id || null,
      ...log,
    });
  },

  async getSubmissionLogs(): Promise<SubmissionLog[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('hmrc_submission_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('submitted_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Failed to fetch submission logs:', error);
      return [];
    }

    return data || [];
  },

  async saveSettings(settings: HMRCSettings): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const { error } = await supabase.from('hmrc_settings').upsert({
      user_id: user.id,
      organization_id: orgMember?.organization_id || null,
      company_name: settings.companyName,
      company_number: settings.companyNumber,
      utr: settings.utr,
      vat_number: settings.vatNumber,
      paye_reference: settings.payeReference,
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      redirect_uri: settings.redirectUri,
      auto_submit_vat: settings.autoSubmitVAT,
      email_notifications: settings.emailNotifications,
      reminder_days: settings.reminderDays,
      sandbox_mode: settings.sandboxMode,
    }, {
      onConflict: 'user_id,organization_id'
    });

    if (error) throw error;
  },

  async getSettings(): Promise<HMRCSettings | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('hmrc_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !data) return null;

    return {
      companyName: data.company_name || '',
      companyNumber: data.company_number || '',
      utr: data.utr || '',
      vatNumber: data.vat_number || '',
      payeReference: data.paye_reference || '',
      clientId: data.client_id,
      clientSecret: data.client_secret,
      redirectUri: data.redirect_uri,
      autoSubmitVAT: data.auto_submit_vat,
      emailNotifications: data.email_notifications,
      reminderDays: data.reminder_days,
      sandboxMode: data.sandbox_mode,
    };
  },

  async clearSettings(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('hmrc_settings').delete().eq('user_id', user.id);
    await supabase.from('hmrc_integrations').delete().eq('user_id', user.id);
  },

  async isFullyConfigured(): Promise<boolean> {
    const settings = await this.getSettings();
    const token = await this.getToken();
    return !!(settings && token && settings.clientId && settings.clientSecret);
  }
};

export type { EmployerDetails, EmployeeFPSRecord, FPSSumbission, HMRCSettings, SubmissionLog };

