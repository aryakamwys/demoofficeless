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

    // Step 4: Fetch Categories (Now using /api/v1/categories)
    if (data.category_id) {
      try {
        const catResponse = await fetch(`https://servicedesk.perkom.co.id/api/v1/categories?ids[]=${data.category_id}`, {
          method: "GET",
          headers: { "Authorization": authHeader, "Accept": "application/json" },
        });
        if (catResponse.ok) {
          const catResult = await catResponse.json();
          const catData = catResult.response || catResult.data || catResult;
          if (Array.isArray(catData) && catData.length > 0) {
            data.category_details = catData[0];
          } else if (typeof catData === 'object' && catData[data.category_id]) {
            data.category_details = catData[data.category_id];
          }
        }
      } catch (e) {
        console.error("Error fetching category details:", e);
      }
    }

    // Step 5: Fetch Groups & Helpdesks for assigned_group_id mapping
    if (data.assigned_group_id) {
      try {
        let groupMap: Record<string, any> = {};
        
        // 5a. Fetch from Groups
        const groupResponse = await fetch(`https://servicedesk.perkom.co.id/api/v1/groups?ids[]=${data.assigned_group_id}`, {
          method: "GET",
          headers: { "Authorization": authHeader, "Accept": "application/json" },
        });
        if (groupResponse.ok) {
          const groupResult = await groupResponse.json();
          const groupData = groupResult.response || groupResult.data || groupResult;
          if (Array.isArray(groupData)) {
            groupData.forEach(g => { if (g && g.id) groupMap[g.id] = g; });
          } else if (typeof groupData === 'object' && groupData !== null) {
            Object.assign(groupMap, groupData);
          }
        }

        // 5b. Fetch from Helpdesks if not in Groups
        if (!groupMap[data.assigned_group_id]) {
          const hdResponse = await fetch(`https://servicedesk.perkom.co.id/api/v1/helpdesks`, {
            method: "GET",
            headers: { "Authorization": authHeader, "Accept": "application/json" },
          });
          if (hdResponse.ok) {
            const hdResult = await hdResponse.json();
            const hdData = hdResult.response || hdResult.data || hdResult;
            if (Array.isArray(hdData)) {
              hdData.forEach(h => { if (h && h.id && !groupMap[h.id]) groupMap[h.id] = h; });
            } else if (typeof hdData === 'object' && hdData !== null) {
              Object.keys(hdData).forEach(k => { if (!groupMap[k]) groupMap[k] = hdData[k]; });
            }
          }
        }

        if (groupMap[data.assigned_group_id]) {
          data.assigned_group_details = groupMap[data.assigned_group_id];
        }
      } catch (e) {
        console.error("Error fetching assigned groups:", e);
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
