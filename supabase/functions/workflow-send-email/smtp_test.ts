import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { buildMessage, buildMixedMessage } from "./smtp.ts";

const stable = (raw: string) => raw.replace(/^Date: .*$/m, "Date: X").replace(/^Message-ID: .*$/m, "Message-ID: X");
const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));

Deno.test("buildMessage (existing senders): single plain or HTML body, unchanged", () => {
  const plain = stable(buildMessage({ from: "B2BNEST <info@b2bnest.online>", to: ["a@x.example", "b@x.example"], subject: "Hi", content: "Hello" }));
  assertEquals(plain, ["From: B2BNEST <info@b2bnest.online>", "To: a@x.example, b@x.example", "Subject: Hi", "Date: X", "Message-ID: X",
    "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", `${b64("Hello")}\r\n`].join("\r\n"));
  const html = stable(buildMessage({ from: "f@x.example", to: ["a@x.example"], subject: "Café", html: "<p>Hi</p>" }));
  assert(html.includes("Content-Type: text/html; charset=UTF-8"));
  assert(html.includes(`Subject: =?UTF-8?B?${b64("Café")}?=`));
  assertEquals(html.includes("multipart"), false);
});

Deno.test("buildMixedMessage: text + HTML alternatives and one PDF attachment, one-line headers", () => {
  const bytes = new TextEncoder().encode("%PDF-1.4 test");
  const raw = buildMixedMessage({
    from: `"B2BNEST on behalf of Acme" <info@b2bnest.online>`, to: "c@client.example", replyTo: "owner@acme.example",
    subject: "Invoice INV-1\r\nBcc: x@evil.example", text: "Hello", html: "<p>Hello</p>",
    attachment: { filename: "INV-1.pdf", contentType: "application/pdf", bytes },
  });
  const head = raw.split("\r\n\r\n")[0].split("\r\n");
  assertEquals(head.filter((l) => /^(From|To|Reply-To|Subject|Bcc):/.test(l)), [
    `From: "B2BNEST on behalf of Acme" <info@b2bnest.online>`, "To: c@client.example", "Reply-To: owner@acme.example", "Subject: Invoice INV-1 Bcc: x@evil.example",
  ]);
  const boundary = head.find((l) => l.startsWith("Content-Type: multipart/mixed"))!.match(/boundary="([^"]+)"/)![1];
  assert(raw.includes(`--${boundary}\r\nContent-Type: multipart/alternative`));
  assert(raw.includes(`Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64("Hello")}`));
  assert(raw.includes(`Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64("<p>Hello</p>")}`));
  assert(raw.includes(`Content-Type: application/pdf; name="INV-1.pdf"\r\nContent-Disposition: attachment; filename="INV-1.pdf"\r\nContent-Transfer-Encoding: base64\r\n\r\n${btoa("%PDF-1.4 test")}`));
  assert(raw.trimEnd().endsWith(`--${boundary}--`));
  // base64 lines stay within 76 characters
  assertEquals(raw.split("\r\n").filter((l) => l.length > 998).length, 0);
});

Deno.test("buildMixedMessage omits Reply-To when none is given", () => {
  const raw = buildMixedMessage({ from: "info@b2bnest.online", to: "c@client.example", subject: "S", text: "t", html: "h", attachment: { filename: "a.pdf", contentType: "application/pdf", bytes: new Uint8Array([37, 80, 68, 70]) } });
  assertEquals(raw.includes("Reply-To:"), false);
});
