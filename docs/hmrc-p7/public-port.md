# Gov-Client-Public-Port: what we can and can't send

**Status: omitted on purpose.** B2BNEST does not send `Gov-Client-Public-Port`, and `HMRC_VENDOR_PUBLIC_IP` stays unset.
Nothing in this PR changes `supabase/functions/_shared/hmrc/fraudHeaders.ts`.

## What HMRC asks for

Our connection method is `WEB_APP_VIA_SERVER`. For that method HMRC's fraud prevention specification lists
`Gov-Client-Public-Port`: the public TCP port the person's device used to connect to our servers. Our code follows the
P1/P2 reading of the spec (`docs/hmrc-p1-p2/README.md`, lines 30, 78, 114 and 160):

- send it only when it is known;
- never send a made-up value;
- data that can't be collected should be left out, and HMRC should be told about it.

The exact wording HMRC uses for "data you can't collect" is **to confirm with HMRC**: that page is not in this repository.

## What is available to us

| Source | What it carries | Can it be the client's public port? |
| --- | --- | --- |
| The browser | Only the server's port (`location.port`, empty for 443) | No: a browser can't see its own source port |
| `X-Forwarded-For`, `cf-connecting-ip`, `x-real-ip` (used by `clientIpFrom`) | The client's IP address only | No port |
| `X-Forwarded-Port` | Supabase's self-hosted gateway (Envoy) sets it to the gateway's own listener port (8000), not the client's | No |
| Hosted Supabase Edge gateway | Not documented: we can't find a header carrying the client's source port | Unknown: **to confirm with HMRC / Supabase** |
| Vercel (static front end) | The browser never calls HMRC through Vercel; HMRC calls go from the browser to Supabase Edge Functions | Not relevant |

**Conclusion: no truthful source exists today.** Sending the server port, 443 or a guessed number would be invented data,
which the spec forbids. `fraudHeaders.ts` already refuses 80 and 443 and only sends a port it was given.

## What could change this (owner decision, not in this PR)

- Put the HMRC Edge Functions behind a proxy we control that records the client's source port and forwards it in a
  signed header. That is new infrastructure, a new processor and a new security review.
- Or get written confirmation from HMRC that leaving the header out is acceptable for this setup.

## Wording to send HMRC

> Subject: Fraud prevention headers: Gov-Client-Public-Port for a WEB_APP_VIA_SERVER application (B2BNEST)
>
> Hello,
>
> B2BNEST is a web application using the WEB_APP_VIA_SERVER connection method. Our server-side code runs on Supabase
> Edge Functions (hosted, with the database in eu-west-2, London) and is called from the user's browser over HTTPS.
>
> We are unable to collect Gov-Client-Public-Port. The browser can't read its own source port. Our hosting gateway
> passes the client's public IP address to us, but not the client's source port, and we have found no documented header
> that carries it. We don't want to send a value we can't verify, so we currently leave the header out rather than
> sending the server port or a fixed value.
>
> We send every other header for this connection method that we can collect, and we check them with the Test Fraud
> Prevention Headers API in the sandbox. Gov-Vendor-Public-IP and Gov-Vendor-Forwarded are also left out at present,
> because our hosting provider does not give us a fixed outbound IP address.
>
> Could you confirm whether leaving Gov-Client-Public-Port out is acceptable in our case? If it is not, please tell us
> what you would accept instead.
>
> Thank you,
> [Responsible individual's name], [Company name]
> HMRC Developer Hub application: [application name / client ID — owner to fill in, never the client secret]

Owner: send this from the Developer Hub support route or the SDST mailbox HMRC gives you. The address is **to confirm with HMRC**.
