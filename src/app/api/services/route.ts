import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fromDateStr = searchParams.get("from");
    const toDateStr = searchParams.get("to");

    const username = process.env.SERVICEDESK_USERNAME;
    const password = process.env.SERVICEDESK_PASSWORD;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Credentials not configured in environment variables. Please set SERVICEDESK_USERNAME and SERVICEDESK_PASSWORD." },
        { status: 500 }
      );
    }

    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

    // Step 1: Hit incidents.by.status with multiple status IDs to get history (including closed)
    const statusQuery = [1, 2, 3, 4, 5, 6].map(id => `status_ids[]=${id}`).join("&");
    
    // Hit first to get total
    let statusResponse = await fetch(`https://servicedesk.perkom.co.id/api/v1/incidents.by.status?${statusQuery}&limit=1`, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json",
      },
    });

    if (!statusResponse.ok) {
      return NextResponse.json(
        { success: false, error: `Step 1 API error: ${statusResponse.status} ${statusResponse.statusText}` },
        { status: statusResponse.status }
      );
    }

    const initialStatusResult = await statusResponse.json();
    const total = initialStatusResult.total || 0;
    
    // We want the newest items. Let's fetch more if there's a date filter to ensure we get them.
    const fetchLimit = (fromDateStr || toDateStr) ? 200 : 50; 
    let offset = 0;
    if (total > fetchLimit) {
      offset = total - fetchLimit;
    }

    // Now fetch the actual last items
    statusResponse = await fetch(`https://servicedesk.perkom.co.id/api/v1/incidents.by.status?${statusQuery}&limit=${fetchLimit}&offset=${offset}`, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json",
      },
    });

    const statusResult = await statusResponse.json();
    let requestIds = statusResult.requestIds || (statusResult.response && statusResult.response.requestIds) || [];

    // Jika requestIds kosong, kembalikan array kosong
    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
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
    
    let rawData = detailResult.response || detailResult.data || detailResult;
    let data: any[] = [];
    
    // InvGate often returns a dictionary of objects with the request ID as the key, like {"1": { id: 1, ... }}
    if (Array.isArray(rawData)) {
      data = rawData;
    } else if (typeof rawData === 'object' && rawData !== null) {
      data = Object.values(rawData);
    }

    // Sort descending so the newest tickets are on top
    if (data.length > 0) {
      data.sort((a, b) => b.id - a.id);
      try {
        require("fs").writeFileSync("test_incident.json", JSON.stringify(data[0], null, 2));
      } catch(e){}
    }

    // Clean up debug details if it's still somehow empty
    if (!Array.isArray(data) || data.length === 0) {
      data = [{
        id: "DEBUG-DETAIL",
        title: `RAW Detail: ${JSON.stringify(detailResult).substring(0, 200)}`,
        status_id: "N/A"
      }];
    } else {
      // Filter by date if provided
      if (fromDateStr || toDateStr) {
        data = data.filter(item => {
          if (!item.created_at) return true;
          // item.created_at is typically a timestamp
          let d = new Date(item.created_at);
          if (/^\d+$/.test(item.created_at.toString())) {
             const num = parseInt(item.created_at);
             d = new Date(num > 9999999999 ? num : num * 1000);
          }
          if (isNaN(d.getTime())) return true;
          
          let valid = true;
          if (fromDateStr) {
            const from = new Date(fromDateStr);
            from.setHours(0, 0, 0, 0);
            if (d < from) valid = false;
          }
          if (toDateStr) {
            const to = new Date(toDateStr);
            to.setHours(23, 59, 59, 999);
            if (d > to) valid = false;
          }
          return valid;
        });
      }
    }

    // Step 3: Fetch User Details for Assigned Agents
    const assignedIds = [...new Set(data.map(d => d.assigned_id).filter(id => id != null))];
    if (assignedIds.length > 0) {
      try {
        const usersQuery = assignedIds.map(id => `ids[]=${id}`).join("&");
        const usersResponse = await fetch(`https://servicedesk.perkom.co.id/api/v1/users?${usersQuery}`, {
          method: "GET",
          headers: {
            "Authorization": authHeader,
            "Accept": "application/json",
          },
        });
        
        if (usersResponse.ok) {
          const usersResult = await usersResponse.json();
          const usersData = usersResult.response || usersResult.data || usersResult;
          
          let usersMap: Record<string, any> = {};
          if (Array.isArray(usersData)) {
            usersData.forEach(u => { if (u && u.id) usersMap[u.id] = u; });
          } else if (typeof usersData === 'object' && usersData !== null) {
            usersMap = usersData;
          }
          
          // Map back to data
          data = data.map(item => {
            if (item.assigned_id && usersMap[item.assigned_id]) {
              item.assigned_user = usersMap[item.assigned_id];
            }
            return item;
          });
        } else {
          console.error("Failed to fetch users:", usersResponse.status);
        }
      } catch (e) {
        console.error("Error fetching users:", e);
      }
    }

    // Step 4: Fetch Categories (Now using /api/v1/categories since access is granted)
    const categoryIds = [...new Set(data.map(d => d.category_id).filter(id => id != null))];
    if (categoryIds.length > 0) {
      try {
        const catQuery = categoryIds.map(id => `ids[]=${id}`).join("&");
        const catResponse = await fetch(`https://servicedesk.perkom.co.id/api/v1/categories?${catQuery}`, {
          method: "GET",
          headers: { "Authorization": authHeader, "Accept": "application/json" },
        });
        if (catResponse.ok) {
          const catResult = await catResponse.json();
          const catData = catResult.response || catResult.data || catResult;
          let catMap: Record<string, any> = {};
          if (Array.isArray(catData)) {
            catData.forEach(c => { if (c && c.id) catMap[c.id] = c; });
          } else if (typeof catData === 'object' && catData !== null) {
            catMap = catData;
          }
          data = data.map(item => {
            if (item.category_id && catMap[item.category_id]) {
              item.category_details = catMap[item.category_id];
            }
            return item;
          });
        }
      } catch (e) {
        console.error("Error fetching categories:", e);
      }
    }

    // Step 5: Fetch Groups & Helpdesks for assigned_group_id mapping
    const groupIds = [...new Set(data.map(d => d.assigned_group_id).filter(id => id != null))];
    if (groupIds.length > 0) {
      try {
        let groupMap: Record<string, any> = {};
        
        // 5a. Fetch from Groups
        const groupQuery = groupIds.map(id => `ids[]=${id}`).join("&");
        const groupResponse = await fetch(`https://servicedesk.perkom.co.id/api/v1/groups?${groupQuery}`, {
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

        // 5b. Fetch from Helpdesks (since assigned_group_id often references Helpdesks in InvGate)
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

        data = data.map(item => {
          if (item.assigned_group_id && groupMap[item.assigned_group_id]) {
            item.assigned_group_details = groupMap[item.assigned_group_id];
          }
          return item;
        });
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
