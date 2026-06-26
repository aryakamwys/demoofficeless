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
      const hdResponse = await fetch(`https://servicedesk.perkom.co.id/api/v1/helpdesks`, {
        method: "GET",
        headers: { "Authorization": authHeader, "Accept": "application/json" },
      });
      if (hdResponse.ok) {
        const hdResult = await hdResponse.json();
        const hdData = hdResult.response || hdResult.data || hdResult;
        
        let hdMap: Record<string, any> = {};
        if (Array.isArray(hdData)) {
          hdData.forEach(h => { if (h && h.id) hdMap[h.id] = h; });
        } else if (typeof hdData === 'object' && hdData !== null) {
          hdMap = hdData;
        }

        // Helper to get full path
        const getFullPath = (id: string | number): string => {
          let current = hdMap[id];
          if (!current) return `Category > ${id}`;
          let path = current.name;
          while (current.parent_id && hdMap[current.parent_id]) {
            current = hdMap[current.parent_id];
            path = `${current.name} > ${path}`;
          }
          return path;
        };

        if (hdMap[data.category_id]) {
          data.category_details = {
            ...hdMap[data.category_id],
            full_name: getFullPath(data.category_id)
          };
        }
        if (hdMap[data.assigned_group_id]) {
          data.assigned_group_details = hdMap[data.assigned_group_id];
        }
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
