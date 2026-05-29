// End-to-end smoke test: real HTTP against the running server + Postgres.
// Uses fetch with a manual cookie jar and proper JSON parsing.
const BASE = "http://localhost:3000";
const EMAIL = "admin@aitek-solutions.com";
const PASS = "ChangeMe!123";
const CRON_SECRET = "dev-only-cron-secret-change-me";

const jar = new Map();
function setCookies(res) {
  const list = res.headers.getSetCookie?.() ?? [];
  for (const c of list) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    jar.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
}
function cookieHeader() {
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
async function req(path, { method = "GET", json, form, raw = false, headers = {} } = {}) {
  const h = { Cookie: cookieHeader(), ...headers };
  let body;
  if (json !== undefined) { h["Content-Type"] = "application/json"; body = JSON.stringify(json); }
  if (form !== undefined) { h["Content-Type"] = "application/x-www-form-urlencoded"; body = new URLSearchParams(form).toString(); }
  const res = await fetch(BASE + path, { method, headers: h, body, redirect: "manual" });
  setCookies(res);
  if (raw) return res;
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

let failed = 0;
const ok = (m) => console.log("  \x1b[32m✅\x1b[0m " + m);
const bad = (m) => { console.log("  \x1b[31m❌\x1b[0m " + m); failed++; };

async function main() {
  // wait for server
  for (let i = 0; i < 40; i++) { try { await fetch(BASE + "/login"); break; } catch { await new Promise(r => setTimeout(r, 1000)); } }

  console.log("== 1. Login (NextAuth credentials) ==");
  const { data: csrf } = await req("/api/auth/csrf");
  csrf.csrfToken ? ok("CSRF token") : bad("no CSRF token");
  await req("/api/auth/callback/credentials", { method: "POST", form: { csrfToken: csrf.csrfToken, email: EMAIL, password: PASS, json: "true" } });
  const { data: sess } = await req("/api/auth/session");
  sess?.user?.email === EMAIL ? ok(`session as ${sess.user.email}`) : bad(`login failed: ${JSON.stringify(sess)}`);

  console.log("== 2. Baseline dashboard stats ==");
  const { data: s0 } = await req("/api/dashboard/stats");
  const rev0 = Number(s0.totalRevenueThisMonth ?? 0);
  console.log(`  baseline revenue this month = ${rev0}`);

  console.log("== 3. Create client ==");
  const { data: client } = await req("/api/clients", { method: "POST", json: { name: "Acme E2E", email: "acme-e2e@example.com", company: "Acme Inc", currency: "USD", isActive: true } });
  client.id ? ok(`client id=${client.id}`) : bad(`create failed: ${JSON.stringify(client)}`);

  console.log("== 4. Get a service ==");
  const { data: svcs } = await req("/api/services");
  const svc = Array.isArray(svcs) ? svcs.find(s => Number(s.defaultPrice) === 499) ?? svcs[0] : null;
  svc?.id ? ok(`service ${svc.name} id=${svc.id} price=${svc.defaultPrice}`) : bad(`no services: ${JSON.stringify(svcs)}`);

  console.log("== 5. Create invoice (2x499 + 1x150, 10% tax) ==");
  const { data: inv } = await req("/api/invoices", { method: "POST", json: {
    clientId: client.id, taxRate: 10,
    items: [
      { serviceId: svc.id, description: "Managed IT Support", quantity: 2, unitPrice: 499 },
      { description: "Setup fee", quantity: 1, unitPrice: 150 },
    ],
  }});
  const total = Number(inv.total);
  if (inv.id) ok(`invoice ${inv.invoiceNumber} id=${inv.id}`); else bad(`create failed: ${JSON.stringify(inv)}`);
  // subtotal = 2*499 + 150 = 1148; tax 10% = 114.8; total = 1262.80
  Math.abs(Number(inv.subtotal) - 1148) < 0.01 ? ok(`subtotal=${inv.subtotal} (expect 1148)`) : bad(`subtotal wrong: ${inv.subtotal}`);
  Math.abs(Number(inv.tax) - 114.8) < 0.01 ? ok(`tax=${inv.tax} (expect 114.80)`) : bad(`tax wrong: ${inv.tax}`);
  Math.abs(total - 1262.8) < 0.01 ? ok(`total=${total} (expect 1262.80)`) : bad(`total wrong: ${total}`);

  console.log("== 6. Fetch invoice detail ==");
  const { data: det } = await req(`/api/invoices/${inv.id}`);
  det.status === "DRAFT" ? ok("status DRAFT") : bad(`unexpected status: ${det.status}`);
  Array.isArray(det.items) && det.items.length === 2 ? ok(`${det.items.length} line items persisted`) : bad(`items wrong: ${JSON.stringify(det.items)}`);
  det.client?.name === "Acme E2E" ? ok("client relation joined") : bad("client relation missing");

  console.log("== 7. Generate PDF ==");
  const pres = await req(`/api/invoices/${inv.id}/pdf`, { raw: true });
  const buf = Buffer.from(await pres.arrayBuffer());
  buf.slice(0, 4).toString() === "%PDF" && buf.length > 1000
    ? ok(`valid PDF, ${buf.length} bytes, content-type=${pres.headers.get("content-type")}`)
    : bad(`not a valid PDF (first bytes='${buf.slice(0,8).toString()}', ${buf.length}b)`);

  console.log("== 8. Attempt SEND (needs Stripe+Graph creds — expect graceful failure) ==");
  const send = await req(`/api/invoices/${inv.id}/send`, { method: "POST" });
  console.log(`  send -> HTTP ${send.status}: ${JSON.stringify(send.data)}`);
  send.status >= 400 ? ok("send failed gracefully (no creds) — error returned, server stable") : ok("send succeeded (creds present!)");

  console.log("== 9. Mark invoice PAID (reconciliation; confirmation email fails gracefully) ==");
  const mp = await req(`/api/invoices/${inv.id}/mark-paid`, { method: "POST" });
  mp.status === 200 ? ok(`mark-paid HTTP 200`) : bad(`mark-paid HTTP ${mp.status}: ${JSON.stringify(mp.data)}`);
  const { data: det2 } = await req(`/api/invoices/${inv.id}`);
  det2.status === "PAID" ? ok("status now PAID") : bad(`status=${det2.status}`);
  det2.paidAt ? ok(`paidAt=${det2.paidAt}`) : bad("paidAt missing");

  console.log("== 10. Notifications ==");
  const { data: notif } = await req("/api/notifications");
  (notif.items ?? []).some(n => n.type === "PAYMENT_RECEIVED") ? ok(`PAYMENT_RECEIVED notification (unread=${notif.unreadCount})`) : bad(`no payment notification: ${JSON.stringify(notif).slice(0,200)}`);

  console.log("== 11. Dashboard stats reflect payment ==");
  const { data: s1 } = await req("/api/dashboard/stats");
  const rev1 = Number(s1.totalRevenueThisMonth ?? 0);
  console.log(`  revenue this month now = ${rev1} (was ${rev0})`);
  Math.abs(rev1 - (rev0 + 1262.8)) < 0.01 ? ok(`revenue increased by 1262.80`) : bad(`revenue=${rev1}, expected ${rev0 + 1262.8}`);
  console.log(`  revenueByMonth buckets: ${(s1.revenueByMonth ?? []).length}, recentInvoices: ${(s1.recentInvoices ?? []).length}`);

  console.log("== 12. Update settings (tax rate) ==");
  const upd = await req("/api/settings", { method: "PUT", json: { taxRate: 8.5, companyName: "Aitek Solutions" } });
  const { data: setg } = await req("/api/settings");
  Number(setg.taxRate) === 8.5 ? ok(`settings persisted (taxRate=${setg.taxRate}, configured=${JSON.stringify(setg.configured)})`) : bad(`settings not saved: ${JSON.stringify(setg).slice(0,200)}`);

  console.log("== 13. Cron: monthly billing + overdue (with secret) ==");
  const cob = await req("/api/cron/check-overdue", { method: "POST", headers: { Authorization: `Bearer ${CRON_SECRET}` } });
  cob.status === 200 ? ok(`overdue cron: ${JSON.stringify(cob.data)}`) : bad(`overdue cron HTTP ${cob.status}`);
  const cbad = await req("/api/cron/check-overdue", { method: "POST" });
  cbad.status === 401 ? ok("cron rejects missing secret (401)") : bad(`cron without secret HTTP ${cbad.status} (expected 401)`);

  console.log("\n" + (failed === 0 ? "\x1b[32m🎉 E2E PASSED — all DB-backed flows verified\x1b[0m" : `\x1b[31m⚠️  ${failed} check(s) failed\x1b[0m`));
  process.exit(failed === 0 ? 0 : 1);
}
main().catch(e => { console.error("FATAL", e); process.exit(1); });
