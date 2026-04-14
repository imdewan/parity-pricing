// =============================================================================
// Parity — App Store Connect Integration Logic
// Copyright 2026 Dewan
// Licensed under the Apache License, Version 2.0
// =============================================================================

let pricingData = null;
let generatedScript = '';
let scriptExt = 'sh';

const CREDS_KEY = 'parity_appstore_creds';

function init() {
  const raw = localStorage.getItem('parity_appstore_data');
  if (!raw) {
    document.getElementById('noData').style.display = 'block';
    return;
  }
  try {
    pricingData = JSON.parse(raw);
  } catch {
    document.getElementById('noData').style.display = 'block';
    return;
  }
  if (!pricingData || !pricingData.countries || !pricingData.countries.length) {
    document.getElementById('noData').style.display = 'block';
    return;
  }

  document.getElementById('mainContent').style.display = 'block';
  loadCreds();
  renderPreview();
}

function loadCreds() {
  const saved = localStorage.getItem(CREDS_KEY);
  if (!saved) return;
  try {
    const c = JSON.parse(saved);
    if (c.issuerId) document.getElementById('issuerId').value = c.issuerId;
    if (c.keyId)    document.getElementById('keyId').value    = c.keyId;
    if (c.appId)    document.getElementById('appId').value    = c.appId;
    if (c.bundleId) document.getElementById('bundleId').value = c.bundleId;
    if (c.p8Key)    document.getElementById('p8Key').value    = c.p8Key;
  } catch {}
}

function saveCreds() {
  if (!document.getElementById('rememberCreds').checked) return;
  const data = {
    issuerId: document.getElementById('issuerId').value.trim(),
    keyId:    document.getElementById('keyId').value.trim(),
    appId:    document.getElementById('appId').value.trim(),
    bundleId: document.getElementById('bundleId').value.trim(),
    p8Key:    document.getElementById('p8Key').value.trim()
  };
  localStorage.setItem(CREDS_KEY, JSON.stringify(data));
}

function toggleRemember() {
  if (!document.getElementById('rememberCreds').checked) {
    localStorage.removeItem(CREDS_KEY);
  } else {
    saveCreds();
  }
}

function clearCreds() {
  localStorage.removeItem(CREDS_KEY);
  document.getElementById('issuerId').value = '';
  document.getElementById('keyId').value    = '';
  document.getElementById('appId').value    = '';
  document.getElementById('bundleId').value = '';
  document.getElementById('p8Key').value    = '';
}

