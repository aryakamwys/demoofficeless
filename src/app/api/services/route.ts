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

    // Step 1: Hit incidents.by.status to get just the 1 latest open request ID to keep it lightweight
    // Added status_id=1 because the API requires either status_id or status_ids
    const statusResponse = await fetch("https://servicedesk.perkom.co.id/api/v1/incidents.by.status?status_id=1&limit=1", {
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
    const requestIds = statusResult.requestIds || (statusResult.response && statusResult.response.requestIds) || [];

    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      // Jika requestIds kosong, kita kembalikan raw data ke frontend agar bisa di-debug
      return NextResponse.json({ 
        success: true, 
        data: [{ 
          id: "DEBUG-EMPTY", 
          title: `RAW Response: ${JSON.stringify(statusResult).substring(0, 200)}`,
          status_id: "N/A"
        }] 
      });
    }

    // Step 2: Fetch details using /api/v1/incidents with the retrieved ID(s)
    const idsQuery = requestIds.map((id: number) => `ids[]=${id}`).join("&");
    
    const detailResponse = await fetch(`https://servicedesk.perkom.co.id/api/v1/incidents?${idsQuery}`, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json",
      },
    });

    if (!detailResponse.ok) {
      console.error(`Step 2 Failed: ${detailResponse.status}`);
      // Fallback: return dummy objects with just the ID if detail fetching fails
      const fallbackData = requestIds.map((id: number) => ({ id, title: "Failed to load details" }));
      return NextResponse.json({ success: true, data: fallbackData, note: "Fallback data due to details fetch error" });
    }

    const detailResult = await detailResponse.json();
    let data = Array.isArray(detailResult) ? detailResult : (detailResult.response || detailResult.data || []);

    if (!Array.isArray(data) || data.length === 0) {
      data = [{
        id: "DEBUG-DETAIL",
        title: `RAW Detail: ${JSON.stringify(detailResult).substring(0, 200)}`,
        status_id: "N/A"
      }];
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Service Desk API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch data from API" },
      { status: 500 }
    );
  }
}
