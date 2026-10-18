#!/usr/bin/env bash
# Disposable local Postgres (port 55439) test for the placeholder-integration cleanup. Never touches production.
# Run from the repository root: bash docs/phase9-honesty/run-test.sh
set -u
BIN=${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)}; PATH=$BIN:$PATH
D=/tmp/p9pg; S=/tmp/p9sock; U=${PG_RUN_USER:-postgres}; P=55439
rm -rf $D $S; mkdir -p $D $S; chown $U $D $S
AS="setpriv --reuid=$U --regid=$(id -gn $U) --clear-groups"
$AS initdb -U postgres -D $D >/dev/null && $AS pg_ctl -D $D -o "-p $P -k $S" -l $S/log start >/dev/null && sleep 2
Q="psql -h $S -p $P -U postgres -X -q -A -t -v ON_ERROR_STOP=1"
DIR=docs/phase9-honesty
# Minimal production shapes: user_integrations and the two token functions (bodies as in the production baseline).
$Q <<'SQL'
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
CREATE TABLE public.user_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, integration_name text NOT NULL,
  access_token text, refresh_token text, expires_at timestamptz, metadata jsonb DEFAULT '{}'::jsonb,
  is_connected boolean DEFAULT false, connected_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, integration_name));
CREATE FUNCTION public.encrypt_integration_token(token text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN IF token IS NULL OR token = '' THEN RETURN NULL; END IF; RETURN 'ENC:' || encode(convert_to(token, 'UTF8'), 'base64'); END $$;
CREATE FUNCTION public.decrypt_integration_token(encrypted_token text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE d text; BEGIN
  IF encrypted_token IS NULL OR encrypted_token = '' THEN RETURN NULL; END IF;
  IF encrypted_token LIKE 'ENC:%' THEN BEGIN d := convert_from(decode(substring(encrypted_token from 5), 'base64'), 'UTF8'); EXCEPTION WHEN OTHERS THEN RETURN NULL; END;
  ELSE d := encrypted_token; END IF; RETURN d; END $$;
INSERT INTO public.user_integrations (user_id, integration_name, access_token, is_connected) VALUES
  ('00000000-0000-4000-8000-000000000001', 'zapier',          public.encrypt_integration_token('placeholder_token'), true),
  ('00000000-0000-4000-8000-000000000001', 'stripe',          'placeholder_token', true),
  ('00000000-0000-4000-8000-000000000001', 'slack',           public.encrypt_integration_token('xoxb-real-token'), true),
  ('00000000-0000-4000-8000-000000000002', 'google_calendar', public.encrypt_integration_token('ya29.real'), true),
  ('00000000-0000-4000-8000-000000000002', 'notion',          NULL, false);
SQL
snap() { $Q -c "SELECT string_agg(integration_name || ':' || md5(t::text), ',' ORDER BY id) FROM public.user_integrations t"; }
BEFORE=$(snap)
echo "count before:            $($Q -f $DIR/count-placeholder-integrations.sql | tr '\n' ' ')"
$Q -f $DIR/cleanup-placeholder-integrations.sql && $Q -f $DIR/cleanup-placeholder-integrations.sql && echo "cleanup applied twice:   OK"
echo "count after:             '$($Q -f $DIR/count-placeholder-integrations.sql)' (expect empty)"
echo "rows left:               $($Q -c "SELECT string_agg(integration_name, ',' ORDER BY integration_name) FROM public.user_integrations") (expect google_calendar,notion,slack)"
echo "backup rows:             $($Q -c "SELECT count(*) FROM public.phase9_placeholder_integrations_backup") (expect 2)"
echo "anon/authenticated read backup: $($Q -c "SELECT has_table_privilege('anon','public.phase9_placeholder_integrations_backup','SELECT') OR has_table_privilege('authenticated','public.phase9_placeholder_integrations_backup','SELECT')") (expect f)"
$Q -f $DIR/rollback-placeholder-integrations.sql && $Q -f $DIR/rollback-placeholder-integrations.sql && echo "rollback applied twice:  OK"
AFTER=$(snap)
echo "rows identical to before after rollback: $([ "$BEFORE" = "$AFTER" ] && echo yes || echo NO)"
$AS pg_ctl -D $D stop >/dev/null; rm -rf $D $S
