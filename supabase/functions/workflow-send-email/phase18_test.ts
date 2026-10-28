// Phase 18: replies to workflow emails go to the sender's own verified account email (Reply-To), never an address
// from the request, and buildMessage is byte-identical for every sender that passes no reply address.
import { assert, assertEquals, assertThrows } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import type { Mail } from "./handler.ts";
import { Deps, makeHandler } from "./request.ts";
import { buildMessage } from "./smtp.ts";
import { isSafeReplyAddress, NO_REPLY_ADDRESS, replyToAddress } from "../_shared/reply-to.ts";

const ENV: Record<string, string> = { SMTP_USER: "notifications@b2bnest.online", SMTP_PASSWORD: "pw-secret", SMTP_FROM: "B2BNEST <notifications@b2bnest.online>" };
const VERIFIED = { id: "u1", email: "owner@acme.example", email_confirmed_at: "2026-10-01T10:00:00Z" };
const req = (body: unknown) =>
  new Request("http://x", { method: "POST", headers: { Authorization: "Bearer good", "Content-Type": "application/json" }, body: JSON.stringify(body) });
function deps(user: Awaited<ReturnType<Deps["getUser"]>> = VERIFIED) {
  const mails: Mail[] = [];
  const d: Deps = { env: (n) => ENV[n], getUser: (t) => Promise.resolve(t === "good" ? user : null), send: (_c, m) => { mails.push(m); return Promise.resolve(); }, timeoutMs: 50 };
  return { d, mails };
}
const email = { to: "customer@client.example", subject: "Hello", body: "Hi there" };
const stable = (raw: string) => raw.replace(/^Date: .*$/m, "Date: X").replace(/^Message-ID: .*$/m, "Message-ID: X");
const headers = (raw: string) => raw.split("\r\n\r\n")[0].split("\r\n");

Deno.test("Reply-To is the signed-in sender's own verified email; From is unchanged", async () => {
  const { d, mails } = deps();
  const r = await makeHandler(d)(req(email));
  assertEquals(r.status, 200);
  const json = await r.json();
  assertEquals(json.replyTo, "owner@acme.example");
  assertEquals(mails[0].replyTo, "owner@acme.example");
  assertEquals(mails[0].from, "B2BNEST <notifications@b2bnest.online>");
  const h = headers(buildMessage(mails[0]));
  assertEquals(h.filter((l) => /^(From|To|Reply-To):/.test(l)), [
    "From: B2BNEST <notifications@b2bnest.online>", "To: customer@client.example", "Reply-To: owner@acme.example",
  ]);
});

Deno.test("no verified email: no Reply-To header, the email still goes, and the response says where replies go", async () => {
  for (const user of [
    { id: "u1", email: "owner@acme.example", email_confirmed_at: null },
    { id: "u1", email: null, email_confirmed_at: "2026-10-01T10:00:00Z" },
    { id: "u1" },
  ]) {
    const { d, mails } = deps(user);
    const r = await makeHandler(d)(req(email));
    assertEquals(r.status, 200);
    const json = await r.json();
    assertEquals(json.replyTo, null);
    assertEquals(json.replyNote, NO_REPLY_ADDRESS);
    assertEquals("replyTo" in mails[0], false);
    assertEquals(buildMessage(mails[0]).includes("Reply-To"), false);
  }
});

Deno.test("a reply address in the request body is ignored (cannot aim replies at someone else)", async () => {
  for (const extra of [
    { replyTo: "attacker@evil.example" }, { reply_to: "attacker@evil.example" }, { "Reply-To": "attacker@evil.example" },
    { from: "ceo@victim.example" }, { user: { email: "attacker@evil.example", email_confirmed_at: "2026-01-01" } },
  ]) {
    const { d, mails } = deps();
    const r = await makeHandler(d)(req({ ...email, ...extra }));
    assertEquals(r.status, 200);
    assertEquals((await r.json()).replyTo, "owner@acme.example");
    const raw = buildMessage(mails[0]);
    assertEquals(raw.includes("evil.example") || raw.includes("victim.example"), false, JSON.stringify(extra));
  }
  // And with an unverified account, the body still can't supply one.
  const { d, mails } = deps({ id: "u1", email: "owner@acme.example", email_confirmed_at: null });
  await makeHandler(d)(req({ ...email, replyTo: "attacker@evil.example" }));
  assertEquals(buildMessage(mails[0]).includes("Reply-To"), false);
});

const INJECTIONS = [
  "owner@acme.example\r\nBcc: victim@evil.example", "owner@acme.example\nBcc: victim@evil.example", "owner@acme.example\r",
  "owner@acme.example, other@evil.example", "Owner <owner@acme.example>", "\"o\"@acme.example", "owner @acme.example",
  " owner@acme.example\t", "owner@acme.example;x@evil.example", "ownér@acme.example", "owner@acme", "@acme.example", "owner@",
  "owner@acme..example", ".owner@acme.example", "own..er@acme.example", "owner@-acme.example", `${"a".repeat(65)}@acme.example`,
  `owner@${"a".repeat(250)}.example`, "owner@acme.example\u0000", "owner@acme.example Bcc: x@evil.example", "",
];

