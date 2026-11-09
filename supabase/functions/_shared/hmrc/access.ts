// HMRC hide switch (docs/hmrc-hide/README.md): may this person use the HMRC features right now?
//   * 'tester'  - a platform super_admin or admin in public.user_roles (the owner's accounts). Only super admins can give
//                 those roles, and super_admin can't be given through the API at all, so no customer can become one.
//   * 'visible' - the platform setting hmrc_customer_access is exactly "visible": every customer may use them.
//   * 'hidden'  - anything else: the setting is "hidden", missing, unreadable or the read failed (fail closed).
// Read with the service role in the Edge Functions; the browser reads the same setting under RLS for display only.
export type HmrcAccess = 'tester' | 'visible' | 'hidden';
export const HMRC_ACCESS_KEY = 'hmrc_customer_access';
export const TESTER_ROLES = ['super_admin', 'admin'] as const;

type Result = PromiseLike<{ data: unknown; error: unknown }>;
type Query = Result & { [k: string]: (...a: unknown[]) => Query };
type Sb = { from: (t: string) => Query };

export async function readHmrcAccess(admin: Sb, userId: string): Promise<HmrcAccess> {
  try {
    const roles = await admin.from('user_roles').select('role').eq('user_id', userId).in('role', [...TESTER_ROLES]);
    if (!roles.error && Array.isArray(roles.data) && roles.data.length > 0) return 'tester';
    const s = await admin.from('platform_settings').select('value').eq('key', HMRC_ACCESS_KEY).maybeSingle();
    if (s.error || !s.data) return 'hidden';
    return (s.data as { value?: unknown }).value === 'visible' ? 'visible' : 'hidden';
  } catch {
    return 'hidden';
  }
}
