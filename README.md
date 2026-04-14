# Parity — Global Pricing Calculator

A browser-based tool that calculates locally-adjusted prices for your product across every Netflix market, derived from Netflix's own pricing ratios.

**Live:** [mrdsa.dev/parity](https://mrdsa.dev/parity)

## What it does

Enter your USD price and Parity fetches live Netflix pricing data to compute a locally-adjusted price for each country. Instead of using live exchange rates (which fluctuate), it uses Netflix's actual price-to-USD ratios — a proven, market-tested benchmark for purchasing power parity.

**Formula:** `local price = your USD price × (Netflix local plan price ÷ Netflix US plan price)`

## Features

- **Live data** — pulls from [tompec/netflix-prices](https://github.com/tompec/netflix-prices) on every load
- **160+ markets** — every country where Netflix operates
- **Plan selection** — auto-select the best available tier, or lock to Premium / Standard / Basic / Mobile
- **Charm rounding** — optional .99 / X9 psychological pricing
- **Sort & search** — filter by country, currency, or code; sort by ratio, price, or discount
- **Export** — download results as CSV or JSON
- **App Store Connect integration** — generate a Bash or Node.js script to push prices directly to Apple's API

## Pages

| File | Description |
|------|-------------|
| `index.html` | Main calculator — enter USD price, view global pricing table, export |
| `appstore.html` | App Store Connect integration — generate scripts to push prices via Apple's API |

## Project structure

```
parity/
├── index.html              # Main calculator page
├── appstore.html           # App Store Connect integration page
├── assets/
│   ├── css/
│   │   ├── shared.css      # Variables, base styles, header, hero, footer
│   │   ├── main.css        # Calculator-specific styles and responsive rules
│   │   └── appstore.css    # App Store Connect page styles
│   └── js/
│       ├── main.js         # Calculator logic, data fetching, export
│       └── appstore.js     # App Store Connect credential handling, script generation
├── LICENSE
└── README.md
```

## Running locally

No build step required — it's plain HTML, CSS, and JavaScript.

```bash
# Any static file server works, e.g.:
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

> Opening `index.html` directly as a `file://` URL will fail due to CORS restrictions when fetching the Netflix pricing data. Use a local server.

## Data source

Netflix pricing data comes from [tompec/netflix-prices](https://github.com/tompec/netflix-prices), fetched live from GitHub on each page load. Parity is not affiliated with Netflix Inc.

## App Store Connect integration

The `appstore.html` page lets you generate a script (Bash or Node.js) that:

1. Authenticates with Apple's App Store Connect API using your credentials
2. Fetches available price points per territory
3. Matches each calculated price to the nearest App Store price tier
4. Reports results — you can then apply them via the API or App Store Connect UI

Your credentials are never sent to any server — all processing happens in your browser, and the generated script runs locally on your machine.

**Requirements for Bash script:** `openssl`, `curl`, `jq`  
**Requirements for Node.js script:** `npm install jsonwebtoken`

## License

Apache License 2.0 — see [LICENSE](LICENSE) for the full text.

---

Made by [Dewan](https://mrdsa.dev)
