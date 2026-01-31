/**
 * Dashboard Route - Main trading dashboard
 */

import type { Route } from './+types/dashboard';
import { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Wallet,
  BarChart3,
  Bot,
  AlertTriangle,
  PlayCircle,
  StopCircle,
  RefreshCw,
  Zap,
  Settings,
} from 'lucide-react';

interface SwarmStatus {
  running: boolean;
  authenticated: boolean;
  agents: {
    id: string;
    name: string;
    type: string;
    status: string;
    enabled: boolean;
    lastRunAt: string | null;
  }[];
  balance?: number;
  openPositions?: number;
  dailyPL?: number;
}

interface MarketData {
  ticker: {
    index: number;
    lastPrice: number;
    bid: number;
    ask: number;
    high24h: number;
    low24h: number;
    volume24h: number;
    change24h: number;
  };
  oracle: {
    price: number;
    index: number;
  };
  analysis: Record<string, any> | null;
}

interface Position {
  id: string;
  side: 'buy' | 'sell';
  quantity: number;
  margin: number;
  leverage: number;
  entryPrice: number;
  liquidationPrice: number;
  pl: number;
  plPercent: number;
  createdAt: string;
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'LN Markets Trading Bot - Dashboard' },
    { name: 'description', content: 'Bitcoin trading bot dashboard for LN Markets' },
  ];
}

