'use client';

import { useEffect, useMemo, useState } from 'react';

type Position = {
  symbol: string; side: string; size: number; entry: number; mark: number;
  sl?: number | null; tp?: number | null; rr?: number | null; leverage: number;
  rr_at_open?: number | null; unrealized_pnl: number; opened_at?: string; protection: string;
};

type Trade = {
  symbol: string; side: string; opened_at?: string; closed_at?: string;
  entry: number; exit: number; net_pnl: number; fees: number; r_multiple: number; rr_at_open?: number | null; source: string;
};

type Point = { time?: string; value: number; label?: string };

type Trader = {
  id: string; name: string; model: string; status: string;
  start_equity: number; raw_start_equity?: number; external_cash_flow?: number;
  current_equity: number; account_performance: number; account_performance_pct: number;
  forecast_performance?: number; forecast_performance_pct?: number;
  realized_journal_pnl: number; open_unrealized_pnl: number; closed_trades: number; wins: number; losses: number;
  winrate: number; avg_rr_total?: number | null; rr_total_count?: number; avg_rr_open_positions?: number | null; rr_open_count?: number; avg_rr_closed_trades?: number | null; rr_closed_count?: number; avg_rr_at_open?: number | null; rr_at_open_count?: number; open_positions_count: number; open_positions: Position[]; closed_trade_log: Trade[];
  equity_curve: Point[]; last_trade_log_sync_at?: string; data_quality: string;
};

type DashboardData = {
  generated_at: string;
  source: string;
  traders: Trader[];
  totals: {
    start_equity: number; current_equity: number; account_performance: number; forecast_performance?: number; external_cash_flow?: number; open_unrealized_pnl: number;
    realized_journal_pnl: number; open_positions_count: number; closed_trades: number; avg_rr_total?: number | null; rr_total_count?: number; avg_rr_open_positions?: number | null; rr_open_count?: number; avg_rr_closed_trades?: number | null; rr_closed_count?: number; avg_rr_at_open?: number | null;
  };
};

const money = (v: number, digits = 2) => `${v >= 0 ? '+' : '-'}$${Math.abs(v).toFixed(digits)}`;
const usd = (v: number, digits = 2) => `$${v.toFixed(digits)}`;
const rr = (v?: number | null) => typeof v === 'number' ? `${v.toFixed(2)}R` : '—';
const compactDate = (v?: string) => v ? new Date(v).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const pnlClass = (v: number) => v >= 0 ? 'text-emerald-300' : 'text-rose-300';

