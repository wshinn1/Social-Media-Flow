import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { addSubscriberToMoosend } from "@/lib/moosend";

export async function POST(req: NextRequest) {
  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { data: lead, error } = await getSupabaseAdmin()
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (!lead.email) {
    return NextResponse.json({ error: "Lead has no email" }, { status: 400 });
  }

  const result = await addSubscriberToMoosend({
    email: lead.email,
    firstName: lead.first_name ?? "",
    lastName: lead.last_name ?? "",
    phone: lead.phone ?? "",
    budget: lead.budget ?? "",
    appointmentDate: lead.appointment_date ?? "",
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
