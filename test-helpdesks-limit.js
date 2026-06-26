const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const username = process.env.SERVICEDESK_USERNAME;
const password = process.env.SERVICEDESK_PASSWORD;
const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

async function test() {
  const res = await fetch("https://servicedesk.perkom.co.id/api/v1/helpdesks?limit=1000", {
    headers: { "Authorization": authHeader, "Accept": "application/json" }
  });
  const json = await res.json();
  const arr = json.response || json.data || json;
  console.log("Helpdesks count with limit=1000:", arr.length);
  const map = {};
  arr.forEach(h => map[h.id] = h);
  console.log("Has 140?", !!map[140]);
  console.log("Has 66?", !!map[66]);
}

test();
