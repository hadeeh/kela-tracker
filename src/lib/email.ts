import nodemailer from "nodemailer";

// Gmail SMTP configuration
// To set up:
// 1. Go to your Google Account → Security → 2-Step Verification → turn ON
// 2. Go to App Passwords → create a new app password for "Kela Tracker"
// 3. Copy the 16-character password
// 4. Set env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM

const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
const smtpUser = process.env.SMTP_USER || "";
const smtpPass = process.env.SMTP_PASS || "";
const fromEmail = process.env.SMTP_FROM || smtpUser;

// Create a reusable transporter (lazy init)
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!smtpUser || !smtpPass) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }
  return transporter;
}

export type InviteEmailParams = {
  to: string;
  roomName: string;
  roomCode: string;
  inviteeName: string;
  inviterName: string;
  role: string; // "minister" or "member"
  ratePerKela: number;
  roomUrl: string;
};

export async function sendInviteEmail(params: InviteEmailParams): Promise<{ ok: boolean; error?: string }> {
  const transport = getTransporter();
  if (!transport) {
    return { ok: false, error: "Email service not configured (SMTP_USER/SMTP_PASS not set)" };
  }

  const { to, roomName, roomCode, inviteeName, inviterName, role, ratePerKela, roomUrl } = params;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#FFF8E1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#FFE135,#F5C518);padding:30px 20px;text-align:center;">
      <div style="font-size:48px;margin-bottom:8px;">🍌</div>
      <h1 style="margin:0;color:#2B1B0E;font-size:24px;font-weight:800;">Kela Tracker</h1>
      <p style="margin:4px 0 0;color:#5C4A1E;font-size:14px;">You've been invited!</p>
    </div>
    <!-- Body -->
    <div style="padding:30px 20px;">
      <p style="margin:0 0 16px;font-size:16px;color:#333;">Hi ${escapeHtml(inviteeName || "there")},</p>
      <p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.6;">
        <strong>${escapeHtml(inviterName)}</strong> has invited you to join the kela circle
        <strong>"${escapeHtml(roomName)}"</strong> on Kela Tracker.
      </p>
      <div style="background:#FFF8E1;border:1px solid #F5C518;border-radius:10px;padding:16px;margin:20px 0;">
        <table style="width:100%;font-size:14px;color:#444;">
          <tr>
            <td style="padding:4px 0;color:#888;">Role:</td>
            <td style="padding:4px 0;font-weight:600;">${role === "minister" ? "👑 Kela Minister" : "👤 Member"}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#888;">Fine per kela:</td>
            <td style="padding:4px 0;font-weight:600;">PKR ${ratePerKela}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#888;">Room code:</td>
            <td style="padding:4px 0;font-weight:600;font-family:monospace;">${escapeHtml(roomCode)}</td>
          </tr>
        </table>
      </div>
      <p style="margin:0 0 20px;font-size:14px;color:#666;line-height:1.5;">
        What is Kela Tracker? It's a fun app where friends vote when someone "eats kela" (gets offended).
        Earn badges, pay fines, and catch your friends being sensitive! 😄
      </p>
      <!-- CTA Button -->
      <div style="text-align:center;margin:24px 0;">
        <a href="${escapeHtml(roomUrl)}" style="display:inline-block;background:#F5C518;color:#2B1B0E;font-weight:700;font-size:16px;padding:14px 32px;border-radius:10px;text-decoration:none;box-shadow:0 3px 0 #E0B012;">
          🍌 Join the Room
        </a>
      </div>
      <p style="margin:0;font-size:12px;color:#999;text-align:center;">
        Or visit <a href="${escapeHtml(roomUrl)}" style="color:#F5C518;">${escapeHtml(roomUrl)}</a> and enter code <strong>${escapeHtml(roomCode)}</strong>
      </p>
    </div>
    <!-- Footer -->
    <div style="background:#FFF8E1;padding:16px 20px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#999;">
        You received this because ${escapeHtml(inviterName)} invited you to Kela Tracker.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `🍌 Kela Tracker Invitation

Hi ${inviteeName || "there"},

${inviterName} has invited you to join the kela circle "${roomName}" on Kela Tracker.

Role: ${role === "minister" ? "Kela Minister" : "Member"}
Fine per kela: PKR ${ratePerKela}
Room code: ${roomCode}

Join here: ${roomUrl}

What is Kela Tracker? It's a fun app where friends vote when someone "eats kela" (gets offended). Earn badges, pay fines, and catch your friends being sensitive!
`;

  try {
    await transport.sendMail({
      from: fromEmail,
      to: [to],
      subject: `🍌 You've been invited to "${roomName}" on Kela Tracker!`,
      html,
      text,
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Failed to send email" };
  }
}

function escapeHtml(s: string): string {
  return (s || "").replace(/[&<>"']/g, (c) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c;
  });
}