function renderPreview() {
  const d = pricingData;
  document.getElementById('pricingSummary').innerHTML = `
    <span class="pricing-badge">USD Base: <strong>$${d.usd_price.toFixed(2)}</strong></span>
    <span class="pricing-badge">Markets: <strong>${d.countries.length}</strong></span>
  `;

  const rows = d.countries.map(c => `
    <tr>
      <td>${c.territory}</td>
      <td>${c.country}</td>
      <td>${c.currency}</td>
      <td>${c.local_price}</td>
    </tr>
  `).join('');

  document.getElementById('previewTable').innerHTML = `
    <table>
      <thead><tr><th>Territory</th><th>Country</th><th>Currency</th><th>Price</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function loadP8(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { document.getElementById('p8Key').value = e.target.result; saveCreds(); };
  reader.readAsText(file);
}

function validate() {
  const issuer = document.getElementById('issuerId').value.trim();
  const keyId  = document.getElementById('keyId').value.trim();
  const appId  = document.getElementById('appId').value.trim();
  const p8     = document.getElementById('p8Key').value.trim();

  if (!issuer) { alert('Please enter your Issuer ID.'); return null; }
  if (!keyId)  { alert('Please enter your Key ID.'); return null; }
  if (!appId)  { alert('Please enter your App ID.'); return null; }
  if (!p8 || !p8.includes('PRIVATE KEY')) { alert('Please paste your .p8 private key contents.'); return null; }

  return { issuer, keyId, appId, p8, bundleId: document.getElementById('bundleId').value.trim() };
}

function generateScript(type) {
  const creds = validate();
  if (!creds) return;

  if (type === 'bash') {
    generatedScript = generateBash(creds);
    scriptExt = 'sh';
  } else {
    generatedScript = generateNode(creds);
    scriptExt = 'js';
  }

  document.getElementById('scriptPre').textContent = generatedScript;
  document.getElementById('scriptOutput').style.display = 'block';
  document.getElementById('scriptOutput').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function generateBash(c) {
  const territories = pricingData.countries.map(t =>
    `  "${t.territory}:${t.currency}:${t.local_price}"`
  ).join('\n');

  return `#!/bin/bash
# =============================================================================
# Parity — App Store Connect Pricing Script
# Generated from: https://mrdsa.dev/parity
# Base USD price: $${pricingData.usd_price.toFixed(2)}
# Markets: ${pricingData.countries.length}
# =============================================================================
# IMPORTANT: Review this script before running. Test with a sandbox app first.
# Requirements: openssl, curl, jq (brew install jq)
# =============================================================================

set -euo pipefail

# ── Credentials ──
ISSUER_ID="${c.issuer}"
KEY_ID="${c.keyId}"
APP_ID="${c.appId}"

# Write the private key to a temp file (deleted on exit)
P8_FILE=$(mktemp)
trap "rm -f $P8_FILE" EXIT
cat > "$P8_FILE" << 'KEYEOF'
${c.p8}
KEYEOF

# ── JWT Generation (uses python3 + openssl for reliable ES256 signing) ──
if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 is required but not found. Use the Node.js script instead."
  exit 1
fi
${c.bundleId ? `BUNDLE_ID="${c.bundleId}"` : `BUNDLE_ID=""`}

generate_jwt() {
  python3 -c "
import json, base64, time, subprocess, sys

def b64url(data):
    if isinstance(data, str): data = data.encode()
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

issuer_id, key_id, p8_file, bundle_id = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]

header = json.dumps({'alg':'ES256','kid':key_id,'typ':'JWT'}, separators=(',',':'))
now = int(time.time())
payload_d = {'iss':issuer_id,'iat':now,'exp':now+1200,'aud':'appstoreconnect-v1'}
if bundle_id:
    payload_d['bid'] = bundle_id
payload = json.dumps(payload_d, separators=(',',':'))

signing_input = b64url(header) + '.' + b64url(payload)

# Sign with openssl (outputs DER-encoded ECDSA signature)
proc = subprocess.run(
    ['openssl','dgst','-sha256','-sign', p8_file],
    input=signing_input.encode(), capture_output=True
)
if proc.returncode != 0:
    print('JWT_ERROR: openssl signing failed', file=sys.stderr)
    sys.exit(1)
der = proc.stdout

# Convert DER to raw R||S (64 bytes) — JWT ES256 format
pos = 2
if der[1] & 0x80:
    pos += (der[1] & 0x7f)
r_len = der[pos + 1]
r = der[pos + 2 : pos + 2 + r_len]
pos = pos + 2 + r_len
s_len = der[pos + 1]
s = der[pos + 2 : pos + 2 + s_len]
ZB = bytearray(1)
r = (bytes(ZB) * 32 + r)[-32:]
s = (bytes(ZB) * 32 + s)[-32:]

print(signing_input + '.' + b64url(r + s))
" "$ISSUER_ID" "$KEY_ID" "$P8_FILE" "$BUNDLE_ID"
}

# ── API Helper ──
api() {
  local METHOD=$1 URL=$2 DATA=\${3:-}
  local TOKEN=$(generate_jwt)
  if [ -n "$DATA" ]; then
    curl -s -X "$METHOD" "https://api.appstoreconnect.apple.com$URL" \\
      -H "Authorization: Bearer $TOKEN" \\
      -H "Content-Type: application/json" \\
      -d "$DATA"
  else
    curl -s -X "$METHOD" "https://api.appstoreconnect.apple.com$URL" \\
      -H "Authorization: Bearer $TOKEN" \\
      -H "Content-Type: application/json"
  fi
}

# ── Territory Pricing Data ──
# Format: TERRITORY_CODE:CURRENCY:TARGET_PRICE
TERRITORIES=(
${territories}
)

echo "==========================================="
echo "  Parity — App Store Connect Pricing"
echo "  App ID: $APP_ID"
echo "  Markets: \${#TERRITORIES[@]}"
echo "==========================================="
echo ""

# ── Step 1: Verify authentication ──
echo "[1/4] Verifying API authentication..."
AUTH_CHECK=$(api GET "/v1/apps/$APP_ID")
APP_NAME=$(echo "$AUTH_CHECK" | jq -r '.data.attributes.name // empty' 2>/dev/null)
if [ -z "$APP_NAME" ]; then
  echo "ERROR: Could not authenticate or find app."
  echo "Response: $AUTH_CHECK"
  exit 1
