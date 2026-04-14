// =============================================================================
// Parity — Main Calculator Logic
// Copyright 2026 Dewan
// Licensed under the Apache License, Version 2.0
// =============================================================================

const URL_DATA   = 'https://raw.githubusercontent.com/tompec/netflix-prices/refs/heads/main/data/latest.json';
const PLAN_ORDER = ['premium','standard','standard_with_ads','basic','basic_with_ads','mobile'];
const ZERO_DEC   = new Set(['JPY','KRW','VND','IDR','CLP','PYG','UGX','BIF','GNF','ISK','MGA','RWF','XAF','XOF','XPF']);

let allData = [], tableRows = [], usData = null;

const AS3 = {
  AD:'AND',AE:'ARE',AF:'AFG',AG:'ATG',AL:'ALB',AM:'ARM',AO:'AGO',AR:'ARG',AT:'AUT',AU:'AUS',
  AZ:'AZE',BA:'BIH',BB:'BRB',BD:'BGD',BE:'BEL',BF:'BFA',BG:'BGR',BH:'BHR',BI:'BDI',BJ:'BEN',
  BM:'BMU',BN:'BRN',BO:'BOL',BR:'BRA',BS:'BHS',BT:'BTN',BW:'BWA',BY:'BLR',BZ:'BLZ',CA:'CAN',
  CD:'COD',CF:'CAF',CG:'COG',CH:'CHE',CI:'CIV',CK:'COK',CL:'CHL',CM:'CMR',CN:'CHN',CO:'COL',
  CR:'CRI',CV:'CPV',CY:'CYP',CZ:'CZE',DE:'DEU',DJ:'DJI',DK:'DNK',DM:'DMA',DO:'DOM',DZ:'DZA',
  EC:'ECU',EE:'EST',EG:'EGY',ER:'ERI',ES:'ESP',ET:'ETH',FI:'FIN',FJ:'FJI',FM:'FSM',FR:'FRA',
  GA:'GAB',GB:'GBR',GD:'GRD',GE:'GEO',GH:'GHA',GI:'GIB',GL:'GRL',GM:'GMB',GN:'GIN',GQ:'GNQ',
  GR:'GRC',GT:'GTM',GU:'GUM',GW:'GNB',GY:'GUY',HK:'HKG',HN:'HND',HR:'HRV',HT:'HTI',HU:'HUN',
  ID:'IDN',IE:'IRL',IL:'ISR',IN:'IND',IQ:'IRQ',IS:'ISL',IT:'ITA',JM:'JAM',JO:'JOR',JP:'JPN',
  KE:'KEN',KG:'KGZ',KH:'KHM',KR:'KOR',KW:'KWT',KY:'CYM',KZ:'KAZ',LA:'LAO',LB:'LBN',LC:'LCA',
  LI:'LIE',LK:'LKA',LR:'LBR',LS:'LSO',LT:'LTU',LU:'LUX',LV:'LVA',LY:'LBY',MA:'MAR',MC:'MCO',
  MD:'MDA',ME:'MNE',MG:'MDG',MK:'MKD',ML:'MLI',MM:'MMR',MN:'MNG',MO:'MAC',MQ:'MTQ',MR:'MRT',
  MT:'MLT',MU:'MUS',MV:'MDV',MW:'MWI',MX:'MEX',MY:'MYS',MZ:'MOZ',NA:'NAM',NC:'NCL',NE:'NER',
  NG:'NGA',NI:'NIC',NL:'NLD',NO:'NOR',NP:'NPL',NZ:'NZL',OM:'OMN',PA:'PAN',PE:'PER',PG:'PNG',
  PH:'PHL',PK:'PAK',PL:'POL',PT:'PRT',PW:'PLW',PY:'PRY',QA:'QAT',RO:'ROU',RS:'SRB',RU:'RUS',
  RW:'RWA',SA:'SAU',SB:'SLB',SC:'SYC',SD:'SDN',SE:'SWE',SG:'SGP',SI:'SVN',SK:'SVK',SL:'SLE',
  SM:'SMR',SN:'SEN',SO:'SOM',SR:'SUR',SS:'SSD',SV:'SLV',SY:'SYR',SZ:'SWZ',TD:'TCD',TG:'TGO',
  TH:'THA',TJ:'TJK',TL:'TLS',TM:'TKM',TN:'TUN',TO:'TON',TR:'TUR',TT:'TTO',TW:'TWN',TZ:'TZA',
  UA:'UKR',UG:'UGA',US:'USA',UY:'URY',UZ:'UZB',VC:'VCT',VE:'VEN',VG:'VGB',VN:'VNM',VU:'VUT',
  WS:'WSM',YE:'YEM',ZA:'ZAF',ZM:'ZMB',ZW:'ZWE'
};

