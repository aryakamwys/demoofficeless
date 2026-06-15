import { NextResponse } from "next/server";

export async function GET() {
  try {
    const username = process.env.SERVICEDESK_USERNAME;
    const password = process.env.SERVICEDESK_PASSWORD;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Credentials not configured in environment variables" },
        { status: 500 }
      );
    }

    // Buat Basic Auth header
    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

    const response = await fetch("https://servicedesk.perkom.co.id/api/v1/", {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json",
      },
      // cache: "no-store", // uncomment jika ingin data selalu real-time
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Service Desk API error: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Service Desk API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch data" },
      { status: 500 }
    );
  }
}
