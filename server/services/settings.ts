/**
 * Settings Service - Database-backed configuration
 * ALL settings are stored in DB - only DATABASE_URL is in .env
 */

import { getDatabase } from '../../database/context';
import { settings } from '../../database/schema';
import { eq } from 'drizzle-orm';

// ============ SETTINGS INTERFACE ============

export interface AppSettings {
  // ===========================================
  // AI Configuration
  // ===========================================
  aiProvider: 'anthropic' | 'openai' | 'none';
  aiApiKey: string;
  aiModel: string;
  aiMaxTokens: number;
  aiTemperature: number;
  aiEnabled: boolean;

  // ===========================================
  // LN Markets API Credentials
  // ===========================================
  lnmarketsKey: string;
  lnmarketsSecret: string;
  lnmarketsPassphrase: string;
  lnmarketsNetwork: 'mainnet' | 'testnet';

  // ===========================================
  // Swarm Control
  // ===========================================
  autoStartSwarm: boolean;
  autoExecuteTrades: boolean;

  // ===========================================
  // Execution Settings
  // ===========================================
  minTradeConfidence: number;
  maxOpenPositions: number;
  tradeCooldownMinutes: number;

  // ===========================================
  // Risk Management
  // ===========================================
  maxPositionSizePercent: number;
  maxExposurePercent: number;
  maxLeverage: number;
  defaultStopLossPercent: number;
  defaultTakeProfitPercent: number;
  maxDailyLossPercent: number;

  // ===========================================
  // Signal Sources
  // ===========================================
  useMarketAnalyst: boolean;
  useTradingView: boolean;
  useResearcher: boolean;
  requireMultipleSources: boolean;

  // ===========================================
  // TradingView Integration
  // ===========================================
  tradingViewEnabled: boolean;
  tradingViewApiUrl: string;
  tradingViewSymbol: string;
  tradingViewExchange: string;
  tradingViewTimeframes: string[];
  tradingViewRequireStrong: boolean;

  // ===========================================
  // Notifications
  // ===========================================
  enableTelegramNotifications: boolean;
  telegramBotToken: string;
  telegramChatId: string;

  // ===========================================
  // Advanced
  // ===========================================
  enableOnChainMetrics: boolean;
  controlApiKey: string;
  debugMode: boolean;
}

// Default settings (safe defaults, no credentials)
const DEFAULT_SETTINGS: AppSettings = {
  // AI
  aiProvider: 'anthropic',
  aiApiKey: '',
  aiModel: 'claude-sonnet-4-20250514',
  aiMaxTokens: 1024,
  aiTemperature: 0.7,
  aiEnabled: false,

  // LN Markets
  lnmarketsKey: '',
  lnmarketsSecret: '',
  lnmarketsPassphrase: '',
  lnmarketsNetwork: 'testnet',

  // Swarm Control
  autoStartSwarm: false,
  autoExecuteTrades: false,

  // Execution
  minTradeConfidence: 70,
  maxOpenPositions: 3,
  tradeCooldownMinutes: 1,

  // Risk Management
  maxPositionSizePercent: 10,
  maxExposurePercent: 50,
  maxLeverage: 25,
  defaultStopLossPercent: 5,
  defaultTakeProfitPercent: 10,
  maxDailyLossPercent: 10,

  // Signal Sources
  useMarketAnalyst: true,
  useTradingView: false,
  useResearcher: false,
  requireMultipleSources: false,

  // TradingView
  tradingViewEnabled: false,
  tradingViewApiUrl: 'http://tradingview-ta:8000',
  tradingViewSymbol: 'BTCUSD',
  tradingViewExchange: 'COINBASE',
  tradingViewTimeframes: ['1h', '4h'],
  tradingViewRequireStrong: false,

  // Notifications
  enableTelegramNotifications: false,
  telegramBotToken: '',
  telegramChatId: '',

  // Advanced
  enableOnChainMetrics: false,
  controlApiKey: '',
  debugMode: false,
};

// Settings that should be masked in responses
const SENSITIVE_KEYS = new Set([
  'aiApiKey',
  'lnmarketsKey',
  'lnmarketsSecret',
  'lnmarketsPassphrase',
  'telegramBotToken',
  'controlApiKey',
]);

