const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const username = process.env.SERVICEDESK_USERNAME;
const password = process.env.SERVICEDESK_PASSWORD;
const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

async function test() {
  const catRes = await fetch("https://servicedesk.perkom.co.id/api/v1/categories?ids[]=66", {
    headers: { "Authorization": authHeader, "Accept": "application/json" }
  });
  console.log("Categories status:", catRes.status);
  const catJson = await catRes.json();
  console.log("Categories response:", JSON.stringify(catJson, null, 2));

  const groupRes = await fetch("https://servicedesk.perkom.co.id/api/v1/groups?ids[]=140", {
    headers: { "Authorization": authHeader, "Accept": "application/json" }
  });
  console.log("Groups status:", groupRes.status);
  const groupJson = await groupRes.json();
  console.log("Groups response:", JSON.stringify(groupJson, null, 2));
}

test();
