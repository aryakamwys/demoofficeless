// Self-check pure logic envgate.ts: node test-envgate-lib.ts
import assert from "node:assert/strict";
import { mapUser, resolveEntityName, cached } from "./src/lib/envgate.ts";

// mapUser: variasi field nama InvGate
assert.deepEqual(mapUser({ id: 7, first_name: "Budi", last_name: "Santoso" })!.name, "Budi Santoso");
assert.deepEqual(mapUser({ id: 7, name: "Rina", lastname: "Wati" })!.first_name, "Rina");
assert.deepEqual(mapUser({ id: 7, name: "Rina", lastname: "Wati" })!.last_name, "Wati");
assert.equal(mapUser(null), null);
assert.equal(mapUser({ id: 7 })!.name, "");

// resolveEntityName: helpdesk langsung, level naik ke parent
const map = {
  83: { id: 83, name: "Network" },
  66: { id: 66, parent_id: "83" }, // level tanpa name
};
assert.equal(resolveEntityName(map, 83), "Network");
assert.equal(resolveEntityName(map, 66), "Network");
assert.equal(resolveEntityName(map, 999), "");

// cached: tanpa env Upstash harus pass-through ke fn
let calls = 0;
const out = await cached("test:key", 60, async () => {
  calls++;
  return { ok: true };
});
assert.deepEqual(out, { ok: true });
assert.equal(calls, 1);

console.log("test-envgate-lib: all pass");
