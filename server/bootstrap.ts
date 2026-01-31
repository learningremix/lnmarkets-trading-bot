/**
 * Server Bootstrap - Initialize trading swarm on server start
 * ALL settings are loaded from database - only DATABASE_URL is in .env
 */

import { getSwarmCoordinator, type SwarmConfig } from './agents';
import { settingsService } from './services/settings';

let initialized = false;

export async function bootstrapTradingSwarm(): Promise<void> {
  if (initialized) {
    console.log('Trading swarm already initialized');
    return;
  }

  console.log('⚡ Bootstrapping LN Markets Trading Swarm...');

  // Initialize settings with defaults if first run
  await settingsService.initializeDefaults();

  // Load settings from database
  const settings = await settingsService.getSettings();

  // Build config from database settings
  const config: Partial<SwarmConfig> = {
    autoStart: settings.autoStartSwarm,
    enabledAgents: {
      marketAnalyst: settings.useMarketAnalyst,
      riskManager: true,
      execution: true,
      researcher: settings.useResearcher,
      tradingView: settings.tradingViewEnabled,
    },
    signalSources: {
      useMarketAnalyst: settings.useMarketAnalyst,
      useTradingView: settings.useTradingView,
      useResearcher: settings.useResearcher,
      requireMultipleSources: settings.requireMultipleSources,
    },
    tradingViewConfig: {
      apiUrl: settings.tradingViewApiUrl,
      symbol: settings.tradingViewSymbol,
      exchange: settings.tradingViewExchange,
      timeframes: settings.tradingViewTimeframes,
      requireStrongSignal: settings.tradingViewRequireStrong,
    },
    executionConfig: {
      autoExecute: settings.autoExecuteTrades,
      minConfidence: settings.minTradeConfidence,
      maxOpenPositions: settings.maxOpenPositions,
      cooldownMs: settings.tradeCooldownMinutes * 60 * 1000,
    },
    riskManagerConfig: {
      maxPositionSizePercent: settings.maxPositionSizePercent,
      maxTotalExposurePercent: settings.maxExposurePercent,
      maxLeverage: settings.maxLeverage,
      defaultStopLossPercent: settings.defaultStopLossPercent,
      maxDailyLossPercent: settings.maxDailyLossPercent,
    },
  };

  // Get LN Markets credentials from database
  const lnMarketsConfig = await settingsService.getLNMarketsConfig();

  const swarm = getSwarmCoordinator(config);

  // Set up event listeners for logging
  swarm.on('agent_log', (log) => {
    if (log.level === 'error') {
      console.error(`[${log.agentId}] ${log.message}`, log.data || '');
    } else if (log.level === 'warn') {
      console.warn(`[${log.agentId}] ${log.message}`, log.data || '');
    } else if (process.env.NODE_ENV === 'development') {
      console.log(`[${log.agentId}] ${log.message}`, log.data || '');
    }
  });

  swarm.on('agent_error', ({ agentId, error }) => {
    console.error(`Agent ${agentId} error:`, error);
  });

  swarm.on('trading_halted', (data) => {
    console.warn('⚠️ Trading halted:', data.reason);
  });

  swarm.on('tradingview_signal', ({ signal, direction, confidence }) => {
    console.log(`📈 TradingView signal: ${signal} → ${direction} (${confidence}%)`);
  });

  // Initialize with or without authentication
  if (lnMarketsConfig) {
    console.log(`🔐 Initializing with LN Markets API (${lnMarketsConfig.network})...`);
    await swarm.initialize(lnMarketsConfig);
    console.log('✅ Authenticated with LN Markets');
  } else {
    console.log('⚠️ No LN Markets credentials configured');
    console.log('   Configure via POST /api/settings with action: configure_lnmarkets');
    await swarm.initialize();
  }

  // Load saved state from database
  const savedState = await swarm.loadState();
  if (savedState) {
    console.log('📂 Restored state from database');
    if (savedState.running) {
      console.log('   Previously running - auto-starting swarm...');
      swarm.start();
    }
  }

  initialized = true;

  console.log('');
  console.log('🤖 Trading swarm initialized');
  console.log('📊 Dashboard: http://localhost:3000/dashboard');
  console.log('⚙️  Settings: http://localhost:3000/api/settings');
  console.log('💬 Chat API: http://localhost:3000/api/chat');
  console.log('');
  console.log('💡 All settings stored in database:');
  console.log('   GET  /api/settings           - View all settings');
  console.log('   POST /api/settings           - Update settings');
  console.log('   POST /api/settings?action=configure_lnmarkets - Set LN Markets API');
  console.log('');
}

export function getInitialized(): boolean {
  return initialized;
}
