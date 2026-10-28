// multipart/alternative (plain text + HTML) with a List-Unsubscribe header. Kept here so the shared smtp.ts builders
// used by the other senders stay exactly as they are. Every header value is folded to one line.
const enc = new TextEncoder();
const b64utf8 = (s: string) => {
  const bytes = enc.encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const wrap76 = (s: string) => s.replace(/.{1,76}/g, "$&\r\n");
const encWord = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64utf8(s)}?=`);
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

export interface AlternativeMail { from: string; to: string; subject: string; text: string; html: string; listUnsubscribe?: string }

export function buildAlternativeMessage(m: AlternativeMail, domain = "b2bnest.online"): string {
  const alt = `alt_${crypto.randomUUID().replace(/-/g, "")}`;
  return [
    `From: ${oneLine(m.from)}`,
    `To: ${oneLine(m.to)}`,
    `Subject: ${encWord(oneLine(m.subject))}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    ...(m.listUnsubscribe ? [`List-Unsubscribe: <${oneLine(m.listUnsubscribe)}>`] : []),
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    "",
    `--${alt}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64utf8(m.text)),
    `--${alt}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64utf8(m.html)),
    `--${alt}--`,
    "",
  ].join("\r\n");
}
