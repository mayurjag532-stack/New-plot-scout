import assert from "node:assert/strict";
import { verifyLocation } from "../src/utils/locationGate";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`PASS - ${name}`); }
  catch (e) { console.error(`FAIL - ${name}`); console.error(e); process.exitCode = 1; }
}

// TEST 1 — THE REAL FAILURE. Search scope Pune/Maharashtra, source claims Namakkal/Tamil Nadu.
test("NAMAKKAL REGRESSION: search=Pune/Maharashtra, source=Namakkal/Tamil Nadu -> LOCATION_CONFLICT", () => {
  const r = verifyLocation({
    searchScope: { state: "Maharashtra", district: "Pune" },
    sourceLocation: { state: "Tamil Nadu", district: "Namakkal" },
    sourceEvidenceIds: ["ev1"]
  });
  assert.equal(r.status, "LOCATION_CONFLICT");
  assert.equal(r.conflictLevel, "HARD");
  assert.ok(r.reasonCodes.includes("TARGET_STATE_MISMATCH"));
});

// TEST 2 — scope and source agree at state+district, but source proves no more than that.
test("scope=Pune/Maharashtra, source=Pune/Maharashtra (district only) -> not VERIFIED, not a conflict", () => {
  const r = verifyLocation({
    searchScope: { state: "Maharashtra", district: "Pune" },
    sourceLocation: { state: "Maharashtra", district: "Pune" },
    sourceEvidenceIds: ["ev1"]
  });
  assert.notEqual(r.status, "LOCATION_CONFLICT");
  assert.notEqual(r.status, "VERIFIED");
  assert.equal(r.status, "UNVERIFIED");
});

// TEST 3 — source only says the state; search scope must never fill in the rest.
test("scope=Pune/Maharashtra, source=Maharashtra only -> UNVERIFIED, district not silently filled", () => {
  const r = verifyLocation({
    searchScope: { state: "Maharashtra", district: "Pune" },
    sourceLocation: { state: "Maharashtra" },
    sourceEvidenceIds: ["ev1"]
  });
  assert.equal(r.status, "UNVERIFIED");
  assert.ok(r.missingHierarchy.includes("district"));
});

// TEST 4 — same village name, different state: state hierarchy must block the false match.
test("duplicate village name across states -> state mismatch blocks it", () => {
  const r = verifyLocation({
    searchScope: { state: "Karnataka" },
    sourceLocation: { state: "Tamil Nadu", district: "Salem", taluka: "X", village: "Ramapuram" },
    sourceEvidenceIds: ["ev1"]
  });
  assert.equal(r.status, "LOCATION_CONFLICT");
});

// TEST 5 — minor taluka spelling difference vs a trusted resolved location: review, not hard rejection.
test("taluka spelling difference vs trusted resolved location -> NEEDS_REVIEW, not LOCATION_CONFLICT", () => {
  const r = verifyLocation({
    sourceLocation: { state: "Maharashtra", district: "Pune", taluka: "Mulshee", village: "Kasar Amboli" },
    trustedResolvedLocation: { state: "Maharashtra", district: "Pune", taluka: "Mulshi", evidenceId: "geo1" },
    sourceEvidenceIds: ["ev1"]
  });
  assert.equal(r.status, "NEEDS_REVIEW");
  assert.equal(r.conflictLevel, "SOFT");
  assert.ok(r.reasonCodes.includes("TALUKA_REVIEW"));
});

// TEST 6 — source text state disagrees with trusted coordinates' resolved state.
test("source state vs trusted-coordinate-resolved state disagree -> LOCATION_CONFLICT", () => {
  const r = verifyLocation({
    sourceLocation: { state: "Maharashtra", district: "Pune" },
    trustedResolvedLocation: { state: "Tamil Nadu", district: "Namakkal", lat: 11.22, lon: 78.16, evidenceId: "geo1" },
    sourceEvidenceIds: ["ev1"]
  });
  assert.equal(r.status, "LOCATION_CONFLICT");
  assert.ok(r.reasonCodes.includes("STATE_CONFLICT"));
});

// TEST 7 — no source location evidence at all.
test("no source location evidence -> UNVERIFIED", () => {
  const r = verifyLocation({ sourceLocation: {}, sourceEvidenceIds: [] });
  assert.equal(r.status, "UNVERIFIED");
  assert.ok(r.reasonCodes.includes("INSUFFICIENT_SOURCE_LOCATION"));
  assert.equal(r.verifiedHierarchy.length, 0);
});

// Positive control — full hierarchy, no conflicts, should actually be able to reach VERIFIED.
test("full consistent hierarchy with no conflicts -> VERIFIED", () => {
  const r = verifyLocation({
    searchScope: { state: "Maharashtra", district: "Pune" },
    sourceLocation: { state: "Maharashtra", district: "Pune", taluka: "Haveli", village: "Phursungi" },
    sourceEvidenceIds: ["ev1"]
  });
  assert.equal(r.status, "VERIFIED");
  assert.equal(r.conflictLevel, "NONE");
});

console.log(`\n${passed}/8 tests passed.`);
if (process.exitCode) { console.error("LOCATION GATE TESTS: FAIL"); } else { console.log("LOCATION GATE TESTS: PASS"); }
