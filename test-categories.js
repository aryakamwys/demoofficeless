const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const username = process.env.SERVICEDESK_USERNAME;
const password = process.env.SERVICEDESK_PASSWORD;
const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

async function test() {
  const res = await fetch("https://servicedesk.perkom.co.id/api/v1/categories?ids[]=83", {
    headers: { "Authorization": authHeader, "Accept": "application/json" }
  });
  console.log("Categories status:", res.status);
  
  const res2 = await fetch("https://servicedesk.perkom.co.id/api/v1/catalog?ids[]=83", {
    headers: { "Authorization": authHeader, "Accept": "application/json" }
  });
  console.log("Catalog status:", res2.status);
}

test();