export default function Dashboard() {
  const [status, setStatus] = useState<SwarmStatus | null>(null);
  const [market, setMarket] = useState<MarketData | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, marketRes, positionsRes] = await Promise.all([
        fetch('/api/status'),
        fetch('/api/market'),
        fetch('/api/positions'),
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData.data);
      }

      if (marketRes.ok) {
        const marketData = await marketRes.json();
        setMarket(marketData.data);
      }

      if (positionsRes.ok) {
        const positionsData = await positionsRes.json();
        setPositions(positionsData.data?.positions || []);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh]);

  const formatSats = (sats: number) => {
    if (sats >= 100000000) {
      return `${(sats / 100000000).toFixed(4)} BTC`;
    }
    return `${sats.toLocaleString()} sats`;
  };

  const formatPrice = (price: number) => {
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle':
        return 'bg-green-500';
      case 'analyzing':
      case 'executing':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      case 'disabled':
        return 'bg-gray-500';
      default:
        return 'bg-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-orange-500">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <span className="text-xl">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="w-8 h-8 text-orange-500" />
            <h1 className="text-2xl font-bold">LN Markets Trading Bot</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-3 py-2 rounded ${
                autoRefresh ? 'bg-green-600' : 'bg-gray-600'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </button>
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded ${
                status?.running ? 'bg-green-600' : 'bg-red-600'
              }`}
            >
              {status?.running ? (
                <PlayCircle className="w-4 h-4" />
              ) : (
                <StopCircle className="w-4 h-4" />
              )}
              {status?.running ? 'Running' : 'Stopped'}
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-red-500/20 border-b border-red-500 px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <span className="text-red-200">{error}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Balance */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400">Balance</span>
              <Wallet className="w-5 h-5 text-orange-500" />
            </div>
            <div className="text-2xl font-bold">
              {status?.balance ? formatSats(status.balance) : '—'}
            </div>
          </div>

          {/* BTC Price */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400">BTC Price</span>
              <Activity className="w-5 h-5 text-orange-500" />
            </div>
            <div className="text-2xl font-bold">
              {market?.ticker ? formatPrice(market.ticker.lastPrice) : '—'}
            </div>
            {market?.ticker && (
              <div
                className={`text-sm flex items-center gap-1 ${
                  market.ticker.change24h >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {market.ticker.change24h >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {market.ticker.change24h.toFixed(2)}%
              </div>
            )}
          </div>

          {/* Open Positions */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400">Open Positions</span>
              <BarChart3 className="w-5 h-5 text-orange-500" />
            </div>
            <div className="text-2xl font-bold">{positions.length}</div>
          </div>

          {/* Daily P&L */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400">Daily P&L</span>
              {status?.dailyPL !== undefined && status.dailyPL >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-500" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-500" />
              )}
            </div>
            <div
              className={`text-2xl font-bold ${
                status?.dailyPL !== undefined
                  ? status.dailyPL >= 0
                    ? 'text-green-400'
                    : 'text-red-400'
                  : ''
              }`}
            >
              {status?.dailyPL !== undefined
                ? `${status.dailyPL >= 0 ? '+' : ''}${formatSats(status.dailyPL)}`
                : '—'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agents Status */}
          <div className="lg:col-span-1 bg-gray-800 rounded-lg border border-gray-700">
            <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
              <Bot className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-semibold">Trading Agents</h2>
            </div>
            <div className="p-4 space-y-3">
              {status?.agents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
                >
                  <div>
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-sm text-gray-400">
                      {agent.lastRunAt
                        ? `Last run: ${new Date(agent.lastRunAt).toLocaleTimeString()}`
                        : 'Not run yet'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`}
                    />
                    <span className="text-sm text-gray-300 capitalize">{agent.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Open Positions */}
          <div className="lg:col-span-2 bg-gray-800 rounded-lg border border-gray-700">
            <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-semibold">Open Positions</h2>
              </div>
              {positions.length > 0 && (
                <button
                  onClick={async () => {
                    const formData = new FormData();
                    formData.set('action', 'closeAll');
                    await fetch('/api/positions', { method: 'POST', body: formData });
                    fetchData();
                  }}
                  className="text-sm px-3 py-1 bg-red-600 hover:bg-red-700 rounded"
                >
                  Close All
                </button>
              )}
            </div>
            <div className="p-4">
              {positions.length === 0 ? (
                <div className="text-center text-gray-400 py-8">No open positions</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-gray-400 text-sm">
                        <th className="pb-3">Side</th>
                        <th className="pb-3">Entry</th>
                        <th className="pb-3">Margin</th>
                        <th className="pb-3">Leverage</th>
                        <th className="pb-3">P&L</th>
                        <th className="pb-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {positions.map((pos) => (
                        <tr key={pos.id}>
                          <td className="py-3">
                            <span
                              className={`px-2 py-1 rounded text-sm font-medium ${
                                pos.side === 'buy'
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-red-500/20 text-red-400'
                              }`}
                            >
                              {pos.side === 'buy' ? 'LONG' : 'SHORT'}
                            </span>
                          </td>
                          <td className="py-3">{formatPrice(pos.entryPrice)}</td>
                          <td className="py-3">{formatSats(pos.margin)}</td>
                          <td className="py-3">{pos.leverage}x</td>
                          <td className="py-3">
                            <span
                              className={
                                pos.pl >= 0 ? 'text-green-400' : 'text-red-400'
                              }
                            >
                              {pos.pl >= 0 ? '+' : ''}
                              {formatSats(pos.pl)} ({pos.plPercent.toFixed(2)}%)
                            </span>
                          </td>
                          <td className="py-3">
                            <button
                              onClick={async () => {
                                const formData = new FormData();
                                formData.set('action', 'close');
                                formData.set('positionId', pos.id);
                                await fetch('/api/positions', { method: 'POST', body: formData });
                                fetchData();
                              }}
                              className="text-sm px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded"
                            >
                              Close
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Market Analysis */}
        {market?.analysis && (
          <div className="mt-6 bg-gray-800 rounded-lg border border-gray-700">
            <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-semibold">Market Analysis</h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(market.analysis).map(([timeframe, analysis]: [string, any]) => (
                  <div key={timeframe} className="bg-gray-700/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium">{timeframe} Analysis</span>
                      <span
                        className={`px-2 py-1 rounded text-sm ${
                          analysis.technicalSummary?.signal?.includes('buy')
                            ? 'bg-green-500/20 text-green-400'
                            : analysis.technicalSummary?.signal?.includes('sell')
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}
                      >
                        {analysis.technicalSummary?.signal?.toUpperCase() || 'N/A'}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">RSI</span>
                        <span>{analysis.technicalSummary?.indicators?.rsi?.toFixed(1) || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Trend</span>
                        <span className="capitalize">
                          {analysis.technicalSummary?.trend?.trend || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Score</span>
                        <span>{analysis.technicalSummary?.score || '—'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
