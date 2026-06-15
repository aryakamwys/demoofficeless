import { NextResponse } from "next/server";

export async function GET() {
  try {
    const username = process.env.SERVICEDESK_USERNAME;
    const password = process.env.SERVICEDESK_PASSWORD;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Credentials not configured in environment variables. Please set SERVICEDESK_USERNAME and SERVICEDESK_PASSWORD." },
        { status: 500 }
      );
    }

    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

    // Hit incidents endpoint to get the list of requests
    const response = await fetch("https://servicedesk.perkom.co.id/api/v1/incidents", {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Service Desk API error: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    
    // The API might return an array directly or inside a property. We try to be flexible.
    const data = Array.isArray(result) ? result : (result.response || result.data || []);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Service Desk API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch data from API" },
      { status: 500 }
    );
  }
}