// Setting descriptions for UI/docs
const SETTING_DESCRIPTIONS: Record<string, string> = {
  // AI
  aiProvider: 'AI provider (anthropic or openai)',
  aiApiKey: 'API key for AI provider',
  aiModel: 'AI model to use (e.g., claude-sonnet-4-20250514, gpt-4)',
  aiMaxTokens: 'Maximum tokens for AI responses',
  aiTemperature: 'AI temperature (0-1, higher = more creative)',
  aiEnabled: 'Enable AI-powered agent reasoning',

  // LN Markets
  lnmarketsKey: 'LN Markets API Key',
  lnmarketsSecret: 'LN Markets API Secret',
  lnmarketsPassphrase: 'LN Markets API Passphrase',
  lnmarketsNetwork: 'LN Markets network (mainnet or testnet)',

  // Swarm Control
  autoStartSwarm: 'Auto-start trading agents when server starts',
  autoExecuteTrades: '⚠️ Enable automatic trade execution (DANGEROUS)',

  // Execution
  minTradeConfidence: 'Minimum confidence score to execute trades (0-100)',
  maxOpenPositions: 'Maximum number of concurrent positions',
  tradeCooldownMinutes: 'Minimum time between trades in minutes',

  // Risk Management
  maxPositionSizePercent: 'Maximum % of balance per position',
  maxExposurePercent: 'Maximum % of balance in all positions',
  maxLeverage: 'Maximum leverage allowed',
  defaultStopLossPercent: 'Default stop loss percentage',
  defaultTakeProfitPercent: 'Default take profit percentage',
  maxDailyLossPercent: 'Stop trading after this daily loss %',

  // Signal Sources
  useMarketAnalyst: 'Use built-in technical analysis',
  useTradingView: 'Use TradingView external signals',
  useResearcher: 'Use news sentiment analysis',
  requireMultipleSources: 'Require multiple sources to agree before trading',

  // TradingView
  tradingViewEnabled: 'Enable TradingView integration',
  tradingViewApiUrl: 'TradingView TA API URL',
  tradingViewSymbol: 'Trading symbol (e.g., BTCUSD)',
  tradingViewExchange: 'Exchange for TradingView (e.g., COINBASE)',
  tradingViewTimeframes: 'Timeframes to analyze',
  tradingViewRequireStrong: 'Only trade on STRONG signals',

  // Notifications
  enableTelegramNotifications: 'Send notifications to Telegram',
  telegramBotToken: 'Telegram Bot Token',
  telegramChatId: 'Telegram Chat ID for notifications',

  // Advanced
  enableOnChainMetrics: 'Enable on-chain data fetching',
  controlApiKey: 'API Key for external control (e.g., OpenClaw)',
  debugMode: 'Enable debug logging',
};

// Setting categories for UI grouping
export const SETTING_CATEGORIES = {
  'AI Configuration': ['aiEnabled', 'aiProvider', 'aiApiKey', 'aiModel', 'aiMaxTokens', 'aiTemperature'],
  'LN Markets API': ['lnmarketsKey', 'lnmarketsSecret', 'lnmarketsPassphrase', 'lnmarketsNetwork'],
  'Swarm Control': ['autoStartSwarm', 'autoExecuteTrades'],
  'Execution': ['minTradeConfidence', 'maxOpenPositions', 'tradeCooldownMinutes'],
  'Risk Management': ['maxPositionSizePercent', 'maxExposurePercent', 'maxLeverage', 'defaultStopLossPercent', 'defaultTakeProfitPercent', 'maxDailyLossPercent'],
  'Signal Sources': ['useMarketAnalyst', 'useTradingView', 'useResearcher', 'requireMultipleSources'],
  'TradingView': ['tradingViewEnabled', 'tradingViewApiUrl', 'tradingViewSymbol', 'tradingViewExchange', 'tradingViewTimeframes', 'tradingViewRequireStrong'],
  'Notifications': ['enableTelegramNotifications', 'telegramBotToken', 'telegramChatId'],
  'Advanced': ['enableOnChainMetrics', 'controlApiKey', 'debugMode'],
};

// ============ SETTINGS SERVICE ============

// In-memory cache
let settingsCache: AppSettings | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 5000; // 5 seconds

