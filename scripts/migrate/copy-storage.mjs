#!/usr/bin/env node
// Copy semua objek bucket dataperkom dari Supabase cloud ke self-host.
// Env: CLOUD_URL, CLOUD_SERVICE_KEY, TARGET_URL, TARGET_SERVICE_KEY
const BUCKET = "dataperkom";

const env = (k) => {
  if (!process.env[k]) throw new Error(`Env ${k} wajib diset`);
  return process.env[k];
};

const cloud = { base: env("CLOUD_URL"), key: env("CLOUD_SERVICE_KEY") };
const target = { base: env("TARGET_URL"), key: env("TARGET_SERVICE_KEY") };

async function listPrefix(prefix = "") {
  const res = await fetch(`${cloud.base}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: { apikey: cloud.key, Authorization: `Bearer ${cloud.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit: 100, offset: 0, sortBy: { column: "name", order: "asc" } }),
  });
  if (!res.ok) throw new Error(`list gagal (${res.status}): ${await res.text()}`);
  return res.json();
}

async function walk(prefix, files) {
  for (const item of await listPrefix(prefix)) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) await walk(path, files); // folder
    else files.push(path);
  }
}

async function main() {
  const files = [];
  await walk("", files);
  console.log(`Ditemukan ${files.length} objek`);
  let ok = 0, fail = 0;
  for (const path of files) {
    const dl = await fetch(`${cloud.base}/storage/v1/object/${BUCKET}/${path}`, {
      headers: { apikey: cloud.key, Authorization: `Bearer ${cloud.key}` },
    });
    if (!dl.ok) { console.error(`DOWNLOAD GAGAL ${path}: ${dl.status}`); fail++; continue; }
    const buf = Buffer.from(await dl.arrayBuffer());
    const up = await fetch(`${target.base}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: {
        apikey: target.key, Authorization: `Bearer ${target.key}`,
        "Content-Type": "application/octet-stream", "x-upsert": "true",
      },
      body: buf,
    });
    if (up.ok) { ok++; } else { console.error(`UPLOAD GAGAL ${path}: ${up.status} ${await up.text()}`); fail++; }
  }
  console.log(`Selesai: ${ok} sukses, ${fail} gagal`);
  if (fail > 0) process.exit(1);
}

main();
