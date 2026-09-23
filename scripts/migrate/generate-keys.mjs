#!/usr/bin/env node
// Generate anon & service_role key JWT (HS256) untuk self-host Supabase.
// Pakai: node scripts/migrate/generate-keys.mjs <jwt-secret>
import { createHmac } from "node:crypto";

const secret = process.argv[2];
if (!secret) {
  console.error("Pakai: node scripts/migrate/generate-keys.mjs <jwt-secret>");
  process.exit(1);
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function sign(payload) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

const claims = { iss: "supabase", iat: 1609459200, exp: 1893456000 };
console.log("ANON_KEY=" + sign({ ...claims, role: "anon" }));
console.log("SERVICE_ROLE_KEY=" + sign({ ...claims, role: "service_role" }));
