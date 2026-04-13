import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface LeadNotificationData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  appointmentDate: string;
  budget: string;
  leadgenId: string;
}

export async function sendLeadNotification(lead: LeadNotificationData) {
  const to = process.env.RESEND_NOTIFY_TO;
  const from = process.env.RESEND_FROM;

  if (!to || !from || !process.env.RESEND_API_KEY) {
    console.warn("Resend not configured — skipping email notification");
    return { success: false, error: "Resend not configured" };
  }

  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unknown";

  try {
    const { error } = await resend.emails.send({
      from,
      to,
      subject: `New Lead: ${name}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:8px;">
          <h2 style="margin:0 0 16px;color:#111827;">New Lead Received</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#6b7280;width:140px;">Name</td><td style="padding:8px 0;font-weight:600;color:#111827;">${name}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Email</td><td style="padding:8px 0;color:#111827;">${lead.email || "—"}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Phone</td><td style="padding:8px 0;color:#111827;">${lead.phone || "—"}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Appt Date</td><td style="padding:8px 0;color:#111827;">${lead.appointmentDate || "—"}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Budget</td><td style="padding:8px 0;color:#111827;">${lead.budget || "—"}</td></tr>
          </table>
          <div style="margin-top:24px;">
            <a href="https://lead-flow-admin-omega.vercel.app/admin" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600;">View Dashboard</a>
          </div>
          <p style="margin-top:24px;font-size:12px;color:#9ca3af;">Lead ID: ${lead.leadgenId}</p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error };
    }

    return { success: true };
  } catch (err) {
    console.error("Resend exception:", err);
    return { success: false, error: err };
  }
}