Deno.test("header injection: an unsafe account email is never used, and the sender stays safe", async () => {
  for (const bad of INJECTIONS) {
    assertEquals(isSafeReplyAddress(bad), false, JSON.stringify(bad));
    const { d, mails } = deps({ id: "u1", email: bad, email_confirmed_at: "2026-10-01T10:00:00Z" });
    const r = await makeHandler(d)(req(email));
    assertEquals(replyToAddress({ email: bad, email_confirmed_at: "x" }), null, JSON.stringify(bad));
    assertEquals(r.status, 200);
    const json = await r.json();
    assertEquals([json.replyTo, json.replyNote], [null, NO_REPLY_ADDRESS], JSON.stringify(bad));
    const raw = buildMessage(mails[0]);
    assertEquals(/\r\n(Bcc|Cc):/i.test(raw), false);
    assertEquals(raw.includes("Reply-To"), false);
  }
});

// Values that would break or add a header. buildMessage refuses these itself (the stricter address rules are in
// _shared/reply-to.ts, applied by request.ts before buildMessage is reached).
const HEADER_UNSAFE = INJECTIONS.filter((s) => !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+$/.test(s));

Deno.test("buildMessage refuses an unsafe Reply-To instead of folding it into a header", () => {
  assert(HEADER_UNSAFE.length >= 14 && HEADER_UNSAFE.some((s) => s.includes("\r\n")));
  for (const bad of HEADER_UNSAFE) {
    assertThrows(() => buildMessage({ from: "f@b2bnest.online", to: ["a@x.example"], subject: "S", content: "c", replyTo: bad }), Error, "Unsafe Reply-To");
  }
  for (const ok of ["owner@acme.example", "first.last+tag@sub.acme.co.uk", "o'brien@acme.example"]) assert(isSafeReplyAddress(ok), ok);
});

// The buildMessage of main before Phase 18, copied verbatim: the reference for every sender that passes no reply address.
function buildMessageBeforePhase18(mail: Mail, domain = "b2bnest.online"): string {
  const enc = new TextEncoder();
  const b64utf8 = (s: string) => { const b = enc.encode(s); let bin = ""; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(bin); };
  const wrap76 = (s: string) => s.replace(/.{1,76}/g, "$&\r\n");
  const encWord = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64utf8(s)}?=`);
  const html = mail.html !== undefined;
  const body = html ? mail.html! : (mail.content ?? "");
  return [
    `From: ${mail.from}`, `To: ${mail.to.join(", ")}`, `Subject: ${encWord(mail.subject)}`, `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`, "MIME-Version: 1.0", `Content-Type: text/${html ? "html" : "plain"}; charset=UTF-8`,
    "Content-Transfer-Encoding: base64", "", wrap76(b64utf8(body)),
  ].join("\r\n");
}

Deno.test("other senders: buildMessage output is byte-identical to before when no reply address is passed", () => {
  const from = "B2BNEST <notifications@b2bnest.online>";
  const cases: Mail[] = [
    // onboarding-email-sender and support-email-sender: sendSmtp(cfg, { from: cfg.from, to: [to], subject, content: text })
    { from, to: ["new.user@client.example"], subject: "Welcome to B2BNEST", content: "Hello,\n\nWelcome aboard.\n\n— B2BNEST" },
    { from, to: ["customer@client.example"], subject: "Re: [Ticket #12] Printer offline — update", content: "A reply was added to your ticket.\r\n.\r\nLine starting with a dot" },
    // trial-email-sender and send-document-email pass a raw message; buildMessage is only their fallback shape.
    { from, to: ["a@x.example"], subject: "", content: "" },
    { from: "f@x.example", to: ["a@x.example", "b@x.example"], subject: "Café ✓", html: `<p>${"long ".repeat(400)}</p>` },
    // workflow emails sent before Phase 18 / from an unverified account (no replyTo key at all)
    { from, to: ["a@x.example"], subject: "Invoice INV-7", content: "Hi Sam,\n£40.00 is due." },
  ];
  for (const m of cases) assertEquals(stable(buildMessage(m)), stable(buildMessageBeforePhase18(m)), m.subject);
});

Deno.test("other senders never pass a reply address to buildMessage", async () => {
  for (const f of ["onboarding-email-sender/index.ts", "support-email-sender/index.ts", "trial-email-sender/index.ts", "send-document-email/index.ts"]) {
    const src = await Deno.readTextFile(new URL(`../${f}`, import.meta.url));
    const calls = src.match(/sendSmtp\([^)]*\)/g) ?? [];
    assert(calls.length > 0, f);
    for (const c of calls) assertEquals(/replyTo/i.test(c), false, `${f}: ${c}`);
  }
});
