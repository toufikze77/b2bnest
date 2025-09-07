export type TaxYear = '2024-2025' | '2025-2026';

export const payrollUKRates: Record<TaxYear, {
  personalAllowanceAnnual: number;
  basicRate: number; // 20%
  ni: {
    primaryThresholdMonthly: number;
    upperEarningsMonthly: number;
    employeeMainRate: number;
    employeeUpperRate: number;
    employerThresholdMonthly: number;
    employerRate: number;
  }
}> = {
  '2024-2025': {
    personalAllowanceAnnual: 12570,
    basicRate: 0.20,
    ni: {
      primaryThresholdMonthly: 1048,
      upperEarningsMonthly: 4189,
      employeeMainRate: 0.12,
      employeeUpperRate: 0.02,
      employerThresholdMonthly: 758,
      employerRate: 0.138,
    }
  },
  '2025-2026': {
    personalAllowanceAnnual: 12570,
    basicRate: 0.20,
    ni: {
      primaryThresholdMonthly: 1048,
      upperEarningsMonthly: 4189,
      employeeMainRate: 0.12,
      employeeUpperRate: 0.02,
      employerThresholdMonthly: 758,
      employerRate: 0.138,
    }
  }
};

export const getMonthlyAllowance = (year: TaxYear) => payrollUKRates[year].personalAllowanceAnnual / 12;

