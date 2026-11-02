import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { type AiCredits, parseCreditsInfo } from '@/lib/aiCredits';

/**
 * Phase 30c: the signed-in person's AI credit balance, the one place the app reads it (get_ai_credits_info). No toast on
 * failure: callers show a quiet error with Retry. An enrolled two-step user who hasn't entered their code yet is refused by
 * the RPC's MFA guard; that is just the error state.
 */
export const aiCreditsKey = (userId: string | undefined) => ['ai-credits', userId] as const;

type Rpc = (fn: string) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;

export async function fetchAiCredits(userId: string): Promise<AiCredits> {
  const [info, row] = await Promise.all([
    (supabase.rpc as unknown as Rpc)('get_ai_credits_info'),
    // Own row only (RLS select_own_subscription). Tells "no row yet" apart from a real balance.
    supabase.from('subscribers').select('user_id').eq('user_id', userId).maybeSingle(),
  ]);
  if (info.error) throw new Error(info.error.message ?? 'credits_unavailable');
  if (row.error) throw new Error(row.error.message ?? 'credits_unavailable');
  const credits = parseCreditsInfo(info.data, !!row.data);
  if (!credits) throw new Error('credits_unreadable');
  return credits;
}

export function useAiCredits() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: aiCreditsKey(user?.id),
    queryFn: () => fetchAiCredits(user!.id),
    enabled: !!user?.id,
    staleTime: 30_000,
    retry: false,
  });
  return {
    credits: q.data ?? null,
    remaining: q.data?.remaining ?? null,
    limit: q.data?.limit ?? null,
    resetDate: q.data?.resetDate ?? null,
    tier: q.data?.tier ?? null,
    notStarted: q.data?.notStarted ?? false,
    loading: !!user?.id && q.isPending,
    error: q.isError ? q.error : null,
    refetch: q.refetch,
  };
}

/**
 * After an AI call that answers with the credits left, show the new number at once. The server has now created the
 * subscribers row (if it was missing), so the count has started; the list is then re-read for the real reset date.
 */
export function useAiCreditsUpdater() {
  const { user } = useAuth();
  const client = useQueryClient();
  return useCallback((reply: { credits_remaining?: unknown; credits_limit?: unknown; reset_date?: unknown } | null | undefined) => {
    if (!user?.id) return;
    const key = aiCreditsKey(user.id);
    if (reply && typeof reply.credits_remaining === 'number') {
      client.setQueryData<AiCredits>(key, (old) => ({
        remaining: reply.credits_remaining as number,
        limit: typeof reply.credits_limit === 'number' ? reply.credits_limit : old?.limit ?? 0,
        resetDate: typeof reply.reset_date === 'string' ? reply.reset_date : old?.resetDate ?? null,
        tier: old?.tier ?? null,
        notStarted: false,
      }));
    }
    void client.invalidateQueries({ queryKey: key });
  }, [client, user?.id]);
}
