import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { MAX_BODY_LENGTH, MAX_SUBJECT_LENGTH, PLACEHOLDERS, placeholdersIn, renderTemplate } from "./placeholders.ts";

const errorsOf = (r: ReturnType<typeof renderTemplate>) => (r.ok ? [] : r.errors);

Deno.test("fills every placeholder, including repeated ones and spaces inside the braces", () => {
  const r = renderTemplate({ subject: "Invoice {{invoice_number}} for {{ name }}", body: "Hi {{name}},\n{{amount}} was due on {{due_date}}.\nThanks, {{name}}'s supplier" },
    { name: "Sam", invoice_number: "INV-1", amount: "£20.00", due_date: "1 Nov" });
  assertEquals(r, { ok: true, subject: "Invoice INV-1 for Sam", body: "Hi Sam,\n£20.00 was due on 1 Nov.\nThanks, Sam's supplier", used: ["invoice_number", "name", "amount", "due_date"] });
});

Deno.test("text without placeholders is unchanged (existing workflows keep working)", () => {
  assertEquals(renderTemplate({ subject: "Hi", body: "Hello there\nBye" }), { ok: true, subject: "Hi", body: "Hello there\nBye", used: [] });
});

Deno.test("a missing value is an error, never sent as the literal {{name}}", () => {
  const r = renderTemplate({ subject: "Hello {{name}}", body: "Body" }, {});
  assertEquals(r.ok, false);
  assertEquals(errorsOf(r), ["Customer's name ({{name}}) needs a value."]);
  assertEquals(errorsOf(renderTemplate({ subject: "Hello {{name}}", body: "x" }, { name: "   " })).length, 1);
});

Deno.test("an unknown placeholder is an error naming the allowed ones", () => {
  const e = errorsOf(renderTemplate({ subject: "Hi {{first_name}}", body: "{{Name}}" }, { first_name: "Sam", Name: "Sam" }));
  assertEquals(e.length, 2);
  assert(e[0].startsWith("Subject: {{first_name}} isn't a placeholder you can use"));
  assert(e[0].includes("{{name}}"));
  assert(e[1].startsWith("Message: {{Name}}"));
});

Deno.test("broken braces are an error, not sent as typed", () => {
  for (const body of ["Hi {{name", "Hi name}}", "{{ }}", "Total {{amount}} {{"]) {
    assertEquals(renderTemplate({ subject: "S", body }, { name: "Sam", amount: "£1" }).ok, false, body);
  }
});

Deno.test("injection: a value containing a placeholder is refused, so nothing is expanded twice", () => {
  const e = errorsOf(renderTemplate({ subject: "Hi {{name}}", body: "{{company}}" }, { name: "{{company}}", company: "Acme" }));
  assertEquals(e, ["Customer's name: can't contain \"{{\" or \"}}\"."]);
});

Deno.test("injection: a line break in a value or in the subject is refused (no extra email headers)", () => {
  assertEquals(errorsOf(renderTemplate({ subject: "Hi {{name}}", body: "x" }, { name: "Sam\r\nBcc: x@evil.test" })), ["Customer's name: must be a single line."]);
  assertEquals(errorsOf(renderTemplate({ subject: "Hi\nBcc: x@evil.test", body: "x" })), ["Subject: must be a single line."]);
  assertEquals(renderTemplate({ subject: "S", body: "{{name}}" }, { name: "a\u2028b" }).ok, false);
});

Deno.test("injection: HTML in a value stays plain text; in HTML mode it is escaped", () => {
  const v = { name: "<script>alert(1)</script> & \"co\"" };
  const plain = renderTemplate({ subject: "S", body: "Hi {{name}}" }, v);
  assertEquals(plain.ok && plain.body, "Hi <script>alert(1)</script> & \"co\"");
  const html = renderTemplate({ subject: "S", body: "<p>Hi {{name}}</p>" }, v, { html: true });
  assertEquals(html.ok && html.body, "<p>Hi &lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;co&quot;</p>");
});

Deno.test("very long values are refused at each placeholder's limit", () => {
  for (const p of PLACEHOLDERS) {
    const tpl = { subject: "S", body: `{{${p.key}}}` };
    assertEquals(renderTemplate(tpl, { [p.key]: "x".repeat(p.maxLength) }).ok, true, p.key);
    assertEquals(errorsOf(renderTemplate(tpl, { [p.key]: "x".repeat(p.maxLength + 1) })), [`${p.label}: at most ${p.maxLength} characters.`]);
  }
});

Deno.test("the filled-in subject and message have length limits too", () => {
  const long = renderTemplate({ subject: `${"s".repeat(MAX_SUBJECT_LENGTH - 5)} {{name}}`, body: "x" }, { name: "Sammy Taylor" });
  assertEquals(errorsOf(long), [`Subject: at most ${MAX_SUBJECT_LENGTH} characters once the details are filled in.`]);
  assertEquals(renderTemplate({ subject: "S", body: "b".repeat(MAX_BODY_LENGTH + 1) }).ok, false);
});

Deno.test("placeholdersIn lists only allowed names, once each, in order", () => {
  assertEquals(placeholdersIn("{{amount}} {{name}}", "{{name}} {{nope}} {{ due_date }}"), ["amount", "name", "due_date"]);
});

Deno.test("values for placeholders that aren't used are ignored", () => {
  assertEquals(renderTemplate({ subject: "S", body: "B" }, { name: "Sam\nwith a line break" }).ok, true);
});
