#!/usr/bin/env bash
set -euo pipefail

PHEMEX_DIR="/home/hermes/projects/phemex-grid-ai"
DASH_DIR="/home/hermes/projects/trading-dashboard"
ROOT_ENV="/home/hermes/.hermes/.env"
PROFILE_A_ENV="/home/hermes/.hermes/profiles/cryptotrader/.env"
PROFILE_B_ENV="/home/hermes/.hermes/profiles/cryptotrader-b/.env"

cd "$PHEMEX_DIR"

# Trader A: load only this profile's env for the command, without printing secrets.
(
  set -a
  [ -f "$PROFILE_A_ENV" ] && . "$PROFILE_A_ENV"
  set +a
  TRADER_ID=a .venv/bin/python scripts/sync_phemex_trade_log.py --trader a --json >/tmp/trading_dashboard_sync_a.json
  TRADER_ID=a .venv/bin/python scripts/cryptotrader_execute.py status --json >/tmp/status_a.json
)

# Trader B: separate profile/env/account.
(
  set -a
  [ -f "$PROFILE_B_ENV" ] && . "$PROFILE_B_ENV"
  set +a
  TRADER_ID=b .venv/bin/python scripts/sync_phemex_trade_log.py --trader b --json >/tmp/trading_dashboard_sync_b.json
  TRADER_ID=b .venv/bin/python scripts/cryptotrader_execute.py status --json >/tmp/status_b.json
)

cd "$DASH_DIR"
python3 scripts/export_phemex_dashboard.py >/tmp/trading_dashboard_export.log
python3 -m json.tool public/data/dashboard.json >/dev/null

# Deploy only after data generation succeeds.
set -a
[ -f "$ROOT_ENV" ] && . "$ROOT_ENV"
set +a
if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "VERCEL_TOKEN missing in $ROOT_ENV" >&2
  exit 1
fi

npx vercel --prod --yes --token "$VERCEL_TOKEN" >/tmp/trading_dashboard_vercel.log

python3 - <<'PY'
import json
from pathlib import Path
p=Path('/home/hermes/projects/trading-dashboard/public/data/dashboard.json')
d=json.loads(p.read_text())
print('Trading dashboard bijgewerkt en gedeployed.')
print('URL: https://trading-dashboard-phi-ten.vercel.app')
print('Generated:', d.get('generated_at'))
for t in d.get('traders', []):
    print(f"- {t['name']}: equity ${t['current_equity']:.2f}, resultaat {t['account_performance']:+.2f}, open {t['open_positions_count']}, closed {t['closed_trades']}")
PY
