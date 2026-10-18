import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { loadReportRange, ReportRange, saveReportRange } from '@/lib/crmReports';

/** CRM Reports date range, remembered per user like the report currency ("All time" if unknown or storage is blocked). */
export function useReportRange() {
  const { user } = useAuth();
  const [range, setState] = useState<ReportRange>(() => loadReportRange(user?.id));
  useEffect(() => { setState(loadReportRange(user?.id)); }, [user?.id]);
  return { range, setRange: (r: ReportRange) => { setState(r); saveReportRange(user?.id, r); } };
}
