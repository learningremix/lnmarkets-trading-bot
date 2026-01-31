/**
 * Settings Service - Database-backed configuration
 * All trading settings are stored in DB and configurable via dashboard
 */

import { getDatabase } from '../../database/context';
import { settings } from '../../database/schema';
import { eq } from 'drizzle-orm';

export interface TradingSettings {
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

const DEFAULT_SETTINGS: TradingSettings = {
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
  tradingViewApiUrl: '',
  tradingViewSymbol: 'BTCUSD',
  tradingViewExchange: 'COINBASE',
  tradingViewTimeframes: ['1h', '4h'],
  tradingViewRequireStrong: false,
  
  // Optional Features
  enableOnChainMetrics: false,
  enableTelegramNotifications: false,
  telegramChatId: '',
};

// In-memory cache for settings
let settingsCache: TradingSettings | null = null;
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
  async getSettings(): Promise<TradingSettings> {
    // Return cached if fresh
    if (settingsCache && Date.now() - lastFetchTime < CACHE_TTL) {
      return settingsCache;
    }

    try {
      const db = getDatabase();
      const rows = await db.select().from(settings);
      
      // Build settings object from rows
      const result = { ...DEFAULT_SETTINGS };
      
      for (const row of rows) {
        const key = row.key as keyof TradingSettings;
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
   * Get a single setting
   */
  async getSetting<K extends keyof TradingSettings>(key: K): Promise<TradingSettings[K]> {
    const all = await this.getSettings();
    return all[key];
  }

  /**
   * Update a single setting
   */
  async setSetting<K extends keyof TradingSettings>(key: K, value: TradingSettings[K]): Promise<void> {
    try {
      const db = getDatabase();
      
      await db.insert(settings)
        .values({
          key,
          value: value as any,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: value as any,
            updatedAt: new Date(),
          },
        });
      
      // Invalidate cache
      settingsCache = null;
    } catch (error) {
      console.error(`Failed to save setting ${key}:`, error);
      throw error;
    }
  }

  /**
   * Update multiple settings at once
   */
  async updateSettings(updates: Partial<TradingSettings>): Promise<void> {
    try {
      const db = getDatabase();
      
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          await db.insert(settings)
            .values({
              key,
              value: value as any,
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
      
      // Invalidate cache
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
            description: this.getSettingDescription(key),
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
   * Get setting description for UI
   */
  private getSettingDescription(key: string): string {
    const descriptions: Record<string, string> = {
      autoStartSwarm: 'Auto-start trading agents when server starts',
      autoExecuteTrades: '⚠️ Enable automatic trade execution',
      minTradeConfidence: 'Minimum confidence score to execute trades (0-100)',
      maxOpenPositions: 'Maximum number of concurrent positions',
      tradeCooldownMinutes: 'Minimum time between trades in minutes',
      maxPositionSizePercent: 'Maximum % of balance per position',
      maxExposurePercent: 'Maximum % of balance in all positions',
      maxLeverage: 'Maximum leverage allowed',
      defaultStopLossPercent: 'Default stop loss percentage',
      defaultTakeProfitPercent: 'Default take profit percentage',
      maxDailyLossPercent: 'Stop trading after this daily loss %',
      useMarketAnalyst: 'Use built-in technical analysis',
      useTradingView: 'Use TradingView external signals',
      useResearcher: 'Use news sentiment analysis',
      requireMultipleSources: 'Require multiple sources to agree',
      tradingViewEnabled: 'Enable TradingView integration',
      tradingViewApiUrl: 'TradingView TA API URL',
      tradingViewSymbol: 'Trading symbol (e.g., BTCUSD)',
      tradingViewExchange: 'Exchange for TradingView (e.g., COINBASE)',
      tradingViewTimeframes: 'Timeframes to analyze',
      tradingViewRequireStrong: 'Only trade on STRONG signals',
      enableOnChainMetrics: 'Enable on-chain data fetching',
      enableTelegramNotifications: 'Send notifications to Telegram',
      telegramChatId: 'Telegram chat ID for notifications',
    };
    return descriptions[key] || '';
  }

  /**
   * Get defaults (for reference)
   */
  getDefaults(): TradingSettings {
    return { ...DEFAULT_SETTINGS };
  }

  /**
   * Clear cache (force reload from DB)
   */
  clearCache(): void {
    settingsCache = null;
    lastFetchTime = 0;
  }
}

// Singleton export
export const settingsService = SettingsService.getInstance();

// Helper to get settings without DB (fallback for bootstrap)
export function getSettingsFromEnv(): Partial<TradingSettings> {
  return {
    autoStartSwarm: process.env.AUTO_START_SWARM === 'true',
    autoExecuteTrades: process.env.AUTO_EXECUTE_TRADES === 'true',
    minTradeConfidence: parseInt(process.env.MIN_TRADE_CONFIDENCE || '70', 10),
    maxOpenPositions: parseInt(process.env.MAX_OPEN_POSITIONS || '3', 10),
    maxPositionSizePercent: parseInt(process.env.MAX_POSITION_SIZE_PERCENT || '10', 10),
    maxExposurePercent: parseInt(process.env.MAX_EXPOSURE_PERCENT || '50', 10),
    maxLeverage: parseInt(process.env.MAX_LEVERAGE || '25', 10),
    defaultStopLossPercent: parseInt(process.env.DEFAULT_STOP_LOSS_PERCENT || '5', 10),
    maxDailyLossPercent: parseInt(process.env.MAX_DAILY_LOSS_PERCENT || '10', 10),
    enableOnChainMetrics: process.env.ENABLE_ONCHAIN_METRICS === 'true',
    tradingViewApiUrl: process.env.TRADINGVIEW_SIGNAL_URL || '',
    tradingViewSymbol: process.env.TRADINGVIEW_SIGNAL_SYMBOL || 'BTCUSD',
    tradingViewExchange: process.env.TRADINGVIEW_SIGNAL_EXCHANGE || 'COINBASE',
  };
}
