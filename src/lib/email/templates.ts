import { formatCurrency, formatDate, type Numeric } from "@/lib/utils";

export interface EmailLineItem {
  description: string;
  quantity: number;
  unitPrice: Numeric;
  total: Numeric;
}

// ---------------------------------------------------------------------------
// Shared styling helpers (inline styles for broad email-client support)
// ---------------------------------------------------------------------------

const COLORS = {
  bg: "#f4f5f7",
  card: "#ffffff",
  text: "#1f2933",
  muted: "#6b7280",
  border: "#e5e7eb",
  brand: "#f5851f", // AiTek orange
  brandText: "#ffffff",
};

/** Public URL of the logo for use in email headers (white background). */
function logoTag(companyName: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (base) {
    return `<img src="${base}/logo.png" alt="${escapeHtml(
      companyName
    )}" height="40" style="height:40px;width:auto;display:block;" />`;
  }
  // Fallback: company name as text if no public URL is configured.
  return `<span style="color:${COLORS.text};font-size:22px;font-weight:700;">${escapeHtml(
    companyName
  )}</span>`;
}

function payButton(paymentUrl?: string): string {
  if (!paymentUrl) return "";
  return `
    <tr>
      <td align="center" style="padding: 24px 0;">
        <a href="${escapeHtml(paymentUrl)}"
           style="display:inline-block;background:${COLORS.brand};color:${COLORS.brandText};
                  text-decoration:none;font-weight:600;font-size:16px;padding:14px 32px;
                  border-radius:8px;font-family:Arial,Helvetica,sans-serif;">
          Pay Now
        </a>
      </td>
    </tr>`;
}

