# Security incident and data breach response (one page)

Applies to any suspected security problem or personal data breach at B2BNEST, including anything touching HMRC data:
- HMRC tokens;
- VAT figures sent to HMRC;
- fraud prevention data;
- the HMRC audit log.

The ★ marks are **owner decision points**. The deadlines are what we understand the law and HMRC's terms to say
(**adviser to confirm**).

| Step | What to do | Who | When |
| --- | --- | --- | --- |
| **1. Detect** | A report reaches `info@b2bnest.online` (`/.well-known/security.txt`), or a Supabase advisor finding, an odd `hmrc_audit_log` pattern (many `refused` / `refresh_failed`), an Edge Function error spike or a customer complaint is noticed. Write down the time it was first noticed: the 72 hours start when we become **aware** | Whoever notices → ★ incident lead (owner to name) | At once |
| **2. Contain** | Stop the harm without destroying evidence. HMRC-related options: unset `HMRC_CLIENT_SECRET` or `HMRC_ENVIRONMENT` so every HMRC function refuses (`not_configured`); rotate `HMRC_TOKEN_KEY` (all stored tokens become unreadable, so companies must reconnect); suspend a user (`admin-set-user-ban`); rotate the Supabase service key; revoke the application's credentials in HMRC's Developer Hub. ★ Which of these to use | Incident lead | Within hours |
| **3. Assess** | What data, which companies and people, how many, since when, is it still happening, could it cause harm (fraud, identity theft, tax misuse)? Use `hmrc_audit_log`, `security_audit_logs`, `admin_audit_logs` and Supabase logs. Record the facts and the unknowns | Incident lead | Same day |
| **4. Tell HMRC** | If the incident involves HMRC-related customer data or the HMRC application (tokens, credentials, data sent to or received from HMRC): tell HMRC **immediately**. Use the contact HMRC's terms of use give (SDST / Developer Hub; **to confirm with HMRC**). Give what we know, what we did and who to contact. ★ Who sends it | Responsible individual | Immediately, before the full assessment |
| **5. Tell the ICO** | If a personal data breach is likely to put people's rights and freedoms at risk: report to the ICO **within 72 hours of becoming aware** (ico.org.uk, "Report a breach"). If not everything is known, report what is known and add the rest later. If we decide not to report, write down why. ★ Report or not | Owner, with adviser | Within 72 hours |
| **6. Tell customers** | If the risk to people is **high**: tell the affected people without undue delay, in plain words. Say what happened, what data, what we did, what they should do (for example reconnect HMRC, watch for HMRC-themed phishing) and who to contact. Business customers (companies) are told whenever their data was involved. ★ Wording and channel (email, in-app banner) | Owner | Without undue delay |
| **7. Record** | Every incident goes in a breach log, even if nothing is reported: date found, facts, effects, actions, decisions and reasons, who was told and when. Keep it with the company's records, not in this repository. Then do a short review: what failed and what changes (a test, an alert, a process) | Incident lead | Within 2 weeks |

**Not built yet (follow-ups):**
- automatic alerting on `hmrc_audit_log` anomalies;
- a written on-call rota;
- a template email to HMRC and to customers;
- someone named to read info@b2bnest.online and answer security reports promptly (see README).
