import { NextResponse } from "next/server";

const PAGE_ID = "1636980056352348";
const PAGE_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

export async function GET() {
  if (!PAGE_TOKEN) {
    return NextResponse.json({ status: "missing" });
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${PAGE_ID}?fields=id,name&access_token=${PAGE_TOKEN}`
    );
    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ status: "expired" });
    }

    return NextResponse.json({ status: "valid" });
  } catch {
    return NextResponse.json({ status: "unknown" });
  }
}