function layout(opts: {
  companyName: string;
  heading: string;
  bodyRows: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(opts.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:${COLORS.bg};padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="width:600px;max-width:100%;background:${COLORS.card};border-radius:12px;
                      overflow:hidden;border:1px solid ${COLORS.border};">
          <tr>
            <td style="background:${COLORS.card};padding:20px 32px;border-bottom:3px solid ${COLORS.brand};">
              ${logoTag(opts.companyName)}
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:${COLORS.text};font-size:15px;line-height:1.6;">
              <h1 style="margin:0 0 16px;font-size:20px;color:${COLORS.text};">
                ${escapeHtml(opts.heading)}
              </h1>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${opts.bodyRows}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid ${COLORS.border};
                       color:${COLORS.muted};font-size:12px;line-height:1.5;">
              Thank you for your business.<br />
              ${escapeHtml(opts.companyName)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Subject builders
// ---------------------------------------------------------------------------

export function invoiceEmailSubject(opts: {
  companyName: string;
  invoiceNumber: string;
  dueDate: Date | string;
}): string {
  return `Invoice ${opts.invoiceNumber} from ${opts.companyName} — Due ${formatDate(
    opts.dueDate
  )}`;
}

export function reminderSubject(invoiceNumber: string): string {
  return `Reminder: Invoice ${invoiceNumber} is overdue`;
}

export function paymentReceivedSubject(invoiceNumber: string): string {
  return `Payment Confirmed — Invoice ${invoiceNumber}`;
}

export function passwordResetSubject(companyName: string): string {
  return `Reset your ${companyName} admin password`;
}

export function twoFactorSubject(companyName: string): string {
  return `Your ${companyName} login code`;
}

// ---------------------------------------------------------------------------
// Invoice email
// ---------------------------------------------------------------------------

export function invoiceEmailHtml(data: {
  companyName: string;
  invoiceNumber: string;
  clientName: string;
  total: Numeric;
  currency: string;
  dueDate: Date | string;
  items: EmailLineItem[];
  paymentUrl?: string;
  notes?: string | null;
}): string {
  const itemRows = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid ${COLORS.border};font-size:14px;">
          ${escapeHtml(item.description)}
        </td>
        <td align="center" style="padding:10px 8px;border-bottom:1px solid ${COLORS.border};font-size:14px;">
          ${item.quantity}
        </td>
        <td align="right" style="padding:10px 8px;border-bottom:1px solid ${COLORS.border};font-size:14px;">
          ${formatCurrency(item.unitPrice, data.currency)}
        </td>
        <td align="right" style="padding:10px 8px;border-bottom:1px solid ${COLORS.border};font-size:14px;">
          ${formatCurrency(item.total, data.currency)}
        </td>
      </tr>`
    )
    .join("");

  const notesBlock = data.notes
    ? `<tr><td style="padding-top:16px;color:${COLORS.muted};font-size:13px;">
         ${escapeHtml(data.notes)}
       </td></tr>`
    : "";

  const bodyRows = `
    <tr><td style="padding-bottom:8px;">
      Dear ${escapeHtml(data.clientName)},
    </td></tr>
    <tr><td style="padding-bottom:16px;color:${COLORS.muted};">
      Please find your invoice <strong>${escapeHtml(
        data.invoiceNumber
      )}</strong> below. Payment is due by
      <strong>${formatDate(data.dueDate)}</strong>.
    </td></tr>
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="border-collapse:collapse;margin-top:8px;">
        <tr style="background:${COLORS.bg};">
          <th align="left" style="padding:10px 8px;font-size:12px;color:${COLORS.muted};text-transform:uppercase;">Description</th>
          <th align="center" style="padding:10px 8px;font-size:12px;color:${COLORS.muted};text-transform:uppercase;">Qty</th>
          <th align="right" style="padding:10px 8px;font-size:12px;color:${COLORS.muted};text-transform:uppercase;">Unit</th>
          <th align="right" style="padding:10px 8px;font-size:12px;color:${COLORS.muted};text-transform:uppercase;">Total</th>
        </tr>
        ${itemRows}
        <tr>
          <td colspan="3" align="right" style="padding:14px 8px;font-weight:700;font-size:16px;">
            Total Due
          </td>
          <td align="right" style="padding:14px 8px;font-weight:700;font-size:16px;">
            ${formatCurrency(data.total, data.currency)}
          </td>
        </tr>
      </table>
    </td></tr>
    ${payButton(data.paymentUrl)}
    ${notesBlock}`;

  return layout({
    companyName: data.companyName,
    heading: `Invoice ${data.invoiceNumber}`,
    bodyRows,
  });
}

// ---------------------------------------------------------------------------
// Payment received email
// ---------------------------------------------------------------------------

export function paymentReceivedHtml(data: {
  companyName: string;
  invoiceNumber: string;
  clientName: string;
  total: Numeric;
  currency: string;
  paidAt: Date | string;
}): string {
  const bodyRows = `
    <tr><td style="padding-bottom:8px;">
      Dear ${escapeHtml(data.clientName)},
    </td></tr>
    <tr><td style="padding-bottom:16px;color:${COLORS.muted};">
      We have received your payment of
      <strong>${formatCurrency(data.total, data.currency)}</strong>
      for invoice <strong>${escapeHtml(data.invoiceNumber)}</strong> on
      <strong>${formatDate(data.paidAt)}</strong>. Thank you!
    </td></tr>
    <tr><td style="padding:16px;background:${COLORS.bg};border-radius:8px;
                   color:${COLORS.text};font-size:15px;text-align:center;">
      This invoice is now marked as <strong>PAID</strong>.
    </td></tr>`;

  return layout({
    companyName: data.companyName,
    heading: "Payment Received",
    bodyRows,
  });
}

// ---------------------------------------------------------------------------
// Reminder email
// ---------------------------------------------------------------------------

export function reminderHtml(data: {
  companyName: string;
  invoiceNumber: string;
  clientName: string;
  total: Numeric;
  currency: string;
  dueDate: Date | string;
  paymentUrl?: string;
}): string {
  const bodyRows = `
    <tr><td style="padding-bottom:8px;">
      Dear ${escapeHtml(data.clientName)},
    </td></tr>
    <tr><td style="padding-bottom:16px;color:${COLORS.muted};">
      This is a friendly reminder that invoice
      <strong>${escapeHtml(data.invoiceNumber)}</strong> for
      <strong>${formatCurrency(data.total, data.currency)}</strong>
      was due on <strong>${formatDate(data.dueDate)}</strong> and remains
      unpaid. We would appreciate your prompt payment.
    </td></tr>
    ${payButton(data.paymentUrl)}
    <tr><td style="color:${COLORS.muted};font-size:13px;">
      If you have already made this payment, please disregard this message.
    </td></tr>`;

  return layout({
    companyName: data.companyName,
    heading: `Reminder — Invoice ${data.invoiceNumber}`,
    bodyRows,
  });
}

// ---------------------------------------------------------------------------
// Password reset email
// ---------------------------------------------------------------------------

export function passwordResetHtml(data: {
  companyName: string;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}): string {
  const bodyRows = `
    <tr><td style="padding-bottom:8px;">
      Hi ${escapeHtml(data.name)},
    </td></tr>
    <tr><td style="padding-bottom:16px;color:${COLORS.muted};">
      We received a request to reset the password for your
      <strong>${escapeHtml(data.companyName)}</strong> admin account.
      Click the button below to choose a new password. This link expires in
      <strong>${data.expiresInMinutes} minutes</strong>.
    </td></tr>
    <tr>
      <td align="center" style="padding:24px 0;">
        <a href="${escapeHtml(data.resetUrl)}"
           style="display:inline-block;background:${COLORS.brand};color:${COLORS.brandText};
                  text-decoration:none;font-weight:600;font-size:16px;padding:14px 32px;
                  border-radius:8px;font-family:Arial,Helvetica,sans-serif;">
          Reset Password
        </a>
      </td>
    </tr>
    <tr><td style="color:${COLORS.muted};font-size:13px;word-break:break-all;">
      Or paste this link into your browser:<br />
      <a href="${escapeHtml(data.resetUrl)}" style="color:${COLORS.brand};">${escapeHtml(
        data.resetUrl
      )}</a>
    </td></tr>
    <tr><td style="padding-top:16px;color:${COLORS.muted};font-size:13px;">
      If you didn't request this, you can safely ignore this email — your
      password will not change.
    </td></tr>`;

  return layout({
    companyName: data.companyName,
    heading: "Password Reset",
    bodyRows,
  });
}

// ---------------------------------------------------------------------------
// Two-factor login code email
// ---------------------------------------------------------------------------

export function twoFactorCodeHtml(data: {
  companyName: string;
  name: string;
  code: string;
  expiresInMinutes: number;
}): string {
  const bodyRows = `
    <tr><td style="padding-bottom:8px;">
      Hi ${escapeHtml(data.name)},
    </td></tr>
    <tr><td style="padding-bottom:16px;color:${COLORS.muted};">
      Use the code below to finish signing in to your
      <strong>${escapeHtml(data.companyName)}</strong> admin account. It expires
      in <strong>${data.expiresInMinutes} minutes</strong>.
    </td></tr>
    <tr>
      <td align="center" style="padding:8px 0 24px;">
        <div style="display:inline-block;background:${COLORS.bg};border:1px solid ${COLORS.border};
                    border-radius:10px;padding:18px 28px;font-family:'Courier New',monospace;
                    font-size:34px;font-weight:700;letter-spacing:10px;color:${COLORS.text};">
          ${escapeHtml(data.code)}
        </div>
      </td>
    </tr>
    <tr><td style="color:${COLORS.muted};font-size:13px;">
      If you didn't try to sign in, someone may have your password — change it
      as soon as possible.
    </td></tr>`;

  return layout({
    companyName: data.companyName,
    heading: "Your login code",
    bodyRows,
  });
}
