/** Routes that use the signed-in app shell (left menu, company switcher, Create, profile menu) — for signed-in people only. */
export const APP_SHELL_PREFIXES = [
  '/dashboard', '/business-overview', '/settings', '/profile-setup', '/onboarding',
  '/crm', '/project-management', '/lead-generation', '/rota',
  '/workflow-studio', '/integrations/', '/business-tools', '/template-center', '/workspaces', '/support-desk',
];

// Same matching as before Phase 24, kept exactly so signed-in layout does not change. (Note: '/integrations/' never
// matches anything with this rule, so /integrations/whatsapp keeps the public header layout, as it did before.)
const under = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

/** True for paths that get the app shell when signed in. Admin has its own layout and never uses it. */
export const isAppShellPath = (pathname: string) =>
  APP_SHELL_PREFIXES.some((p) => under(pathname, p)) && !under(pathname, '/admin');
