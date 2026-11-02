import { logger } from "@/lib/logger";

type SendByteMessage = {
  to: string | string[];
  subject: string;
  text: string;
};

let missingConfigurationReported = false;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendEmail({ to, subject, text }: SendByteMessage): Promise<boolean> {
  const apiKey = process.env.SENDBYTE_API_KEY;
  const from = process.env.SENDBYTE_FROM_EMAIL;

  if (!apiKey || !from) {
    if (!missingConfigurationReported) {
      logger.warn("SendByte email is not configured; activity emails are disabled", {
        hasApiKey: Boolean(apiKey),
        hasFromAddress: Boolean(from),
      });
      missingConfigurationReported = true;
    }
    return false;
  }

  const htmlText = escapeHtml(text).replace(/\r?\n/g, "<br>");
  const response = await fetch("https://api.sendbyte.africa/v1/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033"><h2>${escapeHtml(subject)}</h2><p>${htmlText}</p><p style="color:#64748b;font-size:12px">KAD-SAMIS automated notification</p></div>`,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`SendByte returned HTTP ${response.status}`);
  }

  return true;
}

export async function sendActivityEmail(email: string, subject: string, text: string) {
  try {
    await sendEmail({ to: email, subject, text });
  } catch (error) {
    logger.error("SendByte activity email failed", error, { subject });
  }
}
