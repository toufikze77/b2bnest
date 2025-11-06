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

const TOKEN_STORAGE_KEY = 'hmrc_mock_auth_v1';
const SETTINGS_STORAGE_KEY = 'hmrc_settings_v1';

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

export const hmrcService = {
  // --- OAuth scaffolding (mock) ---
  getAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
    // In production, return HMRC OAuth authorize endpoint with scopes & state
    const url = new URL('https://test-accounts.hmrc.gov.uk/oauth/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('scope', 'read:employment read:employments write:employments');
    return url.toString();
  },

  async startOAuth(clientId: string, redirectUri: string): Promise<{ authUrl: string; state: string }>{
    const state = Math.random().toString(36).slice(2);
    try { localStorage.setItem('hmrc_oauth_state', state); } catch {}
    const authUrl = this.getAuthorizeUrl(clientId, redirectUri, state);
    return { authUrl, state };
  },

  async handleOAuthCallback(params: URLSearchParams, clientId: string, clientSecret: string, redirectUri: string): Promise<HMRCAuth> {
    // In production, exchange code for token against HMRC token endpoint
    const stateExpected = localStorage.getItem('hmrc_oauth_state');
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state || state !== stateExpected) {
      throw new Error('Invalid OAuth callback');
    }
    // Mock token
    return this.authenticate(clientId, clientSecret);
  },

  async authenticate(clientId: string, clientSecret: string): Promise<HMRCAuth> {
    const now = Date.now();
    const token: HMRCAuth = {
      accessToken: `mock_${btoa(`${clientId}:${clientSecret}:${now}`)}`,
      expiresAt: now + 1000 * 60 * 60, // 1 hour
    };
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
    } catch {}
    return token;
  },

  getToken(): HMRCAuth | null {
    try {
      const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as HMRCAuth;
      if (parsed.expiresAt > Date.now()) return parsed;
      return null;
    } catch {
      return null;
    }
  },

  async submitFPS(payload: FPSSumbission): Promise<{ submissionId: string }> {
    const token = this.getToken();
    if (!token) throw new Error('Not authenticated with HMRC');
    await new Promise((r) => setTimeout(r, 800));
    return { submissionId: `FPS-${Math.random().toString(36).slice(2, 10).toUpperCase()}` };
  },

  async submitEPS(period: string, employer: EmployerDetails, adjustments: Record<string, number>): Promise<{ submissionId: string }>{
    const token = this.getToken();
    if (!token) throw new Error('Not authenticated with HMRC');
    await new Promise((r) => setTimeout(r, 800));
    return { submissionId: `EPS-${Math.random().toString(36).slice(2, 10).toUpperCase()}` };
  },

  saveSettings(settings: HMRCSettings): void {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save HMRC settings:', error);
    }
  },

  getSettings(): HMRCSettings | null {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as HMRCSettings;
    } catch (error) {
      console.error('Failed to load HMRC settings:', error);
      return null;
    }
  },

  clearSettings(): void {
    try {
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear HMRC settings:', error);
    }
  },

  isFullyConfigured(): boolean {
    const settings = this.getSettings();
    const token = this.getToken();
    return !!(settings && token && settings.clientId && settings.clientSecret);
  }
};

export type { EmployerDetails, EmployeeFPSRecord, FPSSumbission, HMRCSettings };