export class SettingsService {
  private static instance: SettingsService;

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  /**
   * Get all settings (with caching)
   */
  async getSettings(): Promise<AppSettings> {
    if (settingsCache && Date.now() - lastFetchTime < CACHE_TTL) {
      return settingsCache;
    }

    try {
      const db = getDatabase();
      const rows = await db.select().from(settings);

      const result = { ...DEFAULT_SETTINGS };

      for (const row of rows) {
        const key = row.key as keyof AppSettings;
        if (key in result) {
          (result as any)[key] = row.value;
        }
      }

      settingsCache = result;
      lastFetchTime = Date.now();
      return result;
    } catch (error) {
      console.error('Failed to load settings from DB, using defaults:', error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Get settings with sensitive values masked
   */
  async getSettingsMasked(): Promise<AppSettings> {
    const s = await this.getSettings();
    const masked = { ...s };

    for (const key of SENSITIVE_KEYS) {
      const k = key as keyof AppSettings;
      if (masked[k] && typeof masked[k] === 'string' && (masked[k] as string).length > 0) {
        (masked as any)[k] = '••••••••';
      }
    }

    return masked;
  }

  /**
   * Get a single setting
   */
  async getSetting<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
    const all = await this.getSettings();
    return all[key];
  }

  /**
   * Update a single setting
   */
  async setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
    try {
      const db = getDatabase();

      await db.insert(settings)
        .values({
          key,
          value: value as any,
          description: SETTING_DESCRIPTIONS[key] || '',
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: value as any,
            updatedAt: new Date(),
          },
        });

      settingsCache = null;
    } catch (error) {
      console.error(`Failed to save setting ${key}:`, error);
      throw error;
    }
  }

  /**
   * Update multiple settings at once
   */
  async updateSettings(updates: Partial<AppSettings>): Promise<void> {
    try {
      const db = getDatabase();

      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          // Skip masked values
          if (value === '••••••••') continue;

          await db.insert(settings)
            .values({
              key,
              value: value as any,
              description: SETTING_DESCRIPTIONS[key] || '',
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: settings.key,
              set: {
                value: value as any,
                updatedAt: new Date(),
              },
            });
        }
      }

      settingsCache = null;
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }

  /**
   * Initialize settings with defaults (for first run)
   */
  async initializeDefaults(): Promise<void> {
    try {
      const db = getDatabase();

      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        await db.insert(settings)
          .values({
            key,
            value: value as any,
            description: SETTING_DESCRIPTIONS[key] || '',
            updatedAt: new Date(),
          })
          .onConflictDoNothing();
      }

      console.log('Settings initialized with defaults');
    } catch (error) {
      console.error('Failed to initialize settings:', error);
    }
  }

  /**
   * Reset all settings to defaults
   */
  async resetToDefaults(): Promise<void> {
    await this.updateSettings(DEFAULT_SETTINGS);
  }

  /**
   * Get setting description
   */
  getDescription(key: string): string {
    return SETTING_DESCRIPTIONS[key] || '';
  }

  /**
   * Check if a setting is sensitive
   */
  isSensitive(key: string): boolean {
    return SENSITIVE_KEYS.has(key);
  }

  /**
   * Get defaults (for reference)
   */
  getDefaults(): AppSettings {
    return { ...DEFAULT_SETTINGS };
  }

  /**
   * Get categories for UI
   */
  getCategories(): typeof SETTING_CATEGORIES {
    return SETTING_CATEGORIES;
  }

  /**
   * Clear cache (force reload from DB)
   */
  clearCache(): void {
    settingsCache = null;
    lastFetchTime = 0;
  }

  /**
   * Check if LN Markets is configured
   */
  async isLNMarketsConfigured(): Promise<boolean> {
    const s = await this.getSettings();
    return !!(s.lnmarketsKey && s.lnmarketsSecret && s.lnmarketsPassphrase);
  }

  /**
   * Get LN Markets config (for service initialization)
   */
  async getLNMarketsConfig(): Promise<{
    key: string;
    secret: string;
    passphrase: string;
    network: 'mainnet' | 'testnet';
  } | null> {
    const s = await this.getSettings();
    if (!s.lnmarketsKey || !s.lnmarketsSecret || !s.lnmarketsPassphrase) {
      return null;
    }
    return {
      key: s.lnmarketsKey,
      secret: s.lnmarketsSecret,
      passphrase: s.lnmarketsPassphrase,
      network: s.lnmarketsNetwork,
    };
  }
}

// Singleton export
export const settingsService = SettingsService.getInstance();

// Legacy type alias for compatibility
export type TradingSettings = AppSettings;
