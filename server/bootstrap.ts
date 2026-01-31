/**
 * Server Bootstrap - Initialize trading swarm on server start
 */

import { getSwarmCoordinator, type SwarmConfig } from './agents';

let initialized = false;

export async function bootstrapTradingSwarm(): Promise<void> {
  if (initialized) {
    console.log('Trading swarm already initialized');
    return;
  }

  console.log('⚡ Bootstrapping LN Markets Trading Swarm...');

  // Read configuration from environment
  const config: Partial<SwarmConfig> = {
    autoStart: process.env.AUTO_START_SWARM === 'true',
    enabledAgents: {
      marketAnalyst: true,
      riskManager: true,
      execution: true,
      researcher: true,
    },
    executionConfig: {
      autoExecute: process.env.AUTO_EXECUTE_TRADES === 'true',
      minConfidence: parseInt(process.env.MIN_TRADE_CONFIDENCE || '70', 10),
      maxOpenPositions: parseInt(process.env.MAX_OPEN_POSITIONS || '3', 10),
    },
    riskManagerConfig: {
      maxPositionSizePercent: parseInt(process.env.MAX_POSITION_SIZE_PERCENT || '10', 10),
      maxTotalExposurePercent: parseInt(process.env.MAX_EXPOSURE_PERCENT || '50', 10),
      maxLeverage: parseInt(process.env.MAX_LEVERAGE || '25', 10),
      defaultStopLossPercent: parseInt(process.env.DEFAULT_STOP_LOSS_PERCENT || '5', 10),
      maxDailyLossPercent: parseInt(process.env.MAX_DAILY_LOSS_PERCENT || '10', 10),
    },
    marketAnalystConfig: {
      analysisIntervals: ['1h', '4h'],
      minConfidence: 60,
    },
    researcherConfig: {
      enableOnChain: process.env.ENABLE_ONCHAIN_METRICS === 'true',
    },
  };

  // Check for LN Markets credentials
  const lnMarketsKey = process.env.LNMARKETS_KEY;
  const lnMarketsSecret = process.env.LNMARKETS_SECRET;
  const lnMarketsPassphrase = process.env.LNMARKETS_PASSPHRASE;
  const lnMarketsNetwork = (process.env.LNMARKETS_NETWORK || 'mainnet') as 'mainnet' | 'testnet';

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

  swarm.on('research_report', (report) => {
    console.log(`📊 Research: ${report.sentiment.overall} (${report.sentiment.score})`);
  });

  // Initialize with or without authentication
  if (lnMarketsKey && lnMarketsSecret && lnMarketsPassphrase) {
    console.log(`🔐 Initializing with LN Markets API (${lnMarketsNetwork})...`);
    await swarm.initialize({
      key: lnMarketsKey,
      secret: lnMarketsSecret,
      passphrase: lnMarketsPassphrase,
      network: lnMarketsNetwork,
    });
    console.log('✅ Authenticated with LN Markets');
  } else {
    console.log('⚠️ No LN Markets credentials - running in public API mode');
    console.log('   Set LNMARKETS_KEY, LNMARKETS_SECRET, LNMARKETS_PASSPHRASE for trading');
    await swarm.initialize();
  }

  initialized = true;

  if (config.autoStart) {
    console.log('🤖 Trading swarm started automatically');
  } else {
    console.log('🤖 Trading swarm initialized (not auto-started)');
    console.log('   Set AUTO_START_SWARM=true to auto-start');
  }

  // Log configuration summary
  console.log('\n📋 Configuration:');
  console.log(`   Auto-execute trades: ${config.executionConfig?.autoExecute ? 'YES ⚠️' : 'NO (manual)'}`);
  console.log(`   Max open positions: ${config.executionConfig?.maxOpenPositions}`);
  console.log(`   Max leverage: ${config.riskManagerConfig?.maxLeverage}x`);
  console.log(`   Max daily loss: ${config.riskManagerConfig?.maxDailyLossPercent}%`);
  console.log('');
}

export function getInitialized(): boolean {
  return initialized;
}
