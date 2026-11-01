import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Phase 30c: see src/test/aiCreditsMock.ts.
import { beforeEach, vi } from "vitest";
import { aiCreditsMock } from "./aiCreditsMock";
vi.mock("@/hooks/useAiCredits", async () => (await import("./aiCreditsMock")).mockModule);
beforeEach(() => aiCreditsMock.reset());
