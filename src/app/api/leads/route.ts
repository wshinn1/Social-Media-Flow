import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { addSubscriberToMoosend } from "@/lib/moosend";

const ZAPIER_SECRET = process.env.ZAPIER_SECRET;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("x-zapier-secret");
    if (ZAPIER_SECRET && authHeader !== ZAPIER_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const first_name = body.first_name ?? "";
    const last_name = body.last_name ?? "";
    const email = body.email ?? "";
    const phone = body.phone ?? "";
    const appointment_date = body.appointment_date ?? "";
    const budget = body.budget ?? "";
    const fb_leadgen_id = body.leadgen_id ?? null;
    const fb_page_id = body.page_id ?? null;

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const { error: dbError } = await getSupabaseAdmin().from("leads").insert({
      first_name,
      last_name,
      email,
      phone,
      appointment_date,
      budget,
      fb_leadgen_id,
      fb_page_id,
    });

    if (dbError) {
      console.error("Supabase insert error:", dbError.message);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    const moosendResult = await addSubscriberToMoosend({
      email,
      firstName: first_name,
      lastName: last_name,
      phone,
      budget,
      appointmentDate: appointment_date,
    });

    if (!moosendResult.success) {
      console.error("Moosend sync error:", moosendResult.error);
    }

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (err) {
    console.error("Lead create error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
