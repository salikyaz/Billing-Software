// E2E for the forgot/reset password flow + brand asset checks.
import fs from "fs";

const BASE = "http://localhost:3000";
const EMAIL = "admin@aitek-solutions.com";
const NEW_PASS = "NewPass!2026";
const LOG = process.argv[2]; // path to dev server output file

let failed = 0;
const ok = (m) => console.log("  \x1b[32m✅\x1b[0m " + m);
const bad = (m) => { console.log("  \x1b[31m❌\x1b[0m " + m); failed++; };

async function getJson(path, opts) {
  const r = await fetch(BASE + path, opts);
  const t = await r.text();
  let d; try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, data: d };
}

async function main() {
  // wait for dev server to compile/serve
  for (let i = 0; i < 60; i++) { try { const r = await fetch(BASE + "/login"); if (r.ok) break; } catch {} await new Promise(r => setTimeout(r, 1000)); }

  console.log("== Brand assets ==");
  for (const [p, type] of [["/logo.png", "image/png"], ["/logo-mark.png", "image/png"]]) {
    const r = await fetch(BASE + p);
    r.ok && (r.headers.get("content-type") || "").includes("image")
      ? ok(`${p} served (${r.headers.get("content-type")})`) : bad(`${p} -> ${r.status}`);
  }
  for (const p of ["/forgot-password", "/reset-password"]) {
    const r = await fetch(BASE + p);
    r.status === 200 ? ok(`${p} renders (200)`) : bad(`${p} -> ${r.status}`);
  }

  console.log("== 1. Forgot password (request link) ==");
  const fp = await getJson("/api/auth/forgot-password", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL }),
  });
  fp.status === 200 && fp.data.ok ? ok(`forgot-password ok (no enumeration): "${fp.data.message}"`) : bad(`forgot-password: ${JSON.stringify(fp)}`);

  // unknown email behaves identically
  const fp2 = await getJson("/api/auth/forgot-password", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nobody@nowhere.test" }),
  });
  fp2.status === 200 && fp2.data.ok ? ok("unknown email returns same 200 (no user enumeration)") : bad(`unknown email differs: ${JSON.stringify(fp2)}`);

  console.log("== 2. Extract reset token from dev server log ==");
  await new Promise(r => setTimeout(r, 800));
  const logText = fs.readFileSync(LOG, "utf8");
  const matches = [...logText.matchAll(/reset-password\?token=([a-f0-9]{64})/g)];
  const token = matches.length ? matches[matches.length - 1][1] : null;
  token ? ok(`captured reset token (${token.slice(0, 12)}…)`) : bad("no reset token found in server log");
  if (!token) { console.log(failed ? "\x1b[31mFAILED\x1b[0m" : ""); process.exit(1); }

  console.log("== 3. Reset with invalid token rejected ==");
  const badReset = await getJson("/api/auth/reset-password", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "0".repeat(64), password: NEW_PASS }),
  });
  badReset.status === 400 ? ok(`invalid token rejected (400): "${badReset.data.error}"`) : bad(`invalid token not rejected: ${JSON.stringify(badReset)}`);

  console.log("== 4. Reset with valid token ==");
  const reset = await getJson("/api/auth/reset-password", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password: NEW_PASS }),
  });
  reset.status === 200 && reset.data.ok ? ok("password reset succeeded") : bad(`reset failed: ${JSON.stringify(reset)}`);

  console.log("== 5. Token is single-use (reuse rejected) ==");
  const reuse = await getJson("/api/auth/reset-password", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password: NEW_PASS }),
  });
  reuse.status === 400 ? ok("reused token rejected (400)") : bad(`token reuse not blocked: ${JSON.stringify(reuse)}`);

  console.log("== 6. Login with NEW password works ==");
  const jar = new Map();
  const sc = r => { for (const c of (r.headers.getSetCookie?.() ?? [])) { const p = c.split(";")[0]; const i = p.indexOf("="); jar.set(p.slice(0, i), p.slice(i + 1)); } };
  const ch = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  let r = await fetch(BASE + "/api/auth/csrf"); sc(r); const csrf = (await r.json()).csrfToken;
  r = await fetch(BASE + "/api/auth/callback/credentials", { method: "POST", headers: { Cookie: ch(), "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: csrf, email: EMAIL, password: NEW_PASS, json: "true" }).toString(), redirect: "manual" }); sc(r);
  r = await fetch(BASE + "/api/auth/session", { headers: { Cookie: ch() } });
  const sess = await r.json();
  sess?.user?.email === EMAIL ? ok(`logged in with new password as ${sess.user.email}`) : bad(`login with new password failed: ${JSON.stringify(sess)}`);

  console.log("\n" + (failed === 0 ? "\x1b[32m🎉 PASSWORD RESET E2E PASSED\x1b[0m" : `\x1b[31m⚠️  ${failed} failed\x1b[0m`));
  process.exit(failed === 0 ? 0 : 1);
}
main().catch(e => { console.error("FATAL", e); process.exit(1); });