function flag(c) {
  if (!c || c.length !== 2) return '🌐';
  return c.toUpperCase().replace(/./g, x => String.fromCodePoint(127397 + x.charCodeAt(0)));
}
function planLabel(n) { return n ? n.replace(/_/g,' ').replace(/\b\w/g, l => l.toUpperCase()) : ''; }
function planClass(n) {
  if (!n) return '';
  return n.includes('premium') ? 'premium' : n.includes('standard') ? 'standard' :
         n.includes('basic')   ? 'basic'    : n.includes('mobile')   ? 'mobile'   : '';
}
function fmtLocal(val, cur) {
  try {
    const dec = ZERO_DEC.has(cur) ? 0 : 2;
    return new Intl.NumberFormat('en-US', { style:'currency', currency:cur, minimumFractionDigits:dec, maximumFractionDigits:dec }).format(val);
  } catch { return `${cur} ${val.toFixed(2)}`; }
}
function fmtUSD(v) { return '$' + v.toFixed(2); }
function roundLocal(price, cur) { return ZERO_DEC.has(cur) ? Math.round(price) : Math.round(price * 100) / 100; }

function charmRound(price, cur) {
  if (price <= 0) return price;
  if (price >= 10000) return Math.floor((price + 1) / 1000) * 1000 - 1;
  if (price >= 1000)  return Math.floor((price + 1) / 100) * 100 - 1;
  if (price >= 100) {
    const base = Math.floor(price / 100) * 100;
    return price >= base + 50 ? base + 49 : base - 1;
  }
  if (ZERO_DEC.has(cur)) {
    if (price >= 10) return Math.floor((price + 1) / 10) * 10 - 1;
    return Math.max(Math.round(price), 1);
  }
  if (price >= 1)   return Math.floor(price + 0.01) - 0.01;
  if (price >= 0.1) return Math.floor(price * 10 + 0.01) / 10 - 0.01;
  return Math.round(price * 100) / 100;
}

function getUSPrice(pn) {
  if (!usData) return null;
  const p = usData.plans.find(x => x.name === pn);
  return (p && p.price != null) ? p.price : null;
}

function getRatio(country, planPref) {
  if (country.country_code === 'US') return null;
  const cands = planPref === 'auto' ? PLAN_ORDER : [planPref];
  for (const pn of cands) {
    const p   = country.plans.find(x => x.name === pn);
    const usP = getUSPrice(pn);
    if (p && p.price != null && usP != null && usP > 0)
      return { ratio: p.price / usP, plan: pn, localRef: p.price, usRef: usP, priceUSD: p.price_usd };
  }
  return null;
}

async function fetchData() {
  try {
    const res = await fetch(URL_DATA);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    allData = await res.json();
    usData  = allData.find(c => c.country_code === 'US');
    document.getElementById('statusDot').className    = 'dot live';
    document.getElementById('statusText').textContent = 'LIVE DATA';
    document.getElementById('statCountries').textContent = allData.length;
    document.getElementById('tableWrap').innerHTML =
      `<div class="state-box">
        <span style="font-size:20px">⌨</span>
        <span class="state-txt">ENTER A USD PRICE ABOVE AND HIT CALCULATE</span>
      </div>`;
  } catch (e) {
    document.getElementById('statusDot').style.background = '#FF6B6B';
    document.getElementById('statusText').textContent = 'ERROR';
    document.getElementById('tableWrap').innerHTML =
      `<div class="state-box"><span class="state-txt state-err">⚠ ${e.message}</span></div>`;
  }
}

function calculate() {
  const usd = parseFloat(document.getElementById('priceInput').value);
  if (isNaN(usd) || usd < 0) { alert('Please enter a valid USD price.'); return; }

  const plan      = document.getElementById('planSelect').value;
  const roundMode = document.getElementById('roundSelect').value;
  document.getElementById('statUSD').textContent = fmtUSD(usd);

  tableRows = [];
  for (const c of allData) {
    const r = getRatio(c, plan);
    if (!r) continue;
    const rawPrice   = usd * r.ratio;
    const localPrice = roundMode === 'charm99' ? charmRound(rawPrice, c.currency) : rawPrice;
    const pppUSD     = (r.priceUSD != null && r.localRef > 0) ? localPrice * (r.priceUSD / r.localRef) : null;
    const pctBelow   = pppUSD != null ? ((usd - pppUSD) / usd * 100) : null;
    tableRows.push({ country: c.country, code: c.country_code, currency: c.currency, ratio: r.ratio, plan: r.plan, localRef: r.localRef, usRef: r.usRef, localPrice, pppUSD, pctBelow });
  }

  if (tableRows.length) {
    const s = [...tableRows].sort((a,b) => a.ratio - b.ratio);
    document.getElementById('statLowest').textContent  = fmtLocal(s[0].localPrice, s[0].currency) + ` (${s[0].code})`;
    document.getElementById('statHighest').textContent = fmtLocal(s[s.length-1].localPrice, s[s.length-1].currency) + ` (${s[s.length-1].code})`;
  }

  document.getElementById('resultsHeader').style.display = 'flex';
  renderTable();
}

function sortRows() {
  const key = document.getElementById('sortSelect').value;
  tableRows.sort((a,b) => {
    if (key === 'country')    return a.country.localeCompare(b.country);
    if (key === 'ratio_asc')  return a.ratio - b.ratio;
    if (key === 'ratio_desc') return b.ratio - a.ratio;
    if (key === 'price_asc')  return a.localPrice - b.localPrice;
    if (key === 'price_desc') return b.localPrice - a.localPrice;
    if (key === 'discount')   return a.ratio - b.ratio;
    return 0;
  });
}

