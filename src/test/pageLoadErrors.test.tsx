import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { Suspense } from 'react';
import fs from 'node:fs';
import { isChunkLoadError, reloadOnceForNewVersion, lazyPage } from '@/lib/lazyPage';
import RouteErrorBoundary, { UPDATED_MESSAGE, FAILED_MESSAGE } from '@/components/RouteErrorBoundary';

const chunkError = () => new TypeError('Failed to fetch dynamically imported module: https://x.example/assets/Settings-abc.js');

describe('isChunkLoadError', () => {
  it('recognises missing page files across browsers', () => {
    expect(isChunkLoadError(chunkError())).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error("'text/html' is not a valid JavaScript MIME type."))).toBe(true);
  });
  it('ignores ordinary errors', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of null'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false);
  });
});

describe('reloadOnceForNewVersion', () => {
  beforeEach(() => sessionStorage.clear());
  it('reloads once, then not again within 10 seconds (no reload loop)', () => {
    const reload = vi.fn();
    expect(reloadOnceForNewVersion(100_000, reload)).toBe(true);
    expect(reloadOnceForNewVersion(105_000, reload)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reloadOnceForNewVersion(111_000, reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});

const Broken = () => { throw new Error('boom'); };

describe('RouteErrorBoundary', () => {
  beforeEach(() => { sessionStorage.clear(); vi.spyOn(console, 'error').mockImplementation(() => {}); });

  const app = (settings: JSX.Element) => (
    <MemoryRouter initialEntries={['/settings']}>
      <Link to="/dashboard">Dashboard</Link>
      <RouteErrorBoundary>
        <Suspense fallback={<p>Loading</p>}>
          <Routes>
            <Route path="/settings" element={settings} />
            <Route path="/dashboard" element={<p>Dashboard page</p>} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </MemoryRouter>
  );

  it('shows a message instead of a blank page when a page crashes, and recovers on navigation', () => {
    render(app(<Broken />));
    expect(screen.getByRole('alert')).toHaveTextContent(FAILED_MESSAGE);
    fireEvent.click(screen.getByText('Dashboard'));
    expect(screen.getByText('Dashboard page')).toBeInTheDocument();
  });

  it('a missing page file after a deployment shows "new version" when the one reload was already used', async () => {
    sessionStorage.setItem('b2bnest:chunk-reload-at', String(Date.now()));
    const Settings = lazyPage(() => Promise.reject(chunkError()));
    render(app(<Settings />));
    expect(await screen.findByRole('alert')).toHaveTextContent(UPDATED_MESSAGE);
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('a missing page file reloads the tab once (instead of unmounting the app)', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    const Settings = lazyPage(() => Promise.reject(chunkError()));
    render(app(<Settings />));
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Loading')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

describe('App wiring', () => {
  const src = fs.readFileSync('src/App.tsx', 'utf8');
  it('every route page uses lazyPage and sits inside RouteErrorBoundary', () => {
    expect(src).not.toMatch(/[^A-Za-z]lazy\(/);
    expect(src.match(/lazyPage\(\(\) => import\(/g)?.length).toBeGreaterThan(50);
    expect(src.indexOf('<RouteErrorBoundary>')).toBeLessThan(src.indexOf('<Suspense'));
    expect(src.indexOf('</RouteErrorBoundary>')).toBeGreaterThan(src.indexOf('</Suspense>'));
  });
  it('main.tsx does not leave a blank page if the app itself fails to load', () => {
    expect(fs.readFileSync('src/main.tsx', 'utf8')).toMatch(/import\('\.\/App\.tsx'\)[\s\S]*\.catch\(/);
  });
});
