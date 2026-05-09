# Trading Dashboard

Modern Next.js dashboard voor trading bots - gehost op Vercel.

## Features

- 🖥️ **Multi-platform support** - Phemex, Hyperliquid, OKX, etc.
- 📊 **Real-time overview** - Equity, PnL, open posities per strategie
- 📱 **Responsive design** - Werkt op desktop en mobiel
- 🌙 **Dark mode** - Standaard dark theme
- ⚡ **Live updates** - Auto-refresh elke minuut + handmatige refresh

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build voor productie
npm run build

# Start productie server
npm start
```

## Data Structuur

Het dashboard leest data uit `public/data/dashboard.json`:

```json
{
  "generated_at": "2026-05-09T19:00:00Z",
  "platforms": {
    "phemex": {
      "total_equity": 4000,
      "total_pnl": 123.45,
      "pnl_percentage": 3.09,
      "last_updated": "2026-05-09T19:00:00Z",
      "strategies": [
        {
          "name": "BTC Grid Bot",
          "equity": 2500,
          "pnl": 87.50,
          "pnl_percentage": 3.62,
          "status": "active",
          "open_positions": 3,
          "positions": [...]
        }
      ]
    }
  }
}
```

## Vercel Deploy

1. **GitHub repo pushen:**
```bash
git remote add origin https://github.com/pehur00/trading-dashboard.git
git branch -M main
git push -u origin main
```

2. **Connect met Vercel:**
- Ga naar [vercel.com](https://vercel.com)
- Import de GitHub repo
- Deploy automatisch bij commits naar `main`

3. **Optioneel: custom domain**
- Voeg domein toe in Vercel dashboard
- Update DNS records

## Data Pipeline

Om de data actueel te houden:

**Optie A: Cronjob update JSON**
```bash
# Voorbeeld: update elke 4 uur
0 */4 * * * node /path/to/update-script.js
```

**Optie B: API Route**
- Maak een API route die live data ophaalt
- Dashboard fetcht via `/api/data` endpoint

## Project Structuur

```
trading-dashboard/
├── src/
│   └── app/
│       ├── page.tsx              # Home dashboard
│       ├── [platform]/page.tsx   # Platform detail pagina
│       ├── layout.tsx            # Root layout
│       └── globals.css           # Global styles
├── public/
│   └── data/
│       └── dashboard.json        # Dashboard data
├── package.json
└── README.md
```

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS
- **Language:** TypeScript
- **Hosting:** Vercel
- **Charts:** (optioneel) Recharts of Chart.js toevoegen

## License

MIT