function renderTable() {
  if (!tableRows.length) return;
  sortRows();

  const q    = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const rows = q ? tableRows.filter(r =>
    r.country.toLowerCase().includes(q) || r.currency.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)
  ) : tableRows;

  document.getElementById('resultCount').textContent = `${rows.length} markets`;
  const maxRatio = Math.max(...tableRows.map(r => r.ratio));

  const tbody = rows.map(r => {
    const bw = Math.round((r.ratio / maxRatio) * 48);
    const usdCell = r.pppUSD != null
      ? `<span class="price-usd">${fmtUSD(r.pppUSD)}</span>`
      : `<span style="color:var(--muted);font-family:var(--mono);font-size:10px">—</span>`;
    let pctCell = '';
    if (r.pctBelow != null) {
      if      (r.pctBelow >  2) pctCell = `<div class="pct-wrap"><span class="pct-num dn">▼ ${r.pctBelow.toFixed(1)}%</span><span class="pct-sub">below USD</span></div>`;
      else if (r.pctBelow < -2) pctCell = `<div class="pct-wrap"><span class="pct-num up">▲ ${Math.abs(r.pctBelow).toFixed(1)}%</span><span class="pct-sub">above USD</span></div>`;
      else                      pctCell = `<div class="pct-wrap"><span class="pct-num flat">≈ parity</span></div>`;
    }
    return `<tr>
      <td><div class="c-cell"><span class="flag">${flag(r.code)}</span><div><div class="c-name">${r.country}</div><div class="c-code">${r.code}</div></div></div></td>
      <td class="cur-cell">${r.currency}</td>
      <td class="hide-xs"><div class="ratio-wrap"><div class="ratio-bar" style="width:${bw}px"></div><span class="ratio-num">${r.ratio.toFixed(4)}</span></div></td>
      <td class="c hide-xs"><span class="plan-chip ${planClass(r.plan)}">${planLabel(r.plan)}</span></td>
      <td class="r"><span class="price-local">${fmtLocal(r.localPrice, r.currency)}</span></td>
      <td class="r">${usdCell}</td>
      <td class="r">${pctCell}</td>
    </tr>`;
  }).join('');

  document.getElementById('tableWrap').innerHTML = `
    <table>
      <thead><tr>
        <th>Country</th><th>Cur</th>
        <th class="hide-xs">Netflix Ratio</th><th class="c hide-xs">Ref Plan</th>
        <th class="r">Your Price</th><th class="r">In USD</th><th class="r">% vs USD</th>
      </tr></thead>
      <tbody>${tbody}</tbody>
    </table>`;
}

function dlBlob(content, name, mime) {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content], { type: mime })), download: name
  });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function dl(fmt) {
  const usd  = parseFloat(document.getElementById('priceInput').value) || 0;
  const slug = usd.toFixed(2).replace('.', '-');

  if (fmt === 'csv') {
    const head = 'country_code,country,currency,local_price,price_in_usd,pct_below_usd,ref_plan,netflix_local_ref,netflix_us_ref\n';
    const body = tableRows.map(r => [r.code,`"${r.country}"`,r.currency,roundLocal(r.localPrice,r.currency),r.pppUSD!=null?r.pppUSD.toFixed(4):'',r.pctBelow!=null?r.pctBelow.toFixed(2):'',r.plan,r.localRef,r.usRef].join(',')).join('\n');
    dlBlob(head + body, `parity-pricing-${slug}usd.csv`, 'text/csv');

  } else if (fmt === 'json') {
    const out = {
      generated_by: 'Parity — mrdsa.dev', usd_price: usd,
      source: 'Netflix pricing ratios (github.com/tompec/netflix-prices)',
      countries: tableRows.map(r => ({
        country_code:  r.code, country: r.country, currency: r.currency,
        local_price:   roundLocal(r.localPrice, r.currency),
        price_in_usd:  r.pppUSD   != null ? parseFloat(r.pppUSD.toFixed(4))   : null,
        pct_below_usd: r.pctBelow != null ? parseFloat(r.pctBelow.toFixed(2)) : null,
        netflix_ratio: parseFloat(r.ratio.toFixed(6)), ref_plan: r.plan
      }))
    };
    dlBlob(JSON.stringify(out, null, 2), `parity-pricing-${slug}usd.json`, 'application/json');
  }
}

function goAppStore() {
  if (!tableRows.length) { alert('Calculate prices first.'); return; }
  const usd = parseFloat(document.getElementById('priceInput').value) || 0;
  const payload = {
    usd_price: usd,
    countries: tableRows.map(r => ({
      code: r.code, country: r.country, currency: r.currency,
      territory: AS3[r.code] || r.code,
      local_price: roundLocal(r.localPrice, r.currency),
      plan: r.plan
    }))
  };
  localStorage.setItem('parity_appstore_data', JSON.stringify(payload));
  window.location.href = 'appstore.html';
}

fetchData();
