import { lazy, type ComponentType } from 'react';

// After a new deployment the old page files (e.g. assets/Settings-<hash>.js) no longer exist. A tab opened before the
// deployment then fails to load the next page it visits; without handling, React unmounts everything (blank page).

const CHUNK_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|is not a valid JavaScript MIME type/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: string; message?: string };
  return e.name === 'ChunkLoadError' || CHUNK_ERROR.test(e.message || '');
}

const RELOAD_KEY = 'b2bnest:chunk-reload-at';
const RELOAD_WINDOW_MS = 10_000;

/** Reloads the page once to fetch the new deployment. Returns false (no reload) if it already tried in the last 10 seconds. */
export function reloadOnceForNewVersion(now = Date.now(), reload = () => window.location.reload()): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (now - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    return false; // No storage: never risk a reload loop; the error screen offers a Reload button instead.
  }
  reload();
  return true;
}

/** React.lazy for route pages: a missing page file after a deployment reloads the tab once instead of blanking it. */
export function lazyPage<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) { // eslint-disable-line @typescript-eslint/no-explicit-any
  return lazy(() => factory().catch((error: unknown) => {
    if (isChunkLoadError(error) && reloadOnceForNewVersion()) return new Promise<{ default: T }>(() => {});
    throw error;
  }));
}
