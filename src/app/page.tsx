'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface PlatformData {
  total_equity: number;
  total_pnl: number;
  pnl_percentage: number;
  strategies: Strategy[];
  last_updated: string;
}

interface Strategy {
  name: string;
  equity: number;
  pnl: number;
  pnl_percentage: number;
  status: 'active' | 'paused' | 'error';
  open_positions: number;
}

interface DashboardData {
  generated_at: string;
  platforms: {
    phemex?: PlatformData;
    hyperliquid?: PlatformData;
    okx?: PlatformData;
  };
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/data/dashboard.json?t=' + Date.now(), {
        cache: 'no-store'
      });
      if (!res.ok) throw new Error('Failed to fetch data');
      const result = await res.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const platforms = data?.platforms || {};
  const platformKeys = Object.keys(platforms);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Trading Dashboard
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            {data && (
              <span className="text-xs text-gray-400">
                Last updated: {new Date(data.generated_at).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300">
            <p>Error loading data: {error}</p>
            <p className="text-sm text-red-400 mt-1">Make sure dashboard.json exists in public/data/</p>
          </div>
        )}

        {/* Platform Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {platformKeys.map((platformKey) => {
            const platform = platforms[platformKey as keyof typeof platforms];
            if (!platform) return null;
            
            return (
              <Link
                key={platformKey}
                href={`/${platformKey}`}
                className="block p-6 bg-gray-900 border border-gray-800 rounded-xl hover:border-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-500/10"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold capitalize">{platformKey}</h2>
                  <span className={`w-2 h-2 rounded-full ${platform.strategies.some(s => s.status === 'active') ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Equity</span>
                    <span className="font-mono">${platform.total_equity.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">PnL</span>
                    <span className={`font-mono ${platform.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {platform.total_pnl >= 0 ? '+' : ''}{platform.total_pnl.toFixed(2)} ({platform.pnl_percentage.toFixed(2)}%)
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Strategies</span>
                    <span className="text-gray-300">{platform.strategies.length} active</span>
                  </div>
                </div>
              </Link>
            );
          })}
          
          {platformKeys.length === 0 && (
            <div className="col-span-full p-8 bg-gray-900 border border-gray-800 rounded-xl text-center text-gray-400">
              No platforms configured yet. Add data to public/data/dashboard.json
            </div>
          )}
        </div>

        {/* Quick Stats */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
              <p className="text-gray-400 text-sm">Total Equity</p>
              <p className="text-2xl font-bold font-mono">
                ${Object.values(platforms).reduce((sum, p) => sum + (p?.total_equity || 0), 0).toLocaleString()}
              </p>
            </div>
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
              <p className="text-gray-400 text-sm">Total PnL</p>
              <p className={`text-2xl font-bold font-mono ${Object.values(platforms).reduce((sum, p) => sum + (p?.total_pnl || 0), 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {Object.values(platforms).reduce((sum, p) => sum + (p?.total_pnl || 0), 0).toFixed(2)}
              </p>
            </div>
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
              <p className="text-gray-400 text-sm">Platforms</p>
              <p className="text-2xl font-bold font-mono">{platformKeys.length}</p>
            </div>
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
              <p className="text-gray-400 text-sm">Strategies</p>
              <p className="text-2xl font-bold font-mono">
                {Object.values(platforms).reduce((sum, p) => sum + (p?.strategies.length || 0), 0)}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
