#!/usr/bin/env bash
# End-to-end smoke test against a live server + Postgres.
# Exercises auth, clients, invoices, PDF, payment reconciliation, notifications, cron.
set -u
BASE="http://localhost:3000"
JAR="$(mktemp)"
EMAIL="admin@aitek-solutions.com"
PASS="ChangeMe!123"
CRON_SECRET="dev-only-cron-secret-change-me"
pass() { echo "  ✅ $1"; }
fail() { echo "  ❌ $1"; FAILED=1; }
FAILED=0

echo "== Waiting for server =="
for i in $(seq 1 40); do curl -s -o /dev/null "$BASE/login" && break; sleep 1; done

echo "== 1. Login (NextAuth credentials) =="
CSRF=$(curl -s -c "$JAR" -b "$JAR" "$BASE/api/auth/csrf" | sed -E 's/.*"csrfToken":"([^"]+)".*/\1/')
[ -n "$CSRF" ] && pass "got CSRF token" || fail "no CSRF token"
curl -s -c "$JAR" -b "$JAR" -o /dev/null \
  -d "csrfToken=$CSRF" -d "email=$EMAIL" -d "password=$PASS" -d "json=true" \
  "$BASE/api/auth/callback/credentials"
SESSION=$(curl -s -b "$JAR" "$BASE/api/auth/session")
echo "$SESSION" | grep -q "$EMAIL" && pass "authenticated session: $SESSION" || fail "login failed: $SESSION"

echo "== 2. Baseline dashboard stats =="
STATS0=$(curl -s -b "$JAR" "$BASE/api/dashboard/stats")
REV0=$(echo "$STATS0" | sed -E 's/.*"totalRevenueThisMonth":([0-9.]+).*/\1/')
echo "  baseline revenue this month = $REV0"

echo "== 3. Create client =="
CLIENT=$(curl -s -b "$JAR" -H "Content-Type: application/json" \
  -d '{"name":"Acme E2E","email":"acme-e2e@example.com","company":"Acme Inc","currency":"USD","isActive":true}' \
  "$BASE/api/clients")
CID=$(echo "$CLIENT" | sed -E 's/.*"id":"([^"]+)".*/\1/')
[ -n "$CID" ] && pass "client created id=$CID" || fail "client create failed: $CLIENT"

echo "== 4. Get a service =="
SVC=$(curl -s -b "$JAR" "$BASE/api/services")
SID=$(echo "$SVC" | sed -E 's/.*"id":"([^"]+)".*/\1/')
[ -n "$SID" ] && pass "service id=$SID" || fail "no services: $SVC"

echo "== 5. Create invoice (2 items, 10% tax) =="
INV=$(curl -s -b "$JAR" -H "Content-Type: application/json" \
  -d "{\"clientId\":\"$CID\",\"taxRate\":10,\"items\":[{\"serviceId\":\"$SID\",\"description\":\"Managed IT Support\",\"quantity\":2,\"unitPrice\":499},{\"description\":\"Setup fee\",\"quantity\":1,\"unitPrice\":150}]}" \
  "$BASE/api/invoices")
IID=$(echo "$INV" | sed -E 's/.*"id":"([^"]+)".*/\1/')
INUM=$(echo "$INV" | sed -E 's/.*"invoiceNumber":"([^"]+)".*/\1/')
TOTAL=$(echo "$INV" | sed -E 's/.*"total":"?([0-9.]+)"?.*/\1/')
[ -n "$IID" ] && pass "invoice $INUM created id=$IID total=$TOTAL (expect 1257.80)" || fail "invoice create failed: $INV"

echo "== 6. Fetch invoice detail =="
DET=$(curl -s -b "$JAR" "$BASE/api/invoices/$IID")
echo "$DET" | grep -q '"status":"DRAFT"' && pass "status DRAFT" || fail "unexpected status: $(echo "$DET" | head -c 200)"

echo "== 7. Generate PDF =="
HDR=$(curl -s -b "$JAR" -D - -o /tmp/inv.pdf "$BASE/api/invoices/$IID/pdf" | head -3)
MAGIC=$(head -c 4 /tmp/inv.pdf)
SIZE=$(wc -c < /tmp/inv.pdf)
[ "$MAGIC" = "%PDF" ] && pass "valid PDF, $SIZE bytes" || fail "not a PDF (magic='$MAGIC')"

echo "== 8. Attempt SEND (needs Stripe+Graph creds — expect graceful failure) =="
SEND=$(curl -s -b "$JAR" -X POST -w "|HTTP%{http_code}" "$BASE/api/invoices/$IID/send")
echo "  send result: $SEND"

echo "== 9. Mark invoice PAID (payment reconciliation; confirmation email fails gracefully) =="
MP=$(curl -s -b "$JAR" -X POST -w "|HTTP%{http_code}" "$BASE/api/invoices/$IID/mark-paid")
echo "$MP" | grep -q 'HTTP200' && pass "mark-paid ok: $MP" || fail "mark-paid failed: $MP"
DET2=$(curl -s -b "$JAR" "$BASE/api/invoices/$IID")
echo "$DET2" | grep -q '"status":"PAID"' && pass "status now PAID" || fail "status not PAID"
echo "$DET2" | grep -q '"paidAt":"2' && pass "paidAt recorded" || fail "paidAt missing"

echo "== 10. Notifications =="
NOTIF=$(curl -s -b "$JAR" "$BASE/api/notifications")
echo "$NOTIF" | grep -q 'PAYMENT_RECEIVED' && pass "PAYMENT_RECEIVED notification created" || fail "no payment notification: $(echo "$NOTIF" | head -c 200)"

echo "== 11. Dashboard stats reflect payment =="
STATS1=$(curl -s -b "$JAR" "$BASE/api/dashboard/stats")
REV1=$(echo "$STATS1" | sed -E 's/.*"totalRevenueThisMonth":([0-9.]+).*/\1/')
echo "  revenue this month now = $REV1 (was $REV0)"
awk "BEGIN{exit !($REV1 > $REV0)}" && pass "revenue increased by paid invoice" || fail "revenue did not increase"

echo "== 12. Cron: overdue check (with secret) =="
CRON=$(curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" -w "|HTTP%{http_code}" "$BASE/api/cron/check-overdue")
echo "$CRON" | grep -q 'HTTP200' && pass "overdue cron ran: $CRON" || fail "cron failed: $CRON"

echo ""
[ "$FAILED" = "0" ] && echo "🎉 E2E PASSED (all DB-backed flows)" || echo "⚠️  E2E had failures"
rm -f "$JAR"
