import { NextRequest, NextResponse } from "next/server";

const PAGE_ID = "1636980056352348";
const APP_ID = process.env.NEXT_PUBLIC_FB_APP_ID ?? "273009613898456";
const APP_SECRET = process.env.FB_APP_SECRET;

export async function POST(req: NextRequest) {
  try {
    const { user_token } = await req.json();

    if (!user_token) {
      return NextResponse.json({ error: "user_token is required" }, { status: 400 });
    }

    if (!APP_SECRET) {
      return NextResponse.json({ error: "FB_APP_SECRET env var not set" }, { status: 500 });
    }

    // Step 1: Exchange short-lived user token for long-lived user token
    const exchangeRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${user_token}`
    );
    const exchangeData = await exchangeRes.json();

    if (exchangeData.error) {
      return NextResponse.json({ step: "token_exchange", error: exchangeData.error }, { status: 400 });
    }

    const longLivedToken = exchangeData.access_token;

    // Step 2: Get Page Access Token
    const pageTokenRes = await fetch(
      `https://graph.facebook.com/v19.0/${PAGE_ID}?fields=access_token&access_token=${longLivedToken}`
    );
    const pageTokenData = await pageTokenRes.json();

    const tokenToUse = pageTokenData.access_token ?? longLivedToken;

    // Step 3: Subscribe page to app webhook for leadgen
    const subscribeRes = await fetch(
      `https://graph.facebook.com/v19.0/${PAGE_ID}/subscribed_apps`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `subscribed_fields=leadgen&access_token=${tokenToUse}`,
      }
    );
    const subscribeData = await subscribeRes.json();

    if (subscribeData.error) {
      return NextResponse.json({ step: "subscribe", error: subscribeData.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      long_lived_token_expires: exchangeData.expires_in,
      subscribed: subscribeData,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
