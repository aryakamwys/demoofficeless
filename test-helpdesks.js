const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const username = process.env.SERVICEDESK_USERNAME;
const password = process.env.SERVICEDESK_PASSWORD;
const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

async function test() {
  const res = await fetch("https://servicedesk.perkom.co.id/api/v1/helpdesks?ids[]=140", {
    headers: { "Authorization": authHeader, "Accept": "application/json" }
  });
  console.log("Helpdesks status:", res.status);
  const json = await res.json();
  console.log("Helpdesks response:", JSON.stringify(json, null, 2));
}

test();
