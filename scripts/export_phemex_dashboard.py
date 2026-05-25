#!/usr/bin/env python3
"""Export sanitized Phemex multi-trader dashboard data.

Reads status JSON files generated from the live Phemex accounts plus local state/trade
journals. No secrets or account identifiers are emitted.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PROJECT = Path('/home/hermes/projects/phemex-grid-ai')
DASHBOARD = Path('/home/hermes/projects/trading-dashboard')
OUT = DASHBOARD / 'public/data/dashboard.json'
ADJUSTMENTS = DASHBOARD / 'data/cash_adjustments.json'
STATUS = {'a': Path('/tmp/status_a.json'), 'b': Path('/tmp/status_b.json')}
NAMES = {'a': 'Trader A', 'b': 'Trader B'}
MODELS = {'a': 'DeepSeek', 'b': 'HY3'}


def fnum(v, default: Any = 0.0) -> Any:
    try:
        if v is None or v == '':
            return default
        return float(v)
    except Exception:
        return default


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text())
    except Exception:
        return default


def load_closed(trader: str):
    path = PROJECT / '.state' / trader / 'closed_trades.jsonl'
    rows = []
    if path.exists():
        for line in path.read_text().splitlines():
            if not line.strip():
                continue
            try:
                rows.append(json.loads(line))
            except Exception:
                pass
    rows.sort(key=lambda r: r.get('closed_at') or r.get('opened_at') or '')
    return rows


def cash_adjustment_total(trader: str):
    """External cash flows that should not count as trading performance."""
    data = load_json(ADJUSTMENTS, {})
    return sum(fnum(row.get('amount')) for row in data.get(trader, []))


def side_of(pos):
    side = (pos.get('side') or pos.get('info', {}).get('side') or '').lower()
    if side in ('buy', 'long'):
        return 'long'
    if side in ('sell', 'short'):
        return 'short'
    return side or 'unknown'


def calc_rr(side, entry, sl, tp):
    if not entry or not sl or not tp:
        return None
    if side == 'long' and entry > sl:
        return (tp - entry) / (entry - sl)
    if side == 'short' and sl > entry:
        return (entry - tp) / (sl - entry)
    return None


def planned_rr_from_trade(t):
    fixed = fnum(t.get('fixed_rr_at_open'), None)
    if fixed is not None:
        return fixed
    tp_list = t.get('initial_tp') or t.get('tp') or []
    tp = fnum(tp_list[0], None) if tp_list else None
    return calc_rr(t.get('side'), fnum(t.get('entry_price')), fnum(t.get('initial_sl') or t.get('sl'), None), tp)


def fixed_rr_from_state_position(p):
    fixed = fnum(p.get('fixed_rr_at_open'), None)
    if fixed is not None:
        return fixed
    tp_list = p.get('initial_tp') or p.get('tp') or []
    tp = fnum(tp_list[0], None) if tp_list else None
    return calc_rr(p.get('side'), fnum(p.get('entry')), fnum(p.get('initial_sl') or p.get('sl'), None), tp)


def build_trader(trader: str):
    status = load_json(STATUS[trader], {})
    state = load_json(PROJECT / '.state' / trader / 'live_execution_state.json', {})
    closed = load_closed(trader)
    equity = fnum(status.get('equity_usd'))
    raw_start = fnum(state.get('equity_at_start'), equity)
    cash_adjustments = cash_adjustment_total(trader)
    start = raw_start + cash_adjustments
    open_positions = status.get('open_positions') or []
    state_positions = {p.get('symbol'): p for p in state.get('open_positions') or []}
    open_upnl = sum(fnum(p.get('unrealizedPnl')) for p in open_positions)
    realised_journal = sum(fnum(t.get('realized_pnl_usdt')) for t in closed)
    # Jasper's dashboard PnL preference: realised PnL should be closed positions only.
    # Open uPnL is shown separately as a forecast/mark-to-market scenario.
    account_perf = realised_journal
    forecast_perf = realised_journal + open_upnl
    wins = sum(1 for t in closed if fnum(t.get('realized_pnl_usdt')) > 0)
    losses = sum(1 for t in closed if fnum(t.get('realized_pnl_usdt')) < 0)
    opening_rr_values = [rr for rr in (planned_rr_from_trade(t) for t in closed) if rr is not None]
    opening_rr_values += [rr for rr in (fixed_rr_from_state_position(p) for p in state.get('open_positions') or []) if rr is not None]
    first_trade_time = next((t.get('opened_at') or t.get('closed_at') for t in closed if t.get('opened_at') or t.get('closed_at')), None)
    curve_start_time = first_trade_time or state.get('last_reset_date') or datetime.now(timezone.utc).isoformat()
    curve = [{'time': curve_start_time, 'value': 0.0, 'label': 'start (cashflow gecorrigeerd)'}]
    run = 0.0
    for t in closed:
        run += fnum(t.get('realized_pnl_usdt'))
        curve.append({
            'time': t.get('closed_at') or t.get('opened_at'),
            'value': round(run, 6),
            'label': t.get('symbol', '').replace('/USDT:USDT', ''),
        })
    curve.append({'time': datetime.now(timezone.utc).isoformat(), 'value': round(forecast_perf, 6), 'label': 'forecast incl. uPnL'})

    positions = []
    for p in open_positions:
        sym = p.get('symbol') or p.get('info', {}).get('symbol') or ''
        st = state_positions.get(sym) or state_positions.get(sym.replace(':USDT', '')) or {}
        side = side_of(p)
        entry = fnum(p.get('entryPrice') or p.get('info', {}).get('avgEntryPrice'))
        mark = fnum(p.get('markPrice') or p.get('lastPrice') or p.get('info', {}).get('markPriceRp'))
        sl = fnum(st.get('sl'), None)
        tp_list = st.get('tp') or []
        tp = fnum(tp_list[0], None) if tp_list else None
        rr = calc_rr(side, entry, sl, tp) if sl and tp else None
        rr_at_open = fixed_rr_from_state_position(st) if st else rr
        positions.append({
            'symbol': sym.replace('/USDT:USDT', ''),
            'side': side,
            'size': fnum(p.get('contracts') or p.get('info', {}).get('size')),
            'entry': entry,
            'mark': mark,
            'sl': sl,
            'tp': tp,
            'rr': round(rr, 2) if rr is not None else None,
            'rr_current': round(rr, 2) if rr is not None else None,
            'rr_at_open': round(rr_at_open, 2) if rr_at_open is not None else None,
            'rr_note': 'RR bij openen; blijft vast na SL-trailing',
            'leverage': fnum(p.get('leverage') or p.get('info', {}).get('leverageRr')),
            'unrealized_pnl': fnum(p.get('unrealizedPnl')),
            'opened_at': st.get('opened_at'),
            'protection': 'SL/TP actief' if st.get('sl_order_id') and st.get('tp_order_ids') else 'controle nodig',
        })

    trades = []
    for t in closed[-12:][::-1]:
        rr_at_open = planned_rr_from_trade(t)
        trades.append({
            'symbol': (t.get('symbol') or '').replace('/USDT:USDT', ''),
            'side': t.get('side'),
            'opened_at': t.get('opened_at'),
            'closed_at': t.get('closed_at'),
            'entry': fnum(t.get('entry_price')),
            'exit': fnum(t.get('exit_price')),
            'net_pnl': fnum(t.get('realized_pnl_usdt')),
            'fees': fnum(t.get('fees_usdt')),
            'r_multiple': fnum(t.get('r_multiple')),
            'rr_at_open': round(rr_at_open, 2) if rr_at_open is not None else None,
            'rr_note': 'RR bij openen; blijft vast na SL-trailing',
            'source': 'Phemex fills',
        })

    return {
        'id': trader,
        'name': NAMES[trader],
        'model': MODELS[trader],
        'status': 'paused' if status.get('paused') else 'active',
        'start_equity': round(start, 6),
        'raw_start_equity': round(raw_start, 6),
        'external_cash_flow': round(cash_adjustments, 6),
        'current_equity': round(equity, 6),
        'account_performance': round(account_perf, 6),
        'account_performance_pct': round((account_perf / start * 100) if start else 0, 3),
        'forecast_performance': round(forecast_perf, 6),
        'forecast_performance_pct': round((forecast_perf / start * 100) if start else 0, 3),
        'realized_journal_pnl': round(realised_journal, 6),
        'open_unrealized_pnl': round(open_upnl, 6),
        'closed_trades': len(closed),
        'wins': wins,
        'losses': losses,
        'winrate': round((wins / (wins + losses) * 100) if wins + losses else 0, 1),
        'avg_rr_at_open': round(sum(opening_rr_values) / len(opening_rr_values), 2) if opening_rr_values else None,
        'rr_at_open_count': len(opening_rr_values),
        'open_positions_count': len(open_positions),
        'open_positions': positions,
        'closed_trade_log': trades,
        'equity_curve': curve,
        'last_trade_log_sync_at': state.get('last_trade_log_sync_at'),
        'data_quality': 'PNL = gesloten posities/realised journal. Open uPnL staat apart als forecast; externe stortingen/opnames tellen niet als PnL.',
    }


def main():
    traders = [build_trader(t) for t in ('a', 'b')]
    total_start = sum(t['start_equity'] for t in traders)
    total_equity = sum(t['current_equity'] for t in traders)
    data = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'source': 'Phemex read-only status + synced fill journals; sanitized for public dashboard',
        'traders': traders,
        'totals': {
            'start_equity': round(total_start, 6),
            'current_equity': round(total_equity, 6),
            'account_performance': round(sum(t['account_performance'] for t in traders), 6),
            'forecast_performance': round(sum(t.get('forecast_performance', t['account_performance']) for t in traders), 6),
            'external_cash_flow': round(sum(t.get('external_cash_flow', 0) for t in traders), 6),
            'open_unrealized_pnl': round(sum(t['open_unrealized_pnl'] for t in traders), 6),
            'realized_journal_pnl': round(sum(t['realized_journal_pnl'] for t in traders), 6),
            'open_positions_count': sum(t['open_positions_count'] for t in traders),
            'closed_trades': sum(t['closed_trades'] for t in traders),
            'avg_rr_at_open': round(
                sum((t.get('avg_rr_at_open') or 0) * t.get('rr_at_open_count', 0) for t in traders)
                / max(1, sum(t.get('rr_at_open_count', 0) for t in traders)),
                2,
            ),
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
    print(f'wrote {OUT}')

if __name__ == '__main__':
    main()

