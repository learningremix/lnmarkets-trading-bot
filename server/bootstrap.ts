/**
 * Server Bootstrap - Initialize trading swarm on server start
 * Settings are loaded from database, with env fallback for first run
 */

import { getSwarmCoordinator, type SwarmConfig } from './agents';

let initialized = false;

export async function bootstrapTradingSwarm(): Promise<void> {
  if (initialized) {
    console.log('Trading swarm already initialized');
    return;
  }

  console.log('⚡ Bootstrapping LN Markets Trading Swarm...');

  // Initial config from env (settings loaded from DB by agents at runtime)
  const config: Partial<SwarmConfig> = {
    autoStart: false, // Will be controlled by DB settings
    enabledAgents: {
      marketAnalyst: true,
      riskManager: true,
      execution: true,
      researcher: true,
      tradingView: false, // Enabled via settings
    },
    signalSources: {
      useMarketAnalyst: true,
      useTradingView: false,
      useResearcher: false,
      requireMultipleSources: false,
    },
  };

  // Check for LN Markets credentials
  const lnMarketsKey = process.env.LNMARKETS_KEY;
  const lnMarketsSecret = process.env.LNMARKETS_SECRET;
  const lnMarketsPassphrase = process.env.LNMARKETS_PASSPHRASE;
  const lnMarketsNetwork = (process.env.LNMARKETS_NETWORK || 'testnet') as 'mainnet' | 'testnet';

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
  console.log('⚙️  Settings: http://localhost:3000/dashboard/settings');
  console.log('🔌 Control API: http://localhost:3000/api/control');
  console.log('');
  console.log('💡 Configure trading settings via the dashboard');
  console.log('   All settings and state are stored in the database');
  console.log('');
}

export function getInitialized(): boolean {
  return initialized;
}