fi
echo "  App: $APP_NAME"
echo ""

# ── Step 2: Get current price schedule ──
echo "[2/4] Fetching current price schedule..."
SCHEDULE=$(api GET "/v1/apps/$APP_ID/appPriceSchedule")
SCHEDULE_ID=$(echo "$SCHEDULE" | jq -r '.data.id // empty' 2>/dev/null)
echo "  Schedule ID: \${SCHEDULE_ID:-none}"
echo ""

# ── Step 3: Fetch price points per territory ──
echo "[3/4] Fetching available price points per territory..."
echo "  This may take a moment..."
echo ""

PRICE_UPDATES=""
ERRORS=0
SUCCESS=0

for ENTRY in "\${TERRITORIES[@]}"; do
  IFS=':' read -r TERR_CODE CURRENCY TARGET_PRICE <<< "$ENTRY"

  # Get available price points for this territory
  POINTS=$(api GET "/v1/apps/$APP_ID/appPricePoints?filter[territory]=$TERR_CODE&limit=200")

  # Find the closest price point
  BEST_ID=""
  BEST_PRICE=""
  BEST_DIFF=999999

  while IFS= read -r LINE; do
    PP_ID=$(echo "$LINE" | jq -r '.id')
    PP_PRICE=$(echo "$LINE" | jq -r '.attributes.customerPrice // empty')

    if [ -n "$PP_PRICE" ]; then
      # Calculate absolute difference
      DIFF=$(echo "$PP_PRICE $TARGET_PRICE" | awk '{d=$1-$2; if(d<0)d=-d; print d}')
      IS_CLOSER=$(echo "$DIFF $BEST_DIFF" | awk '{print ($1 < $2) ? "1" : "0"}')

      if [ "$IS_CLOSER" = "1" ]; then
        BEST_DIFF=$DIFF
        BEST_ID=$PP_ID
        BEST_PRICE=$PP_PRICE
      fi
    fi
  done < <(echo "$POINTS" | jq -c '.data[]' 2>/dev/null)

  if [ -n "$BEST_ID" ]; then
    printf "  %-4s %s %s -> tier %s (actual: %s)\\n" "$TERR_CODE" "$CURRENCY" "$TARGET_PRICE" "$BEST_ID" "$BEST_PRICE"
    SUCCESS=$((SUCCESS + 1))
    PRICE_UPDATES="$PRICE_UPDATES$TERR_CODE:$BEST_ID\\n"
  else
    printf "  %-4s %s %s -> NO PRICE POINT FOUND\\n" "$TERR_CODE" "$CURRENCY" "$TARGET_PRICE"
    ERRORS=$((ERRORS + 1))
  fi
done

echo ""
echo "[4/4] Summary"
echo "  Matched: $SUCCESS territories"
echo "  Errors:  $ERRORS territories"
echo ""

if [ $SUCCESS -eq 0 ]; then
  echo "No price points matched. Check your App ID and territory codes."
  exit 1
fi

echo "==========================================="
echo "  Price points have been identified."
echo "  To apply these prices, use App Store"
echo "  Connect or the appPriceSchedules API."
echo ""
echo "  See: https://developer.apple.com/documentation/"
echo "  appstoreconnectapi/apppriceschedule"
echo "==========================================="
`;
}

function generateNode(c) {
  const territoriesJSON = JSON.stringify(
    pricingData.countries.map(t => ({
      territory: t.territory,
      currency: t.currency,
      targetPrice: t.local_price,
      country: t.country
    })),
    null, 2
  );

  return `#!/usr/bin/env node
// =============================================================================
// Parity — App Store Connect Pricing Script (Node.js)
// Generated from: https://mrdsa.dev/parity
// Base USD price: $${pricingData.usd_price.toFixed(2)}
// Markets: ${pricingData.countries.length}
// =============================================================================
// IMPORTANT: Review this script before running. Test with a sandbox app first.
// Requirements: npm install jsonwebtoken
// Run: node parity-appstore.js
// =============================================================================

const jwt = require('jsonwebtoken');
const https = require('https');

