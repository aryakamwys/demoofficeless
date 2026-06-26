const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const username = process.env.SERVICEDESK_USERNAME;
const password = process.env.SERVICEDESK_PASSWORD;
const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

async function test() {
  const endpoints = [
    "categories",
    "categories.tree",
    "catalog",
    "catalogs",
    "helpdesks?limit=2000",
    "groups?limit=2000"
  ];
  
  for (const ep of endpoints) {
    const res = await fetch(`https://servicedesk.perkom.co.id/api/v1/${ep}`, {
      headers: { "Authorization": authHeader, "Accept": "application/json" }
    });
    console.log(`${ep} status:`, res.status);
    if (res.status === 200) {
      const json = await res.json();
      const arr = json.response || json.data || json;
      console.log(`${ep} length:`, Array.isArray(arr) ? arr.length : 'Not Array');
    }
  }
}

test();
