import { NextResponse } from "next/server";

const APP_ID = process.env.NEXT_PUBLIC_FB_APP_ID ?? "1255136706706699";
const APP_SECRET = process.env.FB_APP_SECRET;
const PAGE_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

export async function GET() {
  if (!PAGE_TOKEN) {
    return NextResponse.json({ status: "missing" });
  }

  if (!APP_SECRET) {
    return NextResponse.json({ status: "unknown" });
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${PAGE_TOKEN}&access_token=${APP_ID}|${APP_SECRET}`
    );
    const data = await res.json();

    if (data.error || !data.data?.is_valid) {
      return NextResponse.json({ status: "expired" });
    }

    const expiresAt = data.data.expires_at;
    if (expiresAt === 0) {
      return NextResponse.json({ status: "valid", expires: null });
    }

    const expiresDate = new Date(expiresAt * 1000);
    const daysLeft = Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    return NextResponse.json({
      status: daysLeft <= 7 ? "expiring_soon" : "valid",
      expires: expiresDate.toISOString(),
      daysLeft,
    });
  } catch {
    return NextResponse.json({ status: "unknown" });
  }
}
