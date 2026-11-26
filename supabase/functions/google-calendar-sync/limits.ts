// Google Calendar sync: how fast we may call Google, in one place. Since #118 (5 calls at once, no spacing) Google
// answered most writes with 403 rateLimitExceeded, which was not retried. One call at a time worked (188 events, 0
// failures), so stay close to that: 2 at once, and the starts of write calls at least 300 ms apart.
export const GOOGLE_LIMITS = {
  /** Tasks in flight at once within a batch. */
  concurrency: 2,
  /** Minimum time between the starts of two write calls (insert, patch, delete), shared by all workers. */
  writeSpacingMs: 300,
  /** Waits before retrying a rate-limited call (plus up to 250 ms of jitter); at most this many retries. */
  retryDelaysMs: [1000, 2000, 4000, 8000],
  jitterMs: 250,
  /** A Retry-After from Google is honoured up to this long. */
  maxRetryAfterMs: 10_000,
  /** In a full sync, a task's marker is looked up again just before an insert once the first listing is this old. */
  staleListMs: 60_000,
} as const;

/** Google's reasons for "slow down" (HTTP 403 or 429): retried like 429 and 503. Any other 403 is final. */
export const RATE_LIMIT_REASONS = new Set(['rateLimitExceeded', 'userRateLimitExceeded', 'quotaExceeded', 'calendarUsageLimitsExceeded']);
