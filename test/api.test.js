import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import app from "../src/index.js";
import { randomPhone, postAuth, makeAdmin } from "../test-support/auth.js";

let server;
let base;
let adminCookie = "";

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;

  // Every data endpoint now requires a session — bootstrap one admin and
  // reuse its cookie across the read-only (GET) tests below.
  const password = "WarRoom2027!";
  const phone = randomPhone();
  await postAuth(base, "/sign-up/email", {
    email: `${phone}@phone.invalid`,
    username: phone,
    password,
    name: "Test Admin",
  });
  await makeAdmin(phone);
  adminCookie = (await postAuth(base, "/sign-in/username", { username: phone, password })).cookie;
});

after(() => server.close());

const get = (p, cookie = adminCookie) =>
  fetch(`${base}${p}`, {
    headers: cookie ? { cookie } : {},
  }).then(async (r) => ({ status: r.status, body: await r.json() }));

test("health endpoint responds outside /api", async () => {
  const r = await get("/health");
  assert.equal(r.status, 200);
  assert.equal(r.body.status, "ok");
});

test("baseline returns county roll-up + 5 sub-counties", async () => {
  const r = await get("/api/baseline");
  assert.equal(r.status, 200);
  assert.equal(r.body.county.registered, 398981);
  assert.equal(r.body.subCounties.length, 5);
  assert.equal(r.body.county.siyoi, 102488);
  assert.ok(r.body.scenarios.target.siyoi27 > r.body.county.siyoi);
});

test("turnout map covers all wards with stations", async () => {
  const r = await get("/api/baseline/turnout");
  assert.equal(r.status, 200);
  assert.equal(r.body.count, 757);
  assert.equal(r.body.turnout.length, 25);
});

test("projections return per-ward 2027 targets across scenarios", async () => {
  const r = await get("/api/baseline/projections");
  assert.equal(r.status, 200);
  assert.equal(r.body.wardProjections.length, 25);
  assert.ok(r.body.scenarios.conservative.siyoi27 > 0);
  assert.ok(r.body.byCategory.stronghold.wardCount > 0);
});

test("wards matrix lists all 25 wards with categories", async () => {
  const r = await get("/api/wards");
  assert.equal(r.status, 200);
  assert.equal(r.body.wards.length, 25);
  const cats = new Set(r.body.wards.map((w) => w.category));
  assert.ok(cats.has("stronghold"));
  assert.ok(cats.has("swing"));
});

test("wards matrix filters by constituency & category", async () => {
  const k = await get("/api/wards?constituency=KIMININI");
  const kiminini = k.body.wards;
  assert.equal(kiminini.length, 6);
  assert.ok(kiminini.every((w) => w.constituency === "KIMININI"));

  const flips = await get("/api/wards?category=marginal");
  assert.ok(flips.body.wards.length >= 1);
});

test("advanced search returns centres, wards, sub-counties & candidates", async () => {
  const c = await get("/api/search?q=Makutano");
  assert.equal(c.status, 200);
  assert.ok(c.body.centres.length > 0);
  assert.ok(c.body.wards.length > 0);

  const w = await get("/api/search?q=Kwanza");
  assert.equal(w.status, 200);
  assert.ok(w.body.subCounties.length > 0);

  const cand = await get("/api/search?q=Lillian");
  assert.equal(cand.status, 200);
  const lcs = cand.body.candidates.find((x) => x.key === "lcs");
  assert.ok(lcs);
  assert.ok(lcs.performance2022.votes >= 100000);
  // every centre hit carries performance + status + 2027 target fields
  const centre = c.body.centres[0];
  assert.ok(centre.performance2022.siyoi >= 0);
  assert.ok(centre.status);
  assert.ok(typeof centre.performance2022.siyoiShare === "number");
  // every centre carries the per-centre content ledger (SQLite-backed)
  assert.ok(Array.isArray(centre.content.keyAchievements));
  assert.equal(typeof centre.content.campaignMessage, "string");
});

test("centres content: get + staff patch + reflected in search", async () => {
  const password = "WarRoom2027!";
  const phone = randomPhone();
  await postAuth(base, "/sign-up/email", {
    email: `${phone}@phone.invalid`,
    username: phone,
    password,
    name: "Ops Admin",
  });
  await makeAdmin(phone);
  const si = await postAuth(base, "/sign-in/username", { username: phone, password });

  const list = await get("/api/centres");
  assert.equal(list.status, 200);
  assert.ok(list.body.centres.length > 0);
  const target = list.body.centres[0];
  const id = target.id;

  const before = await get(`/api/centres/${id}`);
  assert.equal(before.status, 200);
  assert.ok(Array.isArray(before.body.centre.keyAchievements));

  const achievements = ["Water borehole delivered", "Market shade constructed"];
  const message = "Siyoi akina mama — tunaweza pamoja!";
  const r = await fetch(`${base}/api/centres/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: si.cookie },
    body: JSON.stringify({ keyAchievements: achievements, campaignMessage: message }),
  });
  assert.equal(r.status, 200);
  const patched = await r.json();
  assert.deepEqual(patched.centre.keyAchievements, achievements);
  assert.equal(patched.centre.campaignMessage, message);

  // persisted to DB (fresh read of the detail endpoint)
  const after = await get(`/api/centres/${id}`);
  assert.deepEqual(after.body.centre.keyAchievements, achievements);
  assert.equal(after.body.centre.campaignMessage, message);

  // search results pick it up immediately (mirrored into the live store)
  const s = await get(`/api/search?q=${encodeURIComponent(target.name.split(" ")[0])}`);
  assert.equal(s.status, 200);
  const hit = s.body.centres.find((c) => c.id === id || c.name === target.name);
  assert.ok(hit, "patched centre appears in search");
  if (hit) {
    assert.deepEqual(hit.content.keyAchievements, achievements);
    assert.equal(hit.content.campaignMessage, message);
  }

  // Clean up: restore the original content so tests never pollute the DB.
  await fetch(`${base}/api/centres/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: si.cookie },
    body: JSON.stringify({
      keyAchievements: before.body.centre.keyAchievements,
      campaignMessage: before.body.centre.campaignMessage,
    }),
  });
});

