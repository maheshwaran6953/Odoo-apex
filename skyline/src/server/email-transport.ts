import nodemailer from "nodemailer";

export type EmailMessage = {
  id: string;
  to: string;
  subject: string;
  body: string;
};
export function emailProvider() {
  return process.env.EMAIL_PROVIDER || "resend";
}
export function emailConfigurationError(): string | null {
  const provider = emailProvider();
  if (!["smtp", "resend"].includes(provider))
    return "Choose smtp or resend as EMAIL_PROVIDER.";
  if (!process.env.EMAIL_FROM || /[\r\n]/.test(process.env.EMAIL_FROM))
    return "Configure a valid EMAIL_FROM.";
  if (provider === "resend")
    return process.env.RESEND_API_KEY ? null : "Configure RESEND_API_KEY.";
  const port = Number(process.env.SMTP_PORT || 465);
  if (
    process.env.SMTP_SECURE &&
    !["true", "false"].includes(process.env.SMTP_SECURE)
  )
    return "SMTP_SECURE must be true or false.";
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASSWORD
  )
    return "Configure SMTP_HOST, SMTP_USER and SMTP_PASSWORD.";
  if (![465, 587].includes(port))
    return "SMTP_PORT must be 465 or 587 with encrypted transport.";
  if ((port === 465) !== (process.env.SMTP_SECURE !== "false"))
    return "Use SMTP_SECURE=true for port465 or false for STARTTLS port587.";
  if (process.env.SMTP_HOST.toLowerCase() === "smtp.gmail.com") {
    const sender =
      process.env.EMAIL_FROM.match(/<([^<>]+)>/)?.[1] || process.env.EMAIL_FROM;
    if (
      sender.trim().toLowerCase() !== process.env.SMTP_USER.trim().toLowerCase()
    )
      return "For Gmail, EMAIL_FROM must match SMTP_USER.";
  }
  return null;
}
export function emailDeliveryConfigured() {
  return !emailConfigurationError();
}
function smtpTransport() {
  const error = emailConfigurationError();
  if (error) throw Error(error);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    requireTLS: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    logger: false,
    debug: false,
    tls: { rejectUnauthorized: true },
  });
}
export async function verifyEmailConnection() {
  const error = emailConfigurationError();
  if (error) throw Error(error);
  if (emailProvider() !== "smtp")
    throw Error(
      "Connection verification is currently available for SMTP only.",
    );
  const transport = smtpTransport();
  try {
    await transport.verify();
  } finally {
    transport.close();
  }
}
export class EmailTransportError extends Error {
  constructor(
    message: string,
    public retrySafe: boolean,
  ) {
    super(message);
  }
}
export async function sendEmail(message: EmailMessage): Promise<string> {
  const error = emailConfigurationError();
  if (error) throw new EmailTransportError(error, true);
  if (emailProvider() === "resend") {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.RESEND_API_KEY,
        "Content-Type": "application/json",
        "Idempotency-Key": message.id,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.body,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new EmailTransportError(
        "Email provider returned HTTP " + response.status,
        true,
      );
    const result = (await response.json()) as { id?: string };
    if (!result.id)
      throw new EmailTransportError(
        "Email provider response requires reconciliation.",
        false,
      );
    return result.id;
  }
  const transport = smtpTransport();
  try {
    const result = await transport.sendMail({
      from: process.env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.body,
      messageId: "<" + message.id + "@skyline.local>",
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    if (!result.accepted?.length)
      throw new EmailTransportError(
        "SMTP did not accept this recipient.",
        true,
      );
    return result.messageId;
  } catch (error) {
    if (error instanceof EmailTransportError) throw error;
    const e = error as {
      code?: string;
      responseCode?: number;
      command?: string;
    };
    const safe =
      !!e.responseCode ||
      ["EAUTH", "EDNS", "ECONNECTION"].includes(e.code || "") ||
      [
        "CONN",
        "AUTH",
        "EHLO",
        "HELO",
        "STARTTLS",
        "MAIL FROM",
        "RCPT TO",
      ].includes(e.command || "");
    throw new EmailTransportError(
      e.code === "EAUTH"
        ? "SMTP authentication failed. Check the Gmail App Password."
        : "SMTP delivery failed" +
            (e.responseCode
              ? " (HTTP-like SMTP status " + e.responseCode + ")"
              : ". Check the configured connection; delivery may need review."),
      safe,
    );
  } finally {
    transport.close();
  }
}