function EquityChart({ traders }: { traders: Trader[] }) {
  const [hover, setHover] = useState<{ trader: string; point: Point; x: number; y: number; color: string } | null>(null);
  const colors = ['#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#fb7185'];
  const series = traders.map((t) => ({
    ...t,
    points: (t.equity_curve?.length ? t.equity_curve : [{ value: 0 }])
      .map((p) => ({ ...p, ts: p.time ? new Date(p.time).getTime() : Date.now() }))
      .filter((p) => Number.isFinite(p.ts))
      .sort((a, b) => a.ts - b.ts),
  }));
  const allPoints = series.flatMap((s) => s.points);
  const values = allPoints.map((p) => p.value);
  const rawMinTime = Math.min(...allPoints.map((p) => p.ts), Date.now());
  const rawMaxTime = Math.max(...allPoints.map((p) => p.ts), Date.now());
  const minTime = rawMinTime === rawMaxTime ? rawMinTime - 60 * 60 * 1000 : rawMinTime;
  const maxTime = rawMinTime === rawMaxTime ? rawMaxTime + 60 * 60 * 1000 : rawMaxTime;
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const valuePad = Math.max(0.5, (maxValue - minValue) * 0.12);
  const min = minValue - valuePad;
  const max = maxValue + valuePad;
  const span = max - min || 1;
  const daySpan = Math.max(1, (maxTime - minTime) / 86400000);
  const w = Math.max(980, Math.round(daySpan * 260));
  const h = 360, left = 72, right = 28, top = 28, bottom = 58;
  const plotW = w - left - right;
  const plotH = h - top - bottom;
  const x = (ts: number) => left + ((ts - minTime) / (maxTime - minTime || 1)) * plotW;
  const y = (v: number) => top + ((max - v) / span) * plotH;
  const yTicks = Array.from({ length: 6 }, (_, i) => min + (span * i) / 5);
  const xTickCount = Math.min(8, Math.max(3, Math.ceil(daySpan) + 1));
  const xTicks = Array.from({ length: xTickCount }, (_, i) => minTime + ((maxTime - minTime) * i) / (xTickCount - 1 || 1));
  const zeroY = y(0);
  const dateLabel = (ts: number) => new Date(ts).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' });

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-blue-950/20">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-blue-300/70">gesloten posities</p>
          <h2 className="text-2xl font-semibold">Gerealiseerde PnL per datum</h2>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate-300">
          {series.map((s, i) => <span key={s.id} className="flex items-center gap-2"><span className="h-2 w-5 rounded" style={{ background: colors[i % colors.length] }} />{s.name}</span>)}
        </div>
      </div>
      <div className="relative overflow-x-auto rounded-2xl border border-white/10 bg-black/25">
        {hover && <div className="pointer-events-none absolute z-10 rounded-xl border border-white/10 bg-slate-950/95 px-3 py-2 text-xs shadow-xl" style={{ left: Math.min(hover.x + 14, w - 180), top: Math.max(hover.y - 42, 8) }}>
          <div className="font-semibold" style={{ color: hover.color }}>{hover.trader}</div>
          <div>{compactDate(hover.point.time)}</div>
          <div className={pnlClass(hover.point.value)}>{money(hover.point.value)}</div>
          <div className="text-slate-400">{hover.point.label}</div>
        </div>}
        <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="block max-w-none">
          <defs>
            <linearGradient id="gridGlow" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#38bdf8" stopOpacity="0.12"/><stop offset="1" stopColor="#a78bfa" stopOpacity="0.12"/></linearGradient>
          </defs>
          <rect x="0" y="0" width={w} height={h} rx="20" fill="url(#gridGlow)" />
          {yTicks.map((tick) => <g key={`y-${tick}`}><line x1={left} x2={w-right} y1={y(tick)} y2={y(tick)} stroke="#334155" strokeOpacity="0.55" /><text x={left-12} y={y(tick)+4} textAnchor="end" fill="#94a3b8" fontSize="12">{money(tick)}</text></g>)}
          {xTicks.map((tick) => <g key={`x-${tick}`}><line x1={x(tick)} x2={x(tick)} y1={top} y2={h-bottom} stroke="#334155" strokeOpacity="0.28" /><text x={x(tick)} y={h-24} textAnchor="middle" fill="#94a3b8" fontSize="12">{dateLabel(tick)}</text></g>)}
          <line x1={left} x2={w-right} y1={zeroY} y2={zeroY} stroke="#e2e8f0" strokeOpacity="0.55" strokeDasharray="5 6" />
          <line x1={left} x2={left} y1={top} y2={h-bottom} stroke="#cbd5e1" strokeOpacity="0.65" />
          <line x1={left} x2={w-right} y1={h-bottom} y2={h-bottom} stroke="#cbd5e1" strokeOpacity="0.65" />
          <text x={left} y={16} fill="#cbd5e1" fontSize="12">PnL ($)</text>
          <text x={w-right} y={h-8} textAnchor="end" fill="#cbd5e1" fontSize="12">Datum</text>
          {series.map((s, si) => {
            const color = colors[si % colors.length];
            const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.ts)} ${y(p.value)}`).join(' ');
            return <g key={s.id}>
              <path d={d} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              {s.points.map((p, i) => <circle key={i} cx={x(p.ts)} cy={y(p.value)} r="5" fill={color} stroke="#020617" strokeWidth="2" onMouseEnter={() => setHover({ trader: s.name, point: p, x: x(p.ts), y: y(p.value), color })} onMouseLeave={() => setHover(null)} />)}
            </g>;
          })}
        </svg>
      </div>
      <p className="mt-3 text-xs text-slate-400">PNL = gesloten posities. Het laatste punt kan een forecast incl. open uPnL tonen; externe stortingen/opnames tellen niet als winst.</p>
    </div>
  );
}

function TraderCard({ trader }: { trader: Trader }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div><p className="text-sm text-slate-400">{trader.model} · {trader.status}</p><h3 className="text-2xl font-bold">{trader.name}</h3></div>
        <div className={`rounded-2xl px-4 py-2 text-right font-mono ${pnlClass(trader.account_performance)} bg-black/25`}>
          <div className="text-xl font-bold">{money(trader.account_performance)}</div>
          <div className="text-xs">{trader.account_performance_pct.toFixed(2)}%</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Start excl. storting" value={usd(trader.start_equity)} />
        <Metric label="Nu" value={usd(trader.current_equity)} />
        <Metric label="Externe cashflow" value={money(trader.external_cash_flow ?? 0)} tone={(trader.external_cash_flow ?? 0) === 0 ? 'text-slate-300' : 'text-cyan-300'} />
        <Metric label="Open uPnL" value={money(trader.open_unrealized_pnl)} tone={pnlClass(trader.open_unrealized_pnl)} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Winrate" value={`${trader.winrate.toFixed(1)}%`} />
        <Metric label="Gem. RR totaal" value={rr(trader.avg_rr_total ?? trader.avg_rr_at_open)} />
        <Metric label="RR open / gesloten" value={`${rr(trader.avg_rr_open_positions)} / ${rr(trader.avg_rr_closed_trades)}`} />
        <Metric label="RR trades bekend" value={`${trader.rr_total_count ?? trader.rr_at_open_count ?? 0}`} />
      </div>
      <p className="mt-3 text-xs text-slate-400">Open uPnL nu: <span className={pnlClass(trader.open_unrealized_pnl)}>{money(trader.open_unrealized_pnl)}</span> · PNL bovenaan telt alleen gesloten posities.</p>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <h4 className="mb-2 font-semibold text-slate-200">Open posities</h4>
          <div className="space-y-2">
            {trader.open_positions.length === 0 && <p className="rounded-xl bg-black/20 p-3 text-sm text-slate-400">Geen open posities.</p>}
            {trader.open_positions.map((p) => <div key={`${p.symbol}-${p.side}`} className="rounded-xl bg-black/25 p-3 text-sm">
              <div className="flex justify-between"><b>{p.symbol}</b><span className={p.side === 'long' ? 'text-emerald-300' : 'text-rose-300'}>{p.side.toUpperCase()} · {p.leverage}x</span></div>
              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-slate-300">
                <span>Entry {p.entry}</span><span>Mark {p.mark}</span><span>SL {p.sl ?? '—'}</span><span>TP {p.tp ?? '—'}</span><span>RR open {p.rr_at_open ?? p.rr ?? '—'}R</span><span className={pnlClass(p.unrealized_pnl)}>uPnL {money(p.unrealized_pnl)}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{p.protection} · open {compactDate(p.opened_at)}</p>
            </div>)}
          </div>
        </div>
        <div>
          <h4 className="mb-2 font-semibold text-slate-200">Laatste gesloten trades</h4>
          <div className="space-y-2">
            {trader.closed_trade_log.slice(0, 6).map((t) => <div key={`${t.symbol}-${t.closed_at}`} className="rounded-xl bg-black/25 p-3 text-sm">
              <div className="flex justify-between"><b>{t.symbol}</b><span className={pnlClass(t.net_pnl)}>{money(t.net_pnl, 4)} · gerealiseerd {t.r_multiple?.toFixed(2) ?? '—'}R</span></div>
              <p className="mt-1 text-slate-400">{t.side} · {t.entry} → {t.exit} · plan RR {t.rr_at_open?.toFixed(2) ?? '—'}R · fees ${t.fees.toFixed(4)}</p>
              <p className="text-xs text-slate-500">gesloten {compactDate(t.closed_at)} · {t.source}</p>
            </div>)}
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, tone = 'text-white' }: { label: string; value: string; tone?: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs uppercase tracking-widest text-slate-500">{label}</p><p className={`mt-1 font-mono text-lg font-bold ${tone}`}>{value}</p></div>;
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/data/dashboard.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`dashboard.json HTTP ${res.status}`);
      setData(await res.json()); setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Onbekende fout'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); const id = setInterval(fetchData, 60000); return () => clearInterval(id); }, []);
  const traders = useMemo(() => data?.traders ?? [], [data]);

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#172554,transparent_32%),linear-gradient(135deg,#020617,#0f172a_45%,#111827)] px-4 py-6 text-white md:px-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur md:flex-row md:items-end">
        <div><p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Jasper crypto traders</p><h1 className="mt-2 text-4xl font-black tracking-tight md:text-6xl">Live Performance Dashboard</h1><p className="mt-3 max-w-3xl text-slate-300">Uniek multi-trader overzicht met echte Phemex resultaten voor Trader A, Trader B en toekomstige traders. Geen demo-data.</p></div>
        <div className="text-left md:text-right"><button onClick={fetchData} className="rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-300">{loading ? 'Verversen…' : 'Refresh'}</button><p className="mt-2 text-xs text-slate-400">Update: {compactDate(data?.generated_at)}</p></div>
      </header>
      {error && <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 p-4 text-rose-200">Fout bij laden: {error}</div>}
      {data && <>
        <div className="grid gap-3 md:grid-cols-4"><Metric label="Totale equity" value={usd(data.totals.current_equity)} /><Metric label="PNL gesloten" value={money(data.totals.account_performance)} tone={pnlClass(data.totals.account_performance)} /><Metric label="Forecast incl. uPnL" value={money(data.totals.forecast_performance ?? (data.totals.account_performance + data.totals.open_unrealized_pnl))} tone={pnlClass(data.totals.forecast_performance ?? (data.totals.account_performance + data.totals.open_unrealized_pnl))} /><Metric label="Gem. RR totaal" value={`${rr(data.totals.avg_rr_total ?? data.totals.avg_rr_at_open)} · ${data.totals.rr_total_count ?? 0} trades`} /></div>
        <EquityChart traders={traders} />
        <div className="grid gap-6">{traders.map((t) => <TraderCard trader={t} key={t.id} />)}</div>
        <footer className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">Bron: {data.source}. Laatste syncs: {traders.map(t => `${t.name} ${compactDate(t.last_trade_log_sync_at)}`).join(' · ')}</footer>
      </>}
    </div>
  </main>;
}

