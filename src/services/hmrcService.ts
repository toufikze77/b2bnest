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

export const hmrcService = {
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
  }
};

export type { EmployerDetails, EmployeeFPSRecord, FPSSumbission };

