'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';

interface Strategy {
  name: string;
  equity: number;
  pnl: number;
  pnl_percentage: number;
  status: 'active' | 'paused' | 'error';
  open_positions: number;
  positions?: Position[];
}

interface Position {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entry_price: number;
  current_price: number;
  pnl: number;
  opened_at: string;
}

interface PlatformData {
  total_equity: number;
  total_pnl: number;
  pnl_percentage: number;
  strategies: Strategy[];
  last_updated: string;
}

interface DashboardData {
  generated_at: string;
  platforms: {
    phemex?: PlatformData;
    hyperliquid?: PlatformData;
    okx?: PlatformData;
  };
}

export default function PlatformPage({ params }: { params: Promise<{ platform: string }> }) {
  const { platform } = use(params);
  const [data, setData] = useState<PlatformData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/data/dashboard.json?t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (!res.ok) throw new Error('Failed to fetch data');
      const result: DashboardData = await res.json();
      const platformData = result.platforms[platform as keyof typeof result.platforms];
      if (!platformData) throw new Error(`No data for platform: ${platform}`);
      setData(platformData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [platform]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading {platform} data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Link href="/" className="text-blue-400 hover:underline">← Back to dashboard</Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold capitalize">{platform}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400">
              Updated: {new Date(data.last_updated).toLocaleTimeString()}
            </span>
            <span className={`w-2 h-2 rounded-full ${data.strategies.some(s => s.status === 'active') ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
            <p className="text-gray-400 text-sm mb-2">Total Equity</p>
            <p className="text-3xl font-bold font-mono">${data.total_equity.toLocaleString()}</p>
          </div>
          <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
            <p className="text-gray-400 text-sm mb-2">Total PnL</p>
            <p className={`text-3xl font-bold font-mono ${data.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.total_pnl >= 0 ? '+' : ''}{data.total_pnl.toFixed(2)}
            </p>
            <p className={`text-sm ${data.pnl_percentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.pnl_percentage.toFixed(2)}%
            </p>
          </div>
          <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
            <p className="text-gray-400 text-sm mb-2">Active Strategies</p>
            <p className="text-3xl font-bold font-mono">{data.strategies.filter(s => s.status === 'active').length} / {data.strategies.length}</p>
          </div>
        </div>

        {/* Strategies */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Strategies</h2>
          <div className="space-y-4">
            {data.strategies.map((strategy, idx) => (
              <div
                key={idx}
                className="p-6 bg-gray-900 border border-gray-800 rounded-xl hover:border-blue-500/50 transition-all cursor-pointer"
                onClick={() => setSelectedStrategy(selectedStrategy === strategy.name ? null : strategy.name)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{strategy.name}</h3>
                    <p className="text-sm text-gray-400">{strategy.open_positions} open positions</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg">${strategy.equity.toLocaleString()}</p>
                    <p className={`font-mono ${strategy.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {strategy.pnl >= 0 ? '+' : ''}{strategy.pnl.toFixed(2)} ({strategy.pnl_percentage.toFixed(2)}%)
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    strategy.status === 'active' ? 'bg-green-900/50 text-green-400' :
                    strategy.status === 'paused' ? 'bg-yellow-900/50 text-yellow-400' :
                    'bg-red-900/50 text-red-400'
                  }`}>
                    {strategy.status.toUpperCase()}
                  </span>
                </div>

                {/* Expanded Positions */}
                {selectedStrategy === strategy.name && strategy.positions && strategy.positions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Open Positions</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-400 border-b border-gray-800">
                            <th className="text-left py-2">Symbol</th>
                            <th className="text-left">Side</th>
                            <th className="text-right">Size</th>
                            <th className="text-right">Entry</th>
                            <th className="text-right">Current</th>
                            <th className="text-right">PnL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {strategy.positions.map((pos, pIdx) => (
                            <tr key={pIdx} className="border-b border-gray-800/50">
                              <td className="py-2 font-mono">{pos.symbol}</td>
                              <td className={`uppercase ${pos.side === 'long' ? 'text-green-400' : 'text-red-400'}`}>{pos.side}</td>
                              <td className="text-right font-mono">{pos.size}</td>
                              <td className="text-right font-mono">${pos.entry_price.toLocaleString()}</td>
                              <td className="text-right font-mono">${pos.current_price.toLocaleString()}</td>
                              <td className={`text-right font-mono ${pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
