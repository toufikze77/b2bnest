// send-2fa-email: the email itself (sender, subject, body) and sending it through Resend. Resend's emails.send does
// NOT throw when it refuses an email; it answers { data, error }. A refusal is logged without the code or the full
// address and answered 502, so the screen can say the code was not sent instead of waiting for an email that never comes.

/** Our verified domain in Resend (DKIM and SPF verified 23 Nov 2026), the same sender as the Supabase Auth emails. */
export const FROM = "B2BNEST <notifications@b2bnest.online>";
export const SEND_FAILED = "Could not send the code. Please try again.";

export type CodeType = "verification" | "login";
export interface Mailer {
  emails: {
    send(message: { from: string; to: string[]; subject: string; html: string }): Promise<{ data?: unknown; error?: { name?: string; message?: string; statusCode?: number } | null }>;
  };
}

/** "abc***@example.com": the same masking as the log line before sending. */
export const maskEmail = (email: string) => `${email.substring(0, 3)}***@${email.split("@")[1]}`;

const FOOTER = `
          <p style="border-top: 1px solid #e3e8f0; padding-top: 16px; margin-top: 24px; font-size: 12px; line-height: 18px; color: #7a8497;">B2BNEST is a brand of Edeals Master Ltd (Company No. 15242148). This is an automated message about your B2BNEST account, so please don't reply to it.</p>`;

export function codeEmail(type: CodeType, code: string, name?: string): { subject: string; html: string } {
  const subject = type === "verification"
    ? "Verify your email address"
    : "Your login verification code";

  const html = type === "verification"
    ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Welcome to B2BNEST!</h1>
          <p>Hello ${name || "User"},</p>
          <p>Thank you for signing up! Please use the verification code below to verify your email address:</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
            <h2 style="color: #2563eb; font-size: 32px; letter-spacing: 4px; margin: 0;">${code}</h2>
          </div>
          <p>This code will expire in 5 minutes.</p>
          <p>If you didn't create an account with us, please ignore this email.</p>
          <p>Best regards,<br>The B2BNEST Team</p>${FOOTER}
        </div>
      `
    : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Login Verification Code</h1>
          <p>Hello,</p>
          <p>Here's your verification code to complete your login:</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
            <h2 style="color: #2563eb; font-size: 32px; letter-spacing: 4px; margin: 0;">${code}</h2>
          </div>
          <p>This code will expire in 5 minutes.</p>
          <p>If you didn't try to log in, please ignore this email and consider changing your password.</p>
          <p>Best regards,<br>The B2BNEST Team</p>${FOOTER}
        </div>
      `;
  return { subject, html };
}

/** Sends the code. 200 { success: true } when Resend accepts it; 502 { error } when Resend answers with an error. */
export async function sendCodeEmail(
  mailer: Mailer,
  f: { email: string; type: CodeType; code: string; name?: string },
  headers: Record<string, string>,
): Promise<Response> {
  const { subject, html } = codeEmail(f.type, f.code, f.name);
  const { error } = await mailer.emails.send({ from: FROM, to: [f.email], subject, html });
  if (error) {
    // Never the code, the email body or the full address: Resend's message can repeat the recipient, so it is left out.
    console.error(`send-2fa-email: Resend refused the email to ${maskEmail(f.email)} type=${f.type} (${error.name ?? "error"}${error.statusCode ? ` ${error.statusCode}` : ""})`);
    return new Response(JSON.stringify({ error: SEND_FAILED }), { status: 502, headers: { "Content-Type": "application/json", ...headers } });
  }
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json", ...headers } });
}
