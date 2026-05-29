// E2E for the email-2FA admin login flow. Pass the dev-server output file as argv[2].
import fs from "fs";

const BASE = "http://localhost:3000";
const EMAIL = "admin@aitek-solutions.com";
const PASS = "ChangeMe!123";
const LOG = process.argv[2];

let failed = 0;
const ok = (m) => console.log("  \x1b[32m✅\x1b[0m " + m);
const bad = (m) => { console.log("  \x1b[31m❌\x1b[0m " + m); failed++; };

function jar() {
  const m = new Map();
  return {
    set: (r) => { for (const c of (r.headers.getSetCookie?.() ?? [])) { const p = c.split(";")[0]; const i = p.indexOf("="); m.set(p.slice(0, i), p.slice(i + 1)); } },
    hdr: () => [...m].map(([k, v]) => `${k}=${v}`).join("; "),
  };
}
async function jsonReq(path, opts = {}) {
  const r = await fetch(BASE + path, opts);
  const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, data: d, res: r };
}
// Perform NextAuth credentials sign-in; returns the resulting session object.
async function signIn({ email, password, code }) {
  const j = jar();
  let r = await fetch(BASE + "/api/auth/csrf"); j.set(r);
  const csrf = (await r.json()).csrfToken;
  const body = new URLSearchParams({ csrfToken: csrf, email, password, json: "true" });
  if (code !== undefined) body.set("code", code);
  r = await fetch(BASE + "/api/auth/callback/credentials", {
    method: "POST", headers: { Cookie: j.hdr(), "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(), redirect: "manual",
  }); j.set(r);
  r = await fetch(BASE + "/api/auth/session", { headers: { Cookie: j.hdr() } });
  return { session: await r.json(), jarObj: j };
}
async function adminSession() {
  const { session, jarObj } = await signIn({ email: EMAIL, password: PASS });
  if (session?.user?.email !== EMAIL) throw new Error("admin login failed");
  return jarObj;
}
function lastCodeFromLog() {
  const txt = fs.readFileSync(LOG, "utf8");
  const m = [...txt.matchAll(/\[2fa\] login code for .*?: (\d{6})/g)];
  return m.length ? m[m.length - 1][1] : null;
}

async function main() {
  for (let i = 0; i < 60; i++) { try { const r = await fetch(BASE + "/login"); if (r.ok) break; } catch {} await new Promise(r => setTimeout(r, 1000)); }

  console.log("== Security headers ==");
  const hr = await fetch(BASE + "/login");
  for (const h of ["x-frame-options", "x-content-type-options", "content-security-policy", "referrer-policy"]) {
    hr.headers.get(h) ? ok(`${h}: ${hr.headers.get(h).slice(0, 48)}`) : bad(`missing header ${h}`);
  }
  (await fetch(BASE + "/login")).headers.get("x-powered-by") ? bad("x-powered-by present") : ok("x-powered-by hidden");

  console.log("== 0. Baseline login (2FA off) works ==");
  let s = (await signIn({ email: EMAIL, password: PASS })).session;
  s?.user?.email === EMAIL ? ok("logged in without 2FA") : bad(`baseline login failed: ${JSON.stringify(s)}`);

  console.log("== 1. Enable 2FA via settings ==");
  const aj = await adminSession();
  const put = await jsonReq("/api/settings", { method: "PUT", headers: { Cookie: aj.hdr(), "Content-Type": "application/json" }, body: JSON.stringify({ twoFactorEnabled: true }) });
  put.status === 200 && put.data.twoFactorEnabled === true ? ok("2FA enabled") : bad(`enable failed: ${JSON.stringify(put.data).slice(0,150)}`);

  console.log("== 2. Confirm settings GET never leaks secrets ==");
  const sg = await jsonReq("/api/settings", { headers: { Cookie: aj.hdr() } });
  (!("stripeSecretKey" in sg.data) && !("msClientSecret" in sg.data)) ? ok("no secret fields in settings response") : bad("secret field present in settings response");

  console.log("== 3. Login with 2FA on but NO code must FAIL (bypass check) ==");
  const noCode = (await signIn({ email: EMAIL, password: PASS })).session;
  (!noCode || !noCode.user) ? ok("login blocked without code (cannot bypass 2FA)") : bad("BYPASS: logged in without 2FA code!");

  console.log("== 4. Request a code ==");
  const reqCode = await jsonReq("/api/auth/2fa/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASS }) });
  reqCode.status === 200 && reqCode.data.twoFactorRequired === true ? ok("2fa/request says code required") : bad(`2fa/request: ${JSON.stringify(reqCode.data)}`);
  const wrongPw = await jsonReq("/api/auth/2fa/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: "wrong" }) });
  wrongPw.status === 401 ? ok("2fa/request rejects wrong password (401)") : bad(`wrong-pw status ${wrongPw.status}`);

  await new Promise(r => setTimeout(r, 600));
  const code = lastCodeFromLog();
  code ? ok(`captured code from server log (${code})`) : bad("no 2FA code in log");
  if (!code) { console.log("\x1b[31mFAILED\x1b[0m"); await disable(aj); process.exit(1); }

  console.log("== 5. Wrong code rejected ==");
  const wrongCode = (await signIn({ email: EMAIL, password: PASS, code: "000000" })).session;
  (!wrongCode || !wrongCode.user) ? ok("wrong code rejected") : bad("wrong code accepted!");

  console.log("== 6. Correct code logs in ==");
  // request a fresh code (the wrong-code attempt didn't consume it, but be safe)
  const c2 = code;
  const good = (await signIn({ email: EMAIL, password: PASS, code: c2 })).session;
  good?.user?.email === EMAIL ? ok(`logged in with 2FA code as ${good.user.email}`) : bad(`2FA login failed: ${JSON.stringify(good)}`);

  console.log("== 7. Code is single-use (reuse rejected) ==");
  const reuse = (await signIn({ email: EMAIL, password: PASS, code: c2 })).session;
  (!reuse || !reuse.user) ? ok("used code cannot be reused") : bad("code reuse accepted!");

  await disable(aj);
  console.log("\n" + (failed === 0 ? "\x1b[32m🎉 2FA + SECURITY E2E PASSED\x1b[0m" : `\x1b[31m⚠️  ${failed} failed\x1b[0m`));
  process.exit(failed === 0 ? 0 : 1);
}

async function disable(aj) {
  // turn 2FA back off so normal login keeps working in the dev env
  await jsonReq("/api/settings", { method: "PUT", headers: { Cookie: aj.hdr(), "Content-Type": "application/json" }, body: JSON.stringify({ twoFactorEnabled: false }) });
  console.log("  (cleanup) 2FA disabled again");
}
main().catch(e => { console.error("FATAL", e); process.exit(1); });