// ── Credentials ──
const ISSUER_ID = '${c.issuer}';
const KEY_ID    = '${c.keyId}';
const APP_ID    = '${c.appId}';
const PRIVATE_KEY = \`${c.p8}\`;

// ── Territory Pricing Data ──
const TERRITORIES = ${territoriesJSON};

// ── JWT Generation ──
function generateToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: ISSUER_ID,
    iat: now,
    exp: now + 1200,
    aud: 'appstoreconnect-v1'${c.bundleId ? `,\n    bid: '${c.bundleId}'` : ''}
  };
  return jwt.sign(payload, PRIVATE_KEY, {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' }
  });
}

// ── API Helper ──
function api(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const token = generateToken();
    const options = {
      hostname: 'api.appstoreconnect.apple.com',
      path,
      method,
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── Main ──
async function main() {
  console.log('===========================================');
  console.log('  Parity — App Store Connect Pricing');
  console.log(\`  App ID: \${APP_ID}\`);
  console.log(\`  Markets: \${TERRITORIES.length}\`);
  console.log('===========================================\\n');

  // Step 1: Verify auth
  console.log('[1/4] Verifying API authentication...');
  const app = await api('GET', \`/v1/apps/\${APP_ID}\`);
  const appName = app?.data?.attributes?.name;
  if (!appName) {
    console.error('ERROR: Could not authenticate or find app.');
    console.error('Response:', JSON.stringify(app, null, 2));
    process.exit(1);
  }
  console.log(\`  App: \${appName}\\n\`);

  // Step 2: Get current schedule
  console.log('[2/4] Fetching current price schedule...');
  const schedule = await api('GET', \`/v1/apps/\${APP_ID}/appPriceSchedule\`);
  console.log(\`  Schedule ID: \${schedule?.data?.id || 'none'}\\n\`);

  // Step 3: Find price points
  console.log('[3/4] Fetching price points per territory...\\n');
  let success = 0, errors = 0;
  const results = [];

  for (const t of TERRITORIES) {
    try {
      const points = await api('GET',
        \`/v1/apps/\${APP_ID}/appPricePoints?filter[territory]=\${t.territory}&limit=200\`
      );

      let bestId = null, bestPrice = null, bestDiff = Infinity;
      for (const pp of (points?.data || [])) {
        const price = parseFloat(pp.attributes?.customerPrice);
        if (!isNaN(price)) {
          const diff = Math.abs(price - t.targetPrice);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestId = pp.id;
            bestPrice = price;
          }
        }
      }

      if (bestId) {
        console.log(\`  \${t.territory.padEnd(4)} \${t.currency} \${String(t.targetPrice).padEnd(10)} -> tier \${bestId} (actual: \${bestPrice})\`);
        results.push({ territory: t.territory, pricePointId: bestId, actual: bestPrice });
        success++;
      } else {
        console.log(\`  \${t.territory.padEnd(4)} \${t.currency} \${String(t.targetPrice).padEnd(10)} -> NO PRICE POINT FOUND\`);
        errors++;
      }
    } catch (e) {
      console.log(\`  \${t.territory.padEnd(4)} ERROR: \${e.message}\`);
      errors++;
    }

    // Rate limiting: small delay between requests
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(\`\\n[4/4] Summary\`);
  console.log(\`  Matched: \${success} territories\`);
  console.log(\`  Errors:  \${errors} territories\\n\`);

  if (success === 0) {
    console.log('No price points matched. Check your App ID and territory codes.');
    process.exit(1);
  }

  // Output results as JSON for reference
  const outputFile = 'parity-appstore-results.json';
  require('fs').writeFileSync(outputFile, JSON.stringify({
    appId: APP_ID,
    appName,
    results,
    timestamp: new Date().toISOString()
  }, null, 2));
  console.log(\`Results saved to \${outputFile}\`);

  console.log('\\n===========================================');
  console.log('  Price points have been identified.');
  console.log('  To apply these prices, use App Store');
  console.log('  Connect or the appPriceSchedules API.');
  console.log('');
  console.log('  See: https://developer.apple.com/documentation/');
  console.log('  appstoreconnectapi/apppriceschedule');
  console.log('===========================================');
}

main().catch(e => { console.error('Fatal error:', e); process.exit(1); });
`;
}

function downloadScript() {
  const name = scriptExt === 'sh' ? 'parity-appstore.sh' : 'parity-appstore.js';
  const mime = 'text/plain';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([generatedScript], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function copyScript() {
  navigator.clipboard.writeText(generatedScript).then(() => {
    alert('Script copied to clipboard.');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = generatedScript;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    alert('Script copied to clipboard.');
  });
}

init();
