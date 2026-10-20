# Moved

The invitation and support email senders now live in `supabase/functions/onboarding-email-sender/` and
`supabase/functions/support-email-sender/` (Phase 10). They are **in supabase/functions, not deployed**, and stay off
until `ONBOARDING_EMAIL_ENABLED=true` / `SUPPORT_EMAIL_ENABLED=true`. Rollout steps: `docs/phase10-email-senders/README.md`.
