// Phase 30c: page tests render without a QueryClientProvider (the app has one in App.tsx), so src/test/setup.ts swaps
// useAiCredits for this controllable stand-in. Set `aiCreditsMock.state` in a test; `aiCreditsMock.updates` records what
// screens passed to the updater after an AI call. The hook's own test (useAiCredits.test.tsx) uses the real module.
import { vi } from 'vitest';
import type { AiCredits } from '@/lib/aiCredits';

export const DEFAULT_CREDITS: AiCredits = { remaining: 200, limit: 250, resetDate: '2026-12-01T00:00:00Z', tier: 'Business', notStarted: false };

export const aiCreditsMock = {
  state: { credits: DEFAULT_CREDITS as AiCredits | null, loading: false, error: null as Error | null },
  updates: [] as unknown[],
  refetch: vi.fn(),
  reset() {
    this.state = { credits: DEFAULT_CREDITS, loading: false, error: null };
    this.updates = [];
    this.refetch = vi.fn();
  },
};

const view = () => {
  const c = aiCreditsMock.state.credits;
  return {
    credits: c, remaining: c?.remaining ?? null, limit: c?.limit ?? null, resetDate: c?.resetDate ?? null, tier: c?.tier ?? null,
    notStarted: c?.notStarted ?? false, loading: aiCreditsMock.state.loading, error: aiCreditsMock.state.error,
    refetch: (...a: unknown[]) => aiCreditsMock.refetch(...a),
  };
};

export const mockModule = {
  aiCreditsKey: (userId: string | undefined) => ['ai-credits', userId] as const,
  fetchAiCredits: vi.fn(),
  useAiCredits: view,
  useAiCreditsUpdater: () => (reply: unknown) => {
    aiCreditsMock.updates.push(reply);
    const r = reply as { credits_remaining?: unknown } | null;
    if (r && typeof r.credits_remaining === 'number' && aiCreditsMock.state.credits) {
      aiCreditsMock.state = { ...aiCreditsMock.state, credits: { ...aiCreditsMock.state.credits, remaining: r.credits_remaining, notStarted: false } };
    }
  },
};
