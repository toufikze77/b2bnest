import { Navigate } from 'react-router-dom';
import { useRota } from '@/hooks/useRota';

/** Planners land on the schedule; everyone else on Holiday (Phase 32). */
export default function RotaIndex() {
  const { isAdmin, orgLoading } = useRota();
  if (orgLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  return <Navigate to={isAdmin ? '/rota/schedule' : '/rota/holiday'} replace />;
}
