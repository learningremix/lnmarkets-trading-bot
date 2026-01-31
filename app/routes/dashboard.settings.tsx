/**
 * Dashboard Settings - Configure trading bot options (DB-backed)
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
  RefreshCw,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

interface TradingSettings {
  // Swarm Control
  autoStartSwarm: boolean;
  autoExecuteTrades: boolean;
  
  // Execution
  minTradeConfidence: number;
  maxOpenPositions: number;
  tradeCooldownMinutes: number;
  
  // Risk Management
  maxPositionSizePercent: number;
  maxExposurePercent: number;
  maxLeverage: number;
  defaultStopLossPercent: number;
  defaultTakeProfitPercent: number;
  maxDailyLossPercent: number;
  
  // Signal Sources
  useMarketAnalyst: boolean;
  useTradingView: boolean;
  useResearcher: boolean;
  requireMultipleSources: boolean;
  
  // TradingView
  tradingViewEnabled: boolean;
  tradingViewApiUrl: string;
  tradingViewSymbol: string;
  tradingViewExchange: string;
  tradingViewTimeframes: string[];
  tradingViewRequireStrong: boolean;
  
  // Optional Features
  enableOnChainMetrics: boolean;
  enableTelegramNotifications: boolean;
  telegramChatId: string;
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Settings - LN Markets Trading Bot' },
  ];
}

export default function DashboardSettings() {
  const [settings, setSettings] = useState<TradingSettings | null>(null);
  const [defaults, setDefaults] = useState<TradingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load settings from API
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings');
      const data = await response.json();
      
      if (data.success) {
        setSettings(data.data.settings);
        setDefaults(data.data.defaults);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to connect to server' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    
    setSaving(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
        setSettings(data.data);
      } else {
        throw new Error(data.error || 'Failed to save');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset all settings to defaults? This cannot be undone.')) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });

      const data = await response.json();
      
      if (data.success) {
        setSettings(data.data);
        setMessage({ type: 'success', text: 'Settings reset to defaults' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to reset settings' });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof TradingSettings>(key: K, value: TradingSettings[K]) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const Toggle = ({ enabled, onToggle, label, warning }: { enabled: boolean; onToggle: () => void; label: string; warning?: boolean }) => (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
        enabled 
          ? warning 
            ? 'bg-orange-600/20 text-orange-400' 
            : 'bg-green-600/20 text-green-400' 
          : 'bg-gray-700 text-gray-400'
      }`}
    >
      {enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
      {label}
    </button>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-orange-500">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <span className="text-xl">Loading settings...</span>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl text-white mb-2">Failed to load settings</h1>
          <button onClick={loadSettings} className="text-orange-500 hover:underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

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
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              disabled={saving}
              className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </header>

      {message && (
        <div className={`px-4 py-3 ${message.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
          <div className="max-w-4xl mx-auto flex items-center gap-2">
            {message.type === 'error' && <AlertTriangle className="w-4 h-4" />}
            {message.text}
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Swarm Control */}
        <section className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-semibold">Swarm Control</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Auto-Start Swarm</div>
                <div className="text-sm text-gray-400">Start trading agents automatically when server starts</div>
              </div>
              <Toggle
                enabled={settings.autoStartSwarm}
                onToggle={() => updateSetting('autoStartSwarm', !settings.autoStartSwarm)}
                label={settings.autoStartSwarm ? 'ON' : 'OFF'}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium flex items-center gap-2">
                  Auto-Execute Trades
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                </div>
                <div className="text-sm text-gray-400">⚠️ Automatically execute trades based on signals</div>
              </div>
              <Toggle
                enabled={settings.autoExecuteTrades}
                onToggle={() => updateSetting('autoExecuteTrades', !settings.autoExecuteTrades)}
                label={settings.autoExecuteTrades ? 'ON' : 'OFF'}
                warning
              />
            </div>
          </div>
        </section>

        {/* Signal Sources */}
        <section className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-semibold">Signal Sources</h2>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            Choose which signal sources the bot should use for trading decisions.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Toggle
              enabled={settings.useMarketAnalyst}
              onToggle={() => updateSetting('useMarketAnalyst', !settings.useMarketAnalyst)}
              label="Market Analyst (TA)"
            />
            <Toggle
              enabled={settings.useTradingView}
              onToggle={() => updateSetting('useTradingView', !settings.useTradingView)}
              label="TradingView Signals"
            />
            <Toggle
              enabled={settings.useResearcher}
              onToggle={() => updateSetting('useResearcher', !settings.useResearcher)}
              label="News Sentiment"
            />
            <Toggle
              enabled={settings.requireMultipleSources}
              onToggle={() => updateSetting('requireMultipleSources', !settings.requireMultipleSources)}
              label="Require Agreement"
            />
          </div>
        </section>

        {/* Execution Settings */}
        <section className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-semibold">Execution Settings</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Min Confidence (%)</label>
              <input
                type="number"
                value={settings.minTradeConfidence}
                onChange={(e) => updateSetting('minTradeConfidence', Number(e.target.value))}
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
                onChange={(e) => updateSetting('maxOpenPositions', Number(e.target.value))}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                min={1}
                max={10}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Cooldown (minutes)</label>
              <input
                type="number"
                value={settings.tradeCooldownMinutes}
                onChange={(e) => updateSetting('tradeCooldownMinutes', Number(e.target.value))}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                min={0}
              />
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
                onChange={(e) => updateSetting('maxPositionSizePercent', Number(e.target.value))}
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
                onChange={(e) => updateSetting('maxExposurePercent', Number(e.target.value))}
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
                onChange={(e) => updateSetting('maxLeverage', Number(e.target.value))}
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
                onChange={(e) => updateSetting('defaultStopLossPercent', Number(e.target.value))}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                min={0.5}
                max={50}
                step={0.5}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Default Take Profit (%)</label>
              <input
                type="number"
                value={settings.defaultTakeProfitPercent}
                onChange={(e) => updateSetting('defaultTakeProfitPercent', Number(e.target.value))}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                min={0.5}
                max={100}
                step={0.5}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Max Daily Loss (%)</label>
              <input
                type="number"
                value={settings.maxDailyLossPercent}
                onChange={(e) => updateSetting('maxDailyLossPercent', Number(e.target.value))}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                min={1}
                max={100}
              />
              <div className="text-xs text-gray-500 mt-1">Trading stops after this loss</div>
            </div>
          </div>
        </section>

        {/* TradingView Integration */}
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
                enabled={settings.tradingViewEnabled}
                onToggle={() => updateSetting('tradingViewEnabled', !settings.tradingViewEnabled)}
                label={settings.tradingViewEnabled ? 'ON' : 'OFF'}
              />
            </div>
            
            {settings.tradingViewEnabled && (
              <>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">TradingView API URL</label>
                  <input
                    type="text"
                    value={settings.tradingViewApiUrl}
                    onChange={(e) => updateSetting('tradingViewApiUrl', e.target.value)}
                    placeholder="http://localhost:8080"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Symbol</label>
                    <input
                      type="text"
                      value={settings.tradingViewSymbol}
                      onChange={(e) => updateSetting('tradingViewSymbol', e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Exchange</label>
                    <input
                      type="text"
                      value={settings.tradingViewExchange}
                      onChange={(e) => updateSetting('tradingViewExchange', e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                    />
                  </div>
                </div>
                <Toggle
                  enabled={settings.tradingViewRequireStrong}
                  onToggle={() => updateSetting('tradingViewRequireStrong', !settings.tradingViewRequireStrong)}
                  label="Require STRONG signals only"
                />
              </>
            )}
          </div>
        </section>

        {/* Optional Features */}
        <section className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-semibold">Optional Features</h2>
          </div>
          <div className="space-y-4">
            <Toggle
              enabled={settings.enableOnChainMetrics}
              onToggle={() => updateSetting('enableOnChainMetrics', !settings.enableOnChainMetrics)}
              label="Enable On-Chain Metrics"
            />
            <div className="flex items-center justify-between">
              <Toggle
                enabled={settings.enableTelegramNotifications}
                onToggle={() => updateSetting('enableTelegramNotifications', !settings.enableTelegramNotifications)}
                label="Telegram Notifications"
              />
            </div>
            {settings.enableTelegramNotifications && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Telegram Chat ID</label>
                <input
                  type="text"
                  value={settings.telegramChatId}
                  onChange={(e) => updateSetting('telegramChatId', e.target.value)}
                  placeholder="Your Telegram chat ID"
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                />
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
