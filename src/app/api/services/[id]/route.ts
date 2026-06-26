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

    // Step 4: Build combined Helpdesks + Levels map (same as list endpoint)
    try {
      let combinedMap: Record<number, any> = {};

      const hdResponse = await fetch(`https://servicedesk.perkom.co.id/api/v1/helpdesks`, {
        method: "GET",
        headers: { "Authorization": authHeader, "Accept": "application/json" },
      });
      if (hdResponse.ok) {
        const hdResult = await hdResponse.json();
        const hdData = hdResult.response || hdResult.data || hdResult;
        if (Array.isArray(hdData)) {
          hdData.forEach(h => { if (h && h.id) combinedMap[h.id] = h; });
        }
      }

      const lvlResponse = await fetch(`https://servicedesk.perkom.co.id/api/v1/levels`, {
        method: "GET",
        headers: { "Authorization": authHeader, "Accept": "application/json" },
      });
      if (lvlResponse.ok) {
        const lvlResult = await lvlResponse.json();
        const lvlData = lvlResult.response || lvlResult.data || lvlResult;
        if (Array.isArray(lvlData)) {
          lvlData.forEach(l => { if (l && l.id && !combinedMap[l.id]) combinedMap[l.id] = l; });
        }
      }

      const resolveName = (id: number): string => {
        const item = combinedMap[id];
        if (!item) return "";
        if (item.name) return item.name;
        if (item.parent_id) {
          const parent = combinedMap[Number(item.parent_id)];
          if (parent && parent.name) return parent.name;
        }
        return "";
      };

      if (data.category_id) {
        const name = resolveName(data.category_id);
        if (name) data.category_details = { id: data.category_id, name };
      }
      if (data.assigned_group_id) {
        const name = resolveName(data.assigned_group_id);
        if (name) data.assigned_group_details = { id: data.assigned_group_id, name };
      }
    } catch (e) {
      console.error("Error fetching helpdesks/levels:", e);
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
