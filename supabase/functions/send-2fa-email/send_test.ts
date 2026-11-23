import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { codeEmail, FROM, type Mailer, SEND_FAILED, sendCodeEmail } from "./send.ts";

const CORS = { "Access-Control-Allow-Origin": "https://www.b2bnest.online", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const CODE = "482913";
const EMAIL = "someone@example.com";

function mailer(answer: Awaited<ReturnType<Mailer["emails"]["send"]>>) {
  const sent: Parameters<Mailer["emails"]["send"]>[0][] = [];
  return { sent, m: { emails: { send: (msg: Parameters<Mailer["emails"]["send"]>[0]) => { sent.push(msg); return Promise.resolve(answer); } } } as Mailer };
}
/** Runs fn with console.error captured. */
async function captureErrors<T>(fn: () => Promise<T>): Promise<{ result: T; logged: string }> {
  const orig = console.error;
  const lines: string[] = [];
  console.error = (...a: unknown[]) => { lines.push(a.map(String).join(" ")); };
  try { return { result: await fn(), logged: lines.join("\n") }; } finally { console.error = orig; }
}

Deno.test("sends from the verified B2BNEST address and answers { success: true }", async () => {
  const { sent, m } = mailer({ data: { id: "em_1" }, error: null });
  const res = await sendCodeEmail(m, { email: EMAIL, type: "login", code: CODE }, CORS);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { success: true });
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), CORS["Access-Control-Allow-Origin"]);
  assertEquals(sent.length, 1);
  assertEquals(sent[0].from, "B2BNEST <notifications@b2bnest.online>");
  assertEquals(FROM, sent[0].from);
  assertEquals(sent[0].to, [EMAIL]);
  assertEquals(sent[0].subject, "Your login verification code");
  assert(sent[0].html.includes(CODE));
});

Deno.test("a Resend error answers 502 with a plain message and never logs the code or the full address", async () => {
  const { m } = mailer({ data: null, error: { name: "validation_error", statusCode: 403, message: `You can only send testing emails to your own email address (${EMAIL}). Code ${CODE}` } });
  const { result: res, logged } = await captureErrors(() => sendCodeEmail(m, { email: EMAIL, type: "verification", code: CODE, name: "Sam" }, CORS));
  assertEquals(res.status, 502);
  const body = await res.json();
  assertEquals(body, { error: SEND_FAILED });
  assertEquals(SEND_FAILED, "Could not send the code. Please try again.");
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), CORS["Access-Control-Allow-Origin"]);
  assertEquals(res.headers.get("Content-Type"), "application/json");
  assert(!JSON.stringify(body).includes(CODE), "the answer has no code");
  assert(logged.includes("som***@example.com") && logged.includes("validation_error 403"), logged);
  assert(!logged.includes(CODE), "the log has no code");
  assert(!logged.includes(EMAIL), "the log has no full address");
});

Deno.test("both emails say B2BNEST, keep the code and the 5-minute expiry, and carry the footer; subjects unchanged", () => {
  for (const type of ["verification", "login"] as const) {
    const { subject, html } = codeEmail(type, CODE, "Sam");
    assert(!html.includes("BusinessForms"), type);
    assert(html.includes("The B2BNEST Team"), type);
    assert(html.includes(CODE), type);
    assert(html.includes("This code will expire in 5 minutes."), type);
    assert(html.includes("B2BNEST is a brand of Edeals Master Ltd (Company No. 15242148). This is an automated message about your B2BNEST account, so please don't reply to it."), type);
    assertEquals(subject, type === "verification" ? "Verify your email address" : "Your login verification code");
  }
  assert(codeEmail("verification", CODE).html.includes("Welcome to B2BNEST!"));
  assert(codeEmail("verification", CODE).html.includes("Hello User,"));
});
