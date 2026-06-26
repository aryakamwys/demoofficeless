const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const username = process.env.SERVICEDESK_USERNAME;
const password = process.env.SERVICEDESK_PASSWORD;
const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

async function test() {
  const res = await fetch("https://servicedesk.perkom.co.id/api/v2/categories", {
    headers: { "Authorization": authHeader, "Accept": "application/json" }
  });
  console.log("v2 categories status:", res.status);
  
  const res2 = await fetch("https://servicedesk.perkom.co.id/api/v2/helpdesks", {
    headers: { "Authorization": authHeader, "Accept": "application/json" }
  });
  console.log("v2 helpdesks status:", res2.status);
}

test();