test("centres content rejects non-staff writers", async () => {
  const password = "WarRoom2027!";
  const phone = randomPhone();
  await postAuth(base, "/sign-up/email", {
    email: `${phone}@phone.invalid`,
    username: phone,
    password,
    name: "Field Agent",
  });
  const si = await postAuth(base, "/sign-in/username", { username: phone, password });

  const list = await get("/api/centres");
  const id = list.body.centres[0].id;
  const r = await fetch(`${base}/api/centres/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: si.cookie },
    body: JSON.stringify({ campaignMessage: "hacked" }),
  });
  assert.equal(r.status, 403);
});

test("ward detail joins stations + category tactics", async () => {
  const r = await get("/api/wards/matisi-ward");
  assert.equal(r.status, 200);
  assert.equal(r.body.category, "swing");
  assert.ok(r.body.stationCount > 0);
  assert.ok(r.body.stations.length > 0);
  assert.ok(r.body.projection.target2027 > 0);
  // ward detail now carries polling centres (the primary unit) + status fields
  assert.ok(r.body.centres.length > 0);
  const first = r.body.centres[0];
  assert.ok(first.name);
  assert.equal(typeof first.registered, "number");
  assert.ok(["Stronghold", "Marginal", "Opposition"].includes(first.status));
  assert.equal(typeof first.turnout2022Pct, "number");
  assert.equal(typeof first.siyoiShare, "number");
});

test("achievements engine returns 25 ward speech packs + county programs", async () => {
  const r = await get("/api/achievements");
  assert.equal(r.status, 200);
  assert.equal(r.body.wards.length, 25);
  assert.ok(r.body.county.headlinePrograms.length >= 5);
});

test("speech pack for a single ward composes opening/closing", async () => {
  const r = await get("/api/achievements/speech/sikhendu-ward");
  assert.equal(r.status, 200);
  assert.equal(r.body.category, "oppositionBastion");
  assert.ok(r.body.opening.includes("Sikhendu"));
  assert.ok(r.body.oppositionNarratives.length > 0);
});

test("roadmap has 6 phases, countdown and key dates", async () => {
  const r = await get("/api/roadmap");
  assert.equal(r.status, 200);
  assert.equal(r.body.phases.length, 6);
  assert.ok(r.body.countdown.daysRemaining >= 0);
  assert.ok(r.body.keyDates.length >= 10);
});

test("grassroots network sizes agent & mobilizer needs", async () => {
  const r = await get("/api/field");
  assert.equal(r.status, 200);
  assert.equal(r.body.wards.length, 25);
  assert.equal(r.body.totals.stations, 757);
  assert.ok(r.body.totals.agentsNeeded > r.body.totals.stations * 2);
  assert.ok(r.body.protocols.chain.length >= 5);
});

test("stations index searches by name", async () => {
  const r = await get("/api/field/stations?q=pri");
  assert.equal(r.status, 200);
  assert.ok(r.body.stations.length > 0);
});

test("readiness patch updates in-memory store (admin session required)", async () => {
  const password = "WarRoom2027!";
  const phone = randomPhone();
  await postAuth(base, "/sign-up/email", {
    email: `${phone}@phone.invalid`,
    username: phone,
    password,
    name: "Ops Admin",
  });
  await makeAdmin(phone);
  const si = await postAuth(base, "/sign-in/username", { username: phone, password });
  const r = await fetch(`${base}/api/field/readiness/matisi-ward`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: si.cookie },
    body: JSON.stringify({ gotvBriefed: 50 }),
  });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.readiness.gotvBriefed, 50);
});

test("outreach segments cover the 4 core blocs", async () => {
  const r = await get("/api/outreach");
  assert.equal(r.status, 200);
  const ids = r.body.segments.map((s) => s.id);
  ["mamaMboga", "bodaBoda", "farmers", "marketVendors"].forEach((id) => assert.ok(ids.includes(id)));
});

test("budget calculator sums line items", async () => {
  const counts = encodeURIComponent(JSON.stringify({ communityBaraza: 2, marketBlitz: 3 }));
  const r = await get(`/api/outreach/budget?counts=${counts}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 2 * 30000 + 3 * 12000);
  assert.equal(r.body.lines.length, 2);
});

test("budget calculator supports per-ward scaling", async () => {
  const counts = encodeURIComponent(JSON.stringify({ communityBaraza: 1 }));
  const r = await get(`/api/outreach/budget?counts=${counts}&perWard=true`);
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 30000 * 25);
});

test("strategy assumptions are reviewable", async () => {
  const r = await get("/api/strategy/assumptions");
  assert.equal(r.status, 200);
  assert.ok(r.body.assumptions.turnout.baseWard > 0);
  assert.ok(r.body.categories.swing);
});

test("unknown routes return 404 json", async () => {
  const r = await get("/api/nope");
  assert.equal(r.status, 404);
  assert.ok(r.body.error);
});