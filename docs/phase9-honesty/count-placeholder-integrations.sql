-- READ-ONLY. Run first, on production, and keep the numbers: how many user_integrations rows hold the fake token
-- that the old CRM Integrations / Services tabs wrote when "Connect" was clicked for a service with no real
-- connection flow. Tokens are stored through public.encrypt_integration_token (base64 with an "ENC:" prefix), so the
-- placeholder is stored as 'ENC:cGxhY2Vob2xkZXJfdG9rZW4='; very old rows may hold it in plain text. Decrypting covers both.
SELECT integration_name,
       count(*)                                   AS rows_with_placeholder,
       count(*) FILTER (WHERE is_connected)       AS shown_as_connected,
       count(DISTINCT user_id)                    AS users,
       min(created_at)                            AS first_created,
       max(created_at)                            AS last_created
FROM public.user_integrations
WHERE public.decrypt_integration_token(access_token) = 'placeholder_token'
GROUP BY integration_name
ORDER BY integration_name;
