-- get_hmrc_tokens returned the stored values as-is. oauth-hmrc stores them via
-- encrypt_hmrc_token ('ENC:' prefix), so callers got 'ENC:...' instead of a
-- usable bearer token. Decrypt on read, matching get_integration_tokens.
-- decrypt_hmrc_token passes legacy plain-text values through unchanged.
-- CREATE OR REPLACE keeps the existing grants (authenticated only, no anon).
create or replace function public.get_hmrc_tokens(p_user_id uuid default auth.uid())
returns table(access_token text, refresh_token text, expires_at timestamptz)
language plpgsql security definer set search_path to ''
as $$
begin
  perform public.assert_self(p_user_id);
  return query
    select public.decrypt_hmrc_token(h.access_token),
           public.decrypt_hmrc_token(h.refresh_token),
           h.expires_at
    from public.hmrc_integrations h
    where h.user_id = p_user_id and h.is_connected = true
    order by h.connected_at desc nulls last;
end;
$$;
