/**
 * Dashboard Settings - Configure trading bot options
 */

import type { Route } from './+types/dashboard.settings';
import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import {
  Settings,
  Bot,
  TrendingUp,
  Shield,
  Zap,
  Save,
  ArrowLeft,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

interface BotSettings {
  // Signal Sources
  signalSources: {
    useMarketAnalyst: boolean;
    useTradingView: boolean;
    useResearcher: boolean;
    requireMultipleSources: boolean;
  };
  // Execution
  autoExecute: boolean;
  minConfidence: number;
  maxOpenPositions: number;
  cooldownMinutes: number;
  // Risk Management
  maxPositionSizePercent: number;
  maxExposurePercent: number;
  maxLeverage: number;
  defaultStopLossPercent: number;
  maxDailyLossPercent: number;
  // TradingView
  tradingView: {
    enabled: boolean;
    apiUrl: string;
    symbol: string;
    exchange: string;
    timeframes: string[];
    requireStrongSignal: boolean;
  };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Settings - LN Markets Trading Bot' },
  ];
}

export default function DashboardSettings() {
  const [settings, setSettings] = useState<BotSettings>({
    signalSources: {
      useMarketAnalyst: true,
      useTradingView: true,
      useResearcher: false,
      requireMultipleSources: false,
    },
    autoExecute: false,
    minConfidence: 70,
    maxOpenPositions: 3,
    cooldownMinutes: 1,
    maxPositionSizePercent: 10,
    maxExposurePercent: 50,
    maxLeverage: 25,
    defaultStopLossPercent: 5,
    maxDailyLossPercent: 10,
    tradingView: {
      enabled: true,
      apiUrl: '',
      symbol: 'BTCUSD',
      exchange: 'COINBASE',
      timeframes: ['1h', '4h'],
      requireStrongSignal: false,
    },
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    
    try {
      // Save settings via API
      const response = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_settings',
          settings,
        }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) => (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
        enabled ? 'bg-green-600/20 text-green-400' : 'bg-gray-700 text-gray-400'
      }`}
    >
      {enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="p-2 hover:bg-gray-700 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Settings className="w-6 h-6 text-orange-500" />
            <h1 className="text-xl font-bold">Bot Settings</h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </header>

      {message && (
        <div className={`px-4 py-3 ${message.type === 'success' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
          <div className="max-w-4xl mx-auto">
            {message.text}
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Signal Sources */}
        <section className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-semibold">Signal Sources</h2>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            Choose which signal sources the bot should use for trading decisions.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Toggle
              enabled={settings.signalSources.useMarketAnalyst}
              onToggle={() => setSettings({
                ...settings,
                signalSources: { ...settings.signalSources, useMarketAnalyst: !settings.signalSources.useMarketAnalyst }
              })}
              label="Market Analyst (TA)"
            />
            <Toggle
              enabled={settings.signalSources.useTradingView}
              onToggle={() => setSettings({
                ...settings,
                signalSources: { ...settings.signalSources, useTradingView: !settings.signalSources.useTradingView }
              })}
              label="TradingView Signals"
            />
            <Toggle
              enabled={settings.signalSources.useResearcher}
              onToggle={() => setSettings({
                ...settings,
                signalSources: { ...settings.signalSources, useResearcher: !settings.signalSources.useResearcher }
              })}
              label="News Sentiment"
            />
            <Toggle
              enabled={settings.signalSources.requireMultipleSources}
              onToggle={() => setSettings({
                ...settings,
                signalSources: { ...settings.signalSources, requireMultipleSources: !settings.signalSources.requireMultipleSources }
              })}
              label="Require Multiple Sources"
            />
          </div>
        </section>

        {/* Execution Settings */}
        <section className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-semibold">Execution</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Auto-Execute Trades</div>
                <div className="text-sm text-gray-400">⚠️ Enable automatic trade execution</div>
              </div>
              <Toggle
                enabled={settings.autoExecute}
                onToggle={() => setSettings({ ...settings, autoExecute: !settings.autoExecute })}
                label={settings.autoExecute ? 'ON' : 'OFF'}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Min Confidence (%)</label>
                <input
                  type="number"
                  value={settings.minConfidence}
                  onChange={(e) => setSettings({ ...settings, minConfidence: Number(e.target.value) })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  min={0}
                  max={100}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Max Open Positions</label>
                <input
                  type="number"
                  value={settings.maxOpenPositions}
                  onChange={(e) => setSettings({ ...settings, maxOpenPositions: Number(e.target.value) })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  min={1}
                  max={10}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Cooldown (minutes)</label>
                <input
                  type="number"
                  value={settings.cooldownMinutes}
                  onChange={(e) => setSettings({ ...settings, cooldownMinutes: Number(e.target.value) })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  min={0}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Risk Management */}
        <section className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-semibold">Risk Management</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Max Position Size (%)</label>
              <input
                type="number"
                value={settings.maxPositionSizePercent}
                onChange={(e) => setSettings({ ...settings, maxPositionSizePercent: Number(e.target.value) })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                min={1}
                max={100}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Max Total Exposure (%)</label>
              <input
                type="number"
                value={settings.maxExposurePercent}
                onChange={(e) => setSettings({ ...settings, maxExposurePercent: Number(e.target.value) })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                min={1}
                max={100}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Max Leverage</label>
              <input
                type="number"
                value={settings.maxLeverage}
                onChange={(e) => setSettings({ ...settings, maxLeverage: Number(e.target.value) })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                min={1}
                max={100}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Default Stop Loss (%)</label>
              <input
                type="number"
                value={settings.defaultStopLossPercent}
                onChange={(e) => setSettings({ ...settings, defaultStopLossPercent: Number(e.target.value) })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                min={0.5}
                max={50}
                step={0.5}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Max Daily Loss (%) - Stop trading after this loss</label>
              <input
                type="number"
                value={settings.maxDailyLossPercent}
                onChange={(e) => setSettings({ ...settings, maxDailyLossPercent: Number(e.target.value) })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                min={1}
                max={100}
              />
            </div>
          </div>
        </section>

        {/* TradingView Settings */}
        <section className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-semibold">TradingView Integration</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Enable TradingView Signals</div>
                <div className="text-sm text-gray-400">Fetch signals from TradingView TA API</div>
              </div>
              <Toggle
                enabled={settings.tradingView.enabled}
                onToggle={() => setSettings({
                  ...settings,
                  tradingView: { ...settings.tradingView, enabled: !settings.tradingView.enabled }
                })}
                label={settings.tradingView.enabled ? 'ON' : 'OFF'}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">TradingView API URL</label>
              <input
                type="text"
                value={settings.tradingView.apiUrl}
                onChange={(e) => setSettings({
                  ...settings,
                  tradingView: { ...settings.tradingView, apiUrl: e.target.value }
                })}
                placeholder="http://localhost:8080 or your TradingView TA API"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Symbol</label>
                <input
                  type="text"
                  value={settings.tradingView.symbol}
                  onChange={(e) => setSettings({
                    ...settings,
                    tradingView: { ...settings.tradingView, symbol: e.target.value }
                  })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Exchange</label>
                <input
                  type="text"
                  value={settings.tradingView.exchange}
                  onChange={(e) => setSettings({
                    ...settings,
                    tradingView: { ...settings.tradingView, exchange: e.target.value }
                  })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                />
              </div>
            </div>
            <Toggle
              enabled={settings.tradingView.requireStrongSignal}
              onToggle={() => setSettings({
                ...settings,
                tradingView: { ...settings.tradingView, requireStrongSignal: !settings.tradingView.requireStrongSignal }
              })}
              label="Require STRONG signals only"
            />
          </div>
        </section>
      </main>
    </div>
  );
}
