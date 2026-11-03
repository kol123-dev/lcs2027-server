/**
 * Better Auth integration tests: phone + password sign-up/sign-in,
 * session identity (/api/me) and RBAC on the readiness PATCH.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import app from "../src/index.js";
import { randomPhone, postAuth, makeAdmin } from "../test-support/auth.js";

let server;
let base;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const PASSWORD = "WarRoom2027!";

async function signUpAgent(phone) {
  const r = await postAuth(base, "/sign-up/email", {
    email: `${phone}@phone.invalid`,
    username: phone,
    password: PASSWORD,
    name: "Field Agent Test",
  });
  return r;
}

async function signIn(phone) {
  return postAuth(base, "/sign-in/username", { username: phone, password: PASSWORD });
}

test("sign-up creates an agent account keyed on the mobile number", async () => {
  const phone = randomPhone();
  const r = await signUpAgent(phone);
  assert.equal(r.status, 200);
  assert.equal(r.body.user.username, phone);
  assert.equal(r.body.user.role, "agent");
  assert.ok(r.cookie.includes("siyoi2027."), "session cookie uses the siyoi2027 prefix");
});

test("sign-up rejects an invalid Kenyan mobile number", async () => {
  const r = await postAuth(base, "/sign-up/email", {
    email: "bogus@phone.invalid",
    username: "2549" + "12345678", // 2549XXX is not a valid Safaricom/Airtel line
    password: PASSWORD,
    name: "Bad Number",
  });
  assert.equal(r.status, 400); // Better Auth rejects invalid usernames with 400
});

test("sign-in with mobile + password issues a session", async () => {
  const phone = randomPhone();
  await signUpAgent(phone);
  const r = await signIn(phone);
  assert.equal(r.status, 200);
  assert.equal(r.body.user.username, phone);
  assert.ok(r.cookie.includes("siyoi2027.session_token"));
});

test("sign-in rejects a wrong password", async () => {
  const phone = randomPhone();
  await signUpAgent(phone);
  const r = await postAuth(base, "/sign-in/username", { username: phone, password: "WrongPass123!" });
  assert.equal(r.status, 401);
});

test("GET /api/me returns the signed-in user identity", async () => {
  const phone = randomPhone();
  const name = "Agent Achieng";
  const su = await postAuth(base, "/sign-up/email", {
    email: `${phone}@phone.invalid`,
    username: phone,
    password: PASSWORD,
    name,
  });
  const si = await signIn(phone);
  const me = await fetch(`${base}/api/me`, { headers: { cookie: si.cookie } });
  assert.equal(me.status, 200);
  const body = await me.json();
  assert.equal(body.user.name, name);
  assert.equal(body.user.phone, phone);
  assert.equal(body.user.role, "agent");
  assert.match(body.user.phoneDisplay, /^\+254 /);
});

test("GET /api/me without a session is rejected 401", async () => {
  const r = await fetch(`${base}/api/me`);
  assert.equal(r.status, 401);
});

test("readiness PATCH: anonymous 401, agent 403, admin 200", async () => {
  const phone = randomPhone();
  await signUpAgent(phone);
  const patch = (cookie) =>
    fetch(`${base}/api/field/readiness/matisi-ward`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({ gotvBriefed: 55 }),
    });

  const anon = await patch();
  assert.equal(anon.status, 401);

  const agentSi = await signIn(phone);
  const forbidden = await patch(agentSi.cookie);
  assert.equal(forbidden.status, 403);

  await makeAdmin(phone);

  // Session tokens carry the role snapshot from issue time — escalate, then
  // sign in again to pick up the admin role (mirrors real-world rotation).
  const adminSi = await signIn(phone);
  const ok = await patch(adminSi.cookie);
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.readiness.gotvBriefed, 55);
});