import { createContext, useContext } from 'react';

/** Demo read-only: whether the signed-in person is view only (filled by DemoModeProvider). */
export interface DemoMode { isDemo: boolean; loading: boolean }
export const DemoModeContext = createContext<DemoMode>({ isDemo: false, loading: false });
export const useDemoMode = () => useContext(DemoModeContext);
