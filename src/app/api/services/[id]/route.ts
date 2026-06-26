import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const username = process.env.SERVICEDESK_USERNAME;
    const password = process.env.SERVICEDESK_PASSWORD;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Credentials not configured" },
        { status: 500 }
      );
    }

    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

    const detailResponse = await fetch(`https://servicedesk.perkom.co.id/api/v1/incidents?ids[]=${id}`, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json",
      },
    });

    if (!detailResponse.ok) {
      return NextResponse.json(
        { success: false, error: "Ticket not found or error fetching details" },
        { status: detailResponse.status }
      );
    }

    const detailResult = await detailResponse.json();
    let rawData = detailResult.response || detailResult.data || detailResult;
    let data: any = null;
    
    if (Array.isArray(rawData) && rawData.length > 0) {
      data = rawData[0];
    } else if (typeof rawData === 'object' && rawData !== null && rawData[id]) {
      data = rawData[id];
    } else if (typeof rawData === 'object' && rawData !== null) {
      // Maybe it just returned the object
      data = Object.values(rawData)[0];
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: "Ticket not found" },
        { status: 404 }
      );
    }

    // Fetch Category Name if present
    if (data.category_id) {
      const catResponse = await fetch(`https://servicedesk.perkom.co.id/api/v1/categories?ids[]=${data.category_id}`, {
        method: "GET",
        headers: { "Authorization": authHeader, "Accept": "application/json" },
      });
      if (catResponse.ok) {
        const catResult = await catResponse.json();
        const catData = catResult.response || catResult.data || catResult;
        let c = Array.isArray(catData) ? catData[0] : (catData[data.category_id] || Object.values(catData)[0]);
        if (c) data.category_details = c;
      }
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
