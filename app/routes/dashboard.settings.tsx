/**
 * Settings Route - Configure the trading bot
 */

import type { Route } from './+types/dashboard.settings';
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router';
import {
  Settings,
  Save,
  RefreshCw,
  ArrowLeft,
  Zap,
  Shield,
  Bot,
  TrendingUp,
  Bell,
  Wrench,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

interface AppSettings {
  lnmarketsKey: string;
  lnmarketsSecret: string;
  lnmarketsPassphrase: string;
  lnmarketsNetwork: 'mainnet' | 'testnet';
  autoStartSwarm: boolean;
  autoExecuteTrades: boolean;
  minTradeConfidence: number;
  maxOpenPositions: number;
  tradeCooldownMinutes: number;
  maxPositionSizePercent: number;
  maxExposurePercent: number;
  maxLeverage: number;
  defaultStopLossPercent: number;
  defaultTakeProfitPercent: number;
  maxDailyLossPercent: number;
  useMarketAnalyst: boolean;
  useTradingView: boolean;
  useResearcher: boolean;
  requireMultipleSources: boolean;
  tradingViewEnabled: boolean;
  tradingViewApiUrl: string;
  tradingViewSymbol: string;
  tradingViewExchange: string;
  tradingViewTimeframes: string[];
  tradingViewRequireStrong: boolean;
  enableTelegramNotifications: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  enableOnChainMetrics: boolean;
  controlApiKey: string;
  debugMode: boolean;
}

interface ConfigStatus {
  lnMarketsConfigured: boolean;
  network: string;
  autoStartSwarm: boolean;
  autoExecuteTrades: boolean;
  tradingViewEnabled: boolean;
  debugMode: boolean;
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Settings - LN Markets Trading Bot' },
    { name: 'description', content: 'Configure your trading bot settings' },
  ];
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [status, setStatus] = useState<ConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);
  const [activeTab, setActiveTab] = useState('lnmarkets');

  const fetchSettings = useCallback(async () => {
    try {
      const [settingsRes, statusRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/settings?action=status'),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data.data.settings);
      }

      if (statusRes.ok) {
        const data = await statusRes.json();
        setStatus(data.data);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async (updates: Partial<AppSettings>) => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess('Settings saved successfully');
        await fetchSettings();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to save settings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const configureLNMarkets = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    await saveSettings({
      lnmarketsKey: formData.get('apiKey') as string,
      lnmarketsSecret: formData.get('apiSecret') as string,
      lnmarketsPassphrase: formData.get('passphrase') as string,
      lnmarketsNetwork: formData.get('network') as 'mainnet' | 'testnet',
    });
  };

  const updateSetting = (key: keyof AppSettings, value: any) => {
    if (settings) {
      setSettings({ ...settings, [key]: value });
    }
  };

  const tabs = [
    { id: 'lnmarkets', label: 'LN Markets', icon: Zap },
    { id: 'swarm', label: 'Swarm Control', icon: Bot },
    { id: 'risk', label: 'Risk Management', icon: Shield },
    { id: 'signals', label: 'Signal Sources', icon: TrendingUp },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'advanced', label: 'Advanced', icon: Wrench },
  ];

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

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
              Dashboard
            </Link>
            <div className="flex items-center gap-2">
              <Settings className="w-6 h-6 text-orange-500" />
              <h1 className="text-xl font-bold">Settings</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {status?.lnMarketsConfigured ? (
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm">LN Markets Connected ({status.network})</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-yellow-400">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-sm">LN Markets Not Configured</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Alerts */}
      {error && (
        <div className="bg-red-500/20 border-b border-red-500 px-4 py-3 flex items-center gap-2 max-w-5xl mx-auto">
          <XCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-200">{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-green-500/20 border-b border-green-500 px-4 py-3 flex items-center gap-2 max-w-5xl mx-auto">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <span className="text-green-200">{success}</span>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar Tabs */}
          <div className="w-48 flex-shrink-0">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition ${
                    activeTab === tab.id
                      ? 'bg-orange-500 text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 bg-gray-800 rounded-lg border border-gray-700 p-6">
            {/* LN Markets Tab */}
            {activeTab === 'lnmarkets' && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-orange-500" />
                  LN Markets API Configuration
                </h2>
                <p className="text-gray-400 mb-6">
                  Connect your LN Markets account to enable trading. Get your API credentials from{' '}
                  <a href="https://lnmarkets.com/user/api" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">
                    lnmarkets.com/user/api
                  </a>
                </p>

                <form onSubmit={configureLNMarkets} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">API Key</label>
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      name="apiKey"
                      defaultValue={settings?.lnmarketsKey === '••••••••' ? '' : settings?.lnmarketsKey}
                      placeholder="Enter your API key"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">API Secret</label>
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      name="apiSecret"
                      defaultValue={settings?.lnmarketsSecret === '••••••••' ? '' : settings?.lnmarketsSecret}
                      placeholder="Enter your API secret"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Passphrase</label>
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      name="passphrase"
                      defaultValue={settings?.lnmarketsPassphrase === '••••••••' ? '' : settings?.lnmarketsPassphrase}
                      placeholder="Enter your passphrase"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Network</label>
                    <select
                      name="network"
                      defaultValue={settings?.lnmarketsNetwork || 'testnet'}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="testnet">Testnet (Paper Trading)</option>
                      <option value="mainnet">Mainnet (Real Money)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <button
                      type="button"
                      onClick={() => setShowSecrets(!showSecrets)}
                      className="flex items-center gap-2 text-gray-400 hover:text-white"
                    >
                      {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {showSecrets ? 'Hide' : 'Show'} credentials
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg disabled:opacity-50"
                    >
                      {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save API Credentials
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Swarm Control Tab */}
            {activeTab === 'swarm' && settings && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-orange-500" />
                  Swarm Control
                </h2>

                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                    <div>
                      <div className="font-medium">Auto-Start Swarm</div>
                      <div className="text-sm text-gray-400">Start trading agents automatically when the server starts</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.autoStartSwarm}
                        onChange={(e) => saveSettings({ autoStartSwarm: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-orange-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div>
                      <div className="font-medium text-red-400">⚠️ Auto-Execute Trades</div>
                      <div className="text-sm text-gray-400">Automatically execute trades when signals are generated</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.autoExecuteTrades}
                        onChange={(e) => {
                          if (e.target.checked && !confirm('Are you sure? This will enable automatic trading with real funds!')) {
                            return;
                          }
                          saveSettings({ autoExecuteTrades: e.target.checked });
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-red-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Min Trade Confidence</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={settings.minTradeConfidence}
                        onChange={(e) => updateSetting('minTradeConfidence', parseInt(e.target.value))}
                        onBlur={() => saveSettings({ minTradeConfidence: settings.minTradeConfidence })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Max Open Positions</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={settings.maxOpenPositions}
                        onChange={(e) => updateSetting('maxOpenPositions', parseInt(e.target.value))}
                        onBlur={() => saveSettings({ maxOpenPositions: settings.maxOpenPositions })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Trade Cooldown (minutes)</label>
                      <input
                        type="number"
                        min="0"
                        max="60"
                        value={settings.tradeCooldownMinutes}
                        onChange={(e) => updateSetting('tradeCooldownMinutes', parseInt(e.target.value))}
                        onBlur={() => saveSettings({ tradeCooldownMinutes: settings.tradeCooldownMinutes })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Risk Management Tab */}
            {activeTab === 'risk' && settings && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-orange-500" />
                  Risk Management
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Max Position Size (%)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={settings.maxPositionSizePercent}
                      onChange={(e) => updateSetting('maxPositionSizePercent', parseInt(e.target.value))}
                      onBlur={() => saveSettings({ maxPositionSizePercent: settings.maxPositionSizePercent })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1">Maximum % of balance per position</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Max Total Exposure (%)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={settings.maxExposurePercent}
                      onChange={(e) => updateSetting('maxExposurePercent', parseInt(e.target.value))}
                      onBlur={() => saveSettings({ maxExposurePercent: settings.maxExposurePercent })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1">Maximum % of balance in all positions</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Max Leverage</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={settings.maxLeverage}
                      onChange={(e) => updateSetting('maxLeverage', parseInt(e.target.value))}
                      onBlur={() => saveSettings({ maxLeverage: settings.maxLeverage })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Default Stop Loss (%)</label>
                    <input
                      type="number"
                      min="0.5"
                      max="50"
                      step="0.5"
                      value={settings.defaultStopLossPercent}
                      onChange={(e) => updateSetting('defaultStopLossPercent', parseFloat(e.target.value))}
                      onBlur={() => saveSettings({ defaultStopLossPercent: settings.defaultStopLossPercent })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Default Take Profit (%)</label>
                    <input
                      type="number"
                      min="0.5"
                      max="100"
                      step="0.5"
                      value={settings.defaultTakeProfitPercent}
                      onChange={(e) => updateSetting('defaultTakeProfitPercent', parseFloat(e.target.value))}
                      onBlur={() => saveSettings({ defaultTakeProfitPercent: settings.defaultTakeProfitPercent })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Max Daily Loss (%)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={settings.maxDailyLossPercent}
                      onChange={(e) => updateSetting('maxDailyLossPercent', parseInt(e.target.value))}
                      onBlur={() => saveSettings({ maxDailyLossPercent: settings.maxDailyLossPercent })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1">Stop trading after this daily loss</p>
                  </div>
                </div>
              </div>
            )}

            {/* Signal Sources Tab */}
            {activeTab === 'signals' && settings && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                  Signal Sources
                </h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                    <div>
                      <div className="font-medium">Market Analyst</div>
                      <div className="text-sm text-gray-400">Built-in technical analysis (RSI, MACD, trends)</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.useMarketAnalyst}
                        onChange={(e) => saveSettings({ useMarketAnalyst: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                    <div>
                      <div className="font-medium">TradingView Signals</div>
                      <div className="text-sm text-gray-400">External TradingView technical analysis</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.useTradingView}
                        onChange={(e) => saveSettings({ useTradingView: e.target.checked, tradingViewEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>

                  {settings.tradingViewEnabled && (
                    <div className="ml-4 p-4 bg-gray-700/30 rounded-lg space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">TradingView API URL</label>
                        <input
                          type="text"
                          value={settings.tradingViewApiUrl}
                          onChange={(e) => updateSetting('tradingViewApiUrl', e.target.value)}
                          onBlur={() => saveSettings({ tradingViewApiUrl: settings.tradingViewApiUrl })}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Symbol</label>
                          <input
                            type="text"
                            value={settings.tradingViewSymbol}
                            onChange={(e) => updateSetting('tradingViewSymbol', e.target.value)}
                            onBlur={() => saveSettings({ tradingViewSymbol: settings.tradingViewSymbol })}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Exchange</label>
                          <input
                            type="text"
                            value={settings.tradingViewExchange}
                            onChange={(e) => updateSetting('tradingViewExchange', e.target.value)}
                            onBlur={() => saveSettings({ tradingViewExchange: settings.tradingViewExchange })}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                    <div>
                      <div className="font-medium">Market Researcher</div>
                      <div className="text-sm text-gray-400">News sentiment and on-chain analysis</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.useResearcher}
                        onChange={(e) => saveSettings({ useResearcher: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                    <div>
                      <div className="font-medium">Require Multiple Sources</div>
                      <div className="text-sm text-gray-400">Only trade when multiple sources agree</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.requireMultipleSources}
                        onChange={(e) => saveSettings({ requireMultipleSources: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && settings && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-orange-500" />
                  Notifications
                </h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                    <div>
                      <div className="font-medium">Telegram Notifications</div>
                      <div className="text-sm text-gray-400">Receive trade alerts via Telegram</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.enableTelegramNotifications}
                        onChange={(e) => saveSettings({ enableTelegramNotifications: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>

                  {settings.enableTelegramNotifications && (
                    <div className="ml-4 p-4 bg-gray-700/30 rounded-lg space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Bot Token</label>
                        <input
                          type={showSecrets ? 'text' : 'password'}
                          value={settings.telegramBotToken === '••••••••' ? '' : settings.telegramBotToken}
                          onChange={(e) => updateSetting('telegramBotToken', e.target.value)}
                          onBlur={() => saveSettings({ telegramBotToken: settings.telegramBotToken })}
                          placeholder="Enter your Telegram bot token"
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Chat ID</label>
                        <input
                          type="text"
                          value={settings.telegramChatId}
                          onChange={(e) => updateSetting('telegramChatId', e.target.value)}
                          onBlur={() => saveSettings({ telegramChatId: settings.telegramChatId })}
                          placeholder="Enter your chat ID"
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Advanced Tab */}
            {activeTab === 'advanced' && settings && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-orange-500" />
                  Advanced Settings
                </h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                    <div>
                      <div className="font-medium">Debug Mode</div>
                      <div className="text-sm text-gray-400">Enable verbose logging</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.debugMode}
                        onChange={(e) => saveSettings({ debugMode: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                    <div>
                      <div className="font-medium">On-Chain Metrics</div>
                      <div className="text-sm text-gray-400">Enable on-chain data fetching</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.enableOnChainMetrics}
                        onChange={(e) => saveSettings({ enableOnChainMetrics: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Control API Key</label>
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      value={settings.controlApiKey === '••••••••' ? '' : settings.controlApiKey}
                      onChange={(e) => updateSetting('controlApiKey', e.target.value)}
                      onBlur={() => saveSettings({ controlApiKey: settings.controlApiKey })}
                      placeholder="API key for external control (e.g., OpenClaw)"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                    />
                  </div>

                  <div className="pt-4 border-t border-gray-700">
                    <button
                      onClick={async () => {
                        if (confirm('Are you sure you want to reset all settings to defaults?')) {
                          const res = await fetch('/api/settings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'reset' }),
                          });
                          if (res.ok) {
                            setSuccess('Settings reset to defaults');
                            fetchSettings();
                          }
                        }
                      }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg"
                    >
                      Reset All Settings
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
