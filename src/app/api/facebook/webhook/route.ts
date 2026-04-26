import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { addSubscriberToMoosend } from "@/lib/moosend";
import { sendLeadNotification } from "@/lib/resend";
import { fetchFacebookLead } from "@/lib/facebook";

const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN!;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === FB_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.object !== "page") {
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "leadgen") continue;

        const leadgenId = change.value?.leadgen_id;
        const pageId = change.value?.page_id;

        if (!leadgenId || !pageId) continue;

        const leadData = await fetchFacebookLead(leadgenId);
        if (!leadData) continue;

        const { error: dbError } = await getSupabaseAdmin().from("leads").insert({
          first_name: leadData.first_name,
          last_name: leadData.last_name,
          email: leadData.email,
          phone: leadData.phone,
          appointment_date: leadData.appointment_date,
          budget: leadData.budget,
          fb_leadgen_id: leadgenId,
          fb_page_id: pageId,
        });

        if (dbError) {
          console.error("Supabase insert error:", dbError.message);
        }

        if (!leadData.email) {
          console.error("Skipping Moosend sync — lead has no email", leadgenId);
          continue;
        }

        const moosendResult = await addSubscriberToMoosend({
          email: leadData.email,
          firstName: leadData.first_name,
          lastName: leadData.last_name,
          phone: leadData.phone,
          budget: leadData.budget,
          appointmentDate: leadData.appointment_date,
        });

        if (!moosendResult.success) {
          console.error("Moosend sync error:", moosendResult.error);
        }

        const notifyResult = await sendLeadNotification({
          firstName: leadData.first_name,
          lastName: leadData.last_name,
          email: leadData.email,
          phone: leadData.phone,
          appointmentDate: leadData.appointment_date,
          budget: leadData.budget,
          leadgenId: leadgenId,
        });

        if (!notifyResult.success) {
          console.error("Resend notification error:", notifyResult.error);
        }
      }
    }

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

