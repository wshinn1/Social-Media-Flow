import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fetchFacebookLead } from "@/lib/facebook";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authError } = await getSupabaseAdmin().auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { data: lead, error: leadError } = await getSupabaseAdmin()
    .from("leads")
    .select("fb_leadgen_id")
    .eq("id", id)
    .single();

  if (leadError || !lead?.fb_leadgen_id) {
    return NextResponse.json({ error: "Lead has no Facebook ID" }, { status: 404 });
  }

  const fbData = await fetchFacebookLead(lead.fb_leadgen_id);
  if (!fbData) {
    return NextResponse.json({ error: "Failed to fetch from Facebook" }, { status: 500 });
  }

  const { error: updateError } = await getSupabaseAdmin()
    .from("leads")
    .update({
      first_name: fbData.first_name,
      last_name: fbData.last_name,
      email: fbData.email || undefined,
      phone: fbData.phone || undefined,
      appointment_date: fbData.appointment_date || undefined,
      budget: fbData.budget || undefined,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", data: fbData });
}
