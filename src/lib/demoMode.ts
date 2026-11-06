// Demo read-only (docs/demo-readonly/README.md). The database guard and the Edge Functions are the real protection;
// this module only makes the app calm about it:
//   - knows whether the signed-in person is view only (set by DemoModeProvider from is_demo_readonly());
//   - notices a refusal (PostgREST or an Edge Function answering 403 with the demo message) in one fetch wrapper on the
//     Supabase client, so that existing failure toasts show the demo message instead of a raw or generic error;
//   - maps toasts in one place (the shadcn toast() and sonner's toast.error), not screen by screen.
// For a person who is not view only nothing here changes anything.

export const DEMO_READONLY_MESSAGE = 'This is a demo account. It is view only.';
export const DEMO_BANNER_TEXT = 'Demo account: view only. Sign up free to try it with your own data.';

let demoNow = false;
let lastRefusalAt = 0;
const RECENT_MS = 8000;
const now = () => Date.now();

/** Set by DemoModeProvider. */
export function setDemoNow(value: boolean) { demoNow = value; }
/** For code outside React (useAuth, useOAuthConnect). */
export function isDemoNow() { return demoNow; }

/** Called when a demo refusal is seen. */
export function noteDemoRefusal() { lastRefusalAt = now(); }
/** A refusal was seen in the last few seconds (a failure toast now is most likely about it). */
export function recentDemoRefusal() { return lastRefusalAt > 0 && now() - lastRefusalAt < RECENT_MS; }
/** Tests only. */
export function resetDemoMode() { demoNow = false; lastRefusalAt = 0; }

const textOf = (v: unknown): string => {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    const o = v as { message?: unknown; error?: unknown; code?: unknown; details?: unknown };
    return [o.message, o.error, o.code, o.details].filter((x) => typeof x === 'string').join(' ');
  }
  return '';
};

/** True for the database guard's error (SQLSTATE 42501 + the message) and the Edge Functions' 403 (code demo_readonly). */
export function isDemoReadonlyError(e: unknown): boolean {
  const t = textOf(e);
  return t.includes(DEMO_READONLY_MESSAGE) || /\bdemo_readonly\b/.test(t);
}

/** The text to show for a failed action: the demo message for a demo refusal, otherwise the error's own message. */
export function friendlyError(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isDemoReadonlyError(e)) return DEMO_READONLY_MESSAGE;
  const t = textOf(e);
  return t || fallback;
}

/** Wraps fetch for the Supabase client: notes a demo refusal (403 bodies only; the response itself is untouched). */
export function demoAwareFetch(base: typeof fetch): typeof fetch {
  return async (input, init) => {
    const res = await base(input, init);
    if (res.status === 403) {
      try {
        const body = await res.clone().text();
        if (body.includes(DEMO_READONLY_MESSAGE) || body.includes('"demo_readonly"')) noteDemoRefusal();
      } catch { /* the body could not be read: nothing to note */ }
    }
    return res;
  };
}

const mentionsDemo = (...parts: unknown[]) => parts.some((p) => typeof p === 'string' && p.includes(DEMO_READONLY_MESSAGE));

/** The props of a failure toast, rewritten when it is about a demo refusal. Everything else passes unchanged. */
export function demoToastProps<T extends { title?: unknown; description?: unknown; variant?: unknown }>(props: T): T {
  const failing = props.variant === 'destructive';
  if (mentionsDemo(props.title, props.description) || (failing && recentDemoRefusal())) {
    return { ...props, title: 'View only', description: DEMO_READONLY_MESSAGE };
  }
  return props;
}

type SonnerLike = { error: (message: unknown, data?: unknown) => unknown };
const installed = new WeakSet<object>();
/** sonner's toast.error, mapped the same way (installed once from main.tsx). */
export function installSonnerDemoMapping(toast: SonnerLike) {
  if (installed.has(toast)) return;
  installed.add(toast);
  const original = toast.error.bind(toast);
  toast.error = (message: unknown, data?: unknown) => {
    const description = data && typeof data === 'object' ? (data as { description?: unknown }).description : undefined;
    if (mentionsDemo(message, description) || recentDemoRefusal()) {
      return original(DEMO_READONLY_MESSAGE, data && typeof data === 'object' ? { ...(data as object), description: undefined } : undefined);
    }
    return original(message, data);
  };
}
