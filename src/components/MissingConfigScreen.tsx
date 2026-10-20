/** Shown instead of a blank page when the build has no Supabase connection settings. Names only, never values. */
export const MISSING_CONFIG_MESSAGE =
  "B2BNEST can't start: the app's connection settings are missing in this build. If you own this site, check the VITE_SUPABASE_* variables.";

export function MissingConfigScreen() {
  return (
    <main
      role="alert"
      className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground"
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="text-xl font-semibold">B2BNEST can't start</h1>
        <p className="mt-3 text-base leading-relaxed">{MISSING_CONFIG_MESSAGE}</p>
      </div>
    </main>
  );
}
