const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const username = process.env.SERVICEDESK_USERNAME;
const password = process.env.SERVICEDESK_PASSWORD;
const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

async function test() {
  const res = await fetch("https://servicedesk.perkom.co.id/api/v1/incidents?ids[]=32409", {
    headers: { "Authorization": authHeader, "Accept": "application/json" }
  });
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}

test();
