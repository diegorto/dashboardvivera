#!/bin/bash

##############################################################################
# 🧪 Remote Control System Verification Script
# Tests all remote control API endpoints
# Usage: bash test-remote-control.sh <vps-ip> [control-token]
##############################################################################

set -e

VPS_IP="${1:-187.77.249.55}"
CONTROL_TOKEN="${2:-dashboard-vivera-2026}"
PORT="3000"
BASE_URL="http://$VPS_IP:$PORT"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Remote Control System Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎯 Target: $VPS_IP:$PORT"
echo "🔐 Token: ${CONTROL_TOKEN:0:10}..."
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
test_endpoint() {
  local method=$1
  local endpoint=$2
  local description=$3
  local expected_status=$4
  local data=$5

  echo -n "Testing: $description... "

  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" \
      -H "x-control-token: $CONTROL_TOKEN" \
      "$BASE_URL$endpoint" 2>/dev/null || echo "")
  else
    if [ -z "$data" ]; then
      response=$(curl -s -w "\n%{http_code}" -X $method \
        -H "x-control-token: $CONTROL_TOKEN" \
        "$BASE_URL$endpoint" 2>/dev/null || echo "")
    else
      response=$(curl -s -w "\n%{http_code}" -X $method \
        -H "x-control-token: $CONTROL_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$data" \
        "$BASE_URL$endpoint" 2>/dev/null || echo "")
    fi
  fi

  # Extract status code (last line)
  http_code=$(echo "$response" | tail -n1)

  if [ "$http_code" = "$expected_status" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
    ((TESTS_PASSED++))

    # Show response body if not just status
    body=$(echo "$response" | head -n-1)
    if [ ! -z "$body" ] && [ ${#body} -lt 200 ]; then
      echo "   Response: $body"
    fi
  else
    echo -e "${RED}✗ FAIL${NC} (Expected $expected_status, got $http_code)"
    ((TESTS_FAILED++))

    # Show error details
    body=$(echo "$response" | head -n-1)
    if [ ! -z "$body" ]; then
      echo "   Error: ${body:0:100}"
    fi
  fi
  echo ""
}

# Test connectivity first
echo "1️⃣  Connectivity Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "GET" "/api/remote/status" "Server status endpoint" "200"

# Test health endpoint
echo ""
echo "2️⃣  Health Check Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "GET" "/api/remote/health-detailed" "Detailed health check" "200"

# Test logs endpoint
echo ""
echo "3️⃣  Logs and Information Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "GET" "/api/remote/logs" "Get server logs" "200"

# Test sync endpoint (POST)
echo ""
echo "4️⃣  Action Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "POST" "/api/remote/sync" "Force data sync" "200"

# Test cache clear endpoint (POST)
test_endpoint "POST" "/api/remote/clear-cache" "Clear cache" "200"

# Test exec with whitelisted command (POST)
echo ""
echo "5️⃣  Command Execution Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "POST" "/api/remote/exec" "Execute PM2 status" "200" '{"command":"pm2 status"}'

# Test invalid auth
echo ""
echo "6️⃣  Security Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -n "Testing: Invalid token rejection... "
response=$(curl -s -w "\n%{http_code}" \
  -H "x-control-token: invalid-token" \
  "$BASE_URL/api/remote/status" 2>/dev/null || echo "")
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "401" ]; then
  echo -e "${GREEN}✓ PASS${NC} (HTTP 401 - Unauthorized)"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗ FAIL${NC} (Expected 401, got $http_code)"
  ((TESTS_FAILED++))
fi
echo ""

# Test dashboard web interface
echo ""
echo "7️⃣  Web Interface Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -n "Testing: Web dashboard HTML... "
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/remote" 2>/dev/null || echo "")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)
if [ "$http_code" = "200" ] && echo "$body" | grep -q "Remote Control Panel"; then
  echo -e "${GREEN}✓ PASS${NC} (HTML dashboard loaded)"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗ FAIL${NC} (Expected valid HTML)"
  ((TESTS_FAILED++))
fi
echo ""

# Test WhatsApp dashboard
echo ""
echo "8️⃣  Dashboard Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "GET" "/dashboard/whatsapp" "WhatsApp Analytics Dashboard" "200"

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
  echo ""
  echo "Your remote control system is working perfectly! 🎉"
  exit 0
else
  echo -e "${RED}❌ SOME TESTS FAILED${NC}"
  echo ""
  echo "Troubleshooting tips:"
  echo "1. Verify VPS is online: ping $VPS_IP"
  echo "2. Check port 3000 is open: telnet $VPS_IP 3000"
  echo "3. SSH into VPS and check: pm2 status"
  echo "4. View logs: pm2 logs"
  echo "5. Restart if needed: pm2 restart all"
  exit 1
fi
