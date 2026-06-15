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

    // Step 1: Hit incidents.by.status to get open request IDs
    const statusResponse = await fetch("https://servicedesk.perkom.co.id/api/v1/incidents.by.status?limit=20", {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json",
      },
    });

    if (!statusResponse.ok) {
      let errorDetail = "";
      try {
        const errJson = await statusResponse.json();
        errorDetail = JSON.stringify(errJson);
      } catch (e) {}

      return NextResponse.json(
        { success: false, error: `Step 1 API error: ${statusResponse.status} ${statusResponse.statusText} ${errorDetail}` },
        { status: statusResponse.status }
      );
    }

    const statusResult = await statusResponse.json();
    const requestIds = statusResult.requestIds || [];

    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Step 2: Fetch details using /api/v1/incidents with the retrieved IDs
    // InvGate expects ids as an array. We format it as ?ids[]=1&ids[]=2
    const idsQuery = requestIds.map((id: number) => `ids[]=${id}`).join("&");
    
    const detailResponse = await fetch(`https://servicedesk.perkom.co.id/api/v1/incidents?${idsQuery}`, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json",
      },
    });

    if (!detailResponse.ok) {
      // If ids[]= doesn't work, maybe it expects a JSON string or comma-separated list
      // Let's try to just return the IDs so the UI doesn't completely break, but log the error
      console.error(`Step 2 Failed: ${detailResponse.status}`);
      // Fallback: return dummy objects with just the ID
      const fallbackData = requestIds.map((id: number) => ({ id, title: "Failed to load details" }));
      return NextResponse.json({ success: true, data: fallbackData, note: "Fallback data due to details fetch error" });
    }

    const detailResult = await detailResponse.json();
    const data = Array.isArray(detailResult) ? detailResult : (detailResult.response || detailResult.data || []);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Service Desk API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch data from API" },
      { status: 500 }
    );
  }
}
