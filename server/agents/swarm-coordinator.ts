/**
 * Swarm Coordinator
 * Orchestrates all trading agents and manages inter-agent communication
 */

import { EventEmitter } from 'events';
import { LNMarketsService, createLNMarketsService, type LNMarketsConfig } from '../services/lnmarkets';
import { BaseAgent } from './base-agent';
import { MarketAnalystAgent } from './market-analyst';
import { RiskManagerAgent } from './risk-manager';
import { ExecutionAgent, type TradeSignal } from './execution-agent';
import { ResearcherAgent } from './researcher-agent';
import { TradingViewAgent, type TVSignal } from './tradingview-agent';

export interface SwarmConfig {
  lnMarkets?: LNMarketsConfig;
  autoStart: boolean;
  enabledAgents: {
    marketAnalyst: boolean;
    riskManager: boolean;
    execution: boolean;
    researcher: boolean;
    tradingView: boolean;
  };
  signalSources: {
    useMarketAnalyst: boolean;
    useTradingView: boolean;
    useResearcher: boolean;
    requireMultipleSources: boolean;
  };
  marketAnalystConfig?: {
    intervalMs?: number;
    analysisIntervals?: ('1h' | '4h' | '1d')[];
    minConfidence?: number;
  };
  riskManagerConfig?: {
    intervalMs?: number;
    maxPositionSizePercent?: number;
    maxTotalExposurePercent?: number;
    maxLeverage?: number;
    defaultStopLossPercent?: number;
    maxDailyLossPercent?: number;
  };
  executionConfig?: {
    intervalMs?: number;
    autoExecute?: boolean;
    minConfidence?: number;
    maxOpenPositions?: number;
    cooldownMs?: number;
  };
  researcherConfig?: {
    intervalMs?: number;
    enableOnChain?: boolean;
  };
  tradingViewConfig?: {
    intervalMs?: number;
    apiUrl?: string;
    symbol?: string;
    exchange?: string;
    timeframes?: string[];
    requireStrongSignal?: boolean;
  };
}

export interface SwarmStatus {
  running: boolean;
  authenticated: boolean;
  agents: {
    id: string;
    name: string;
    type: string;
    status: string;
    enabled: boolean;
    lastRunAt: Date | null;
  }[];
  balance?: number;
  openPositions?: number;
  dailyPL?: number;
}

export class SwarmCoordinator extends EventEmitter {
  private lnMarkets: LNMarketsService | null = null;
  private agents: Map<string, BaseAgent> = new Map();
  private running = false;
  private config: SwarmConfig;

  // Typed agent references
  private marketAnalyst: MarketAnalystAgent | null = null;
  private riskManager: RiskManagerAgent | null = null;
  private executionAgent: ExecutionAgent | null = null;
  private researcher: ResearcherAgent | null = null;
  private tradingView: TradingViewAgent | null = null;

  constructor(config: Partial<SwarmConfig> = {}) {
    super();

    this.config = {
      autoStart: false,
      enabledAgents: {
        marketAnalyst: true,
        riskManager: true,
        execution: true,
        researcher: true,
        tradingView: true,
      },
      signalSources: {
        useMarketAnalyst: true,
        useTradingView: true,
        useResearcher: false,
        requireMultipleSources: false,
      },
      ...config,
    };

    this.initializeAgents();
  }

  private initializeAgents(): void {
    // Market Analyst
    if (this.config.enabledAgents.marketAnalyst) {
      this.marketAnalyst = new MarketAnalystAgent({
        id: 'market-analyst',
        name: 'Market Analyst',
        analysisIntervals: this.config.marketAnalystConfig?.analysisIntervals || ['1h', '4h'],
        minConfidence: this.config.marketAnalystConfig?.minConfidence || 60,
        intervalMs: this.config.marketAnalystConfig?.intervalMs,
      });
      this.agents.set('market-analyst', this.marketAnalyst);
      this.setupAgentListeners(this.marketAnalyst);
    }

    // Risk Manager
    if (this.config.enabledAgents.riskManager) {
      this.riskManager = new RiskManagerAgent({
        id: 'risk-manager',
        name: 'Risk Manager',
        intervalMs: this.config.riskManagerConfig?.intervalMs,
        riskParams: {
          maxPositionSizePercent: this.config.riskManagerConfig?.maxPositionSizePercent,
          maxTotalExposurePercent: this.config.riskManagerConfig?.maxTotalExposurePercent,
          maxLeverage: this.config.riskManagerConfig?.maxLeverage,
          defaultStopLossPercent: this.config.riskManagerConfig?.defaultStopLossPercent,
          maxDailyLossPercent: this.config.riskManagerConfig?.maxDailyLossPercent,
        },
      });
      this.agents.set('risk-manager', this.riskManager);
      this.setupAgentListeners(this.riskManager);
    }

    // Execution Agent
    if (this.config.enabledAgents.execution) {
      this.executionAgent = new ExecutionAgent({
        id: 'execution',
        name: 'Execution Agent',
        autoExecute: this.config.executionConfig?.autoExecute || false,
        minConfidence: this.config.executionConfig?.minConfidence || 70,
        maxOpenPositions: this.config.executionConfig?.maxOpenPositions || 3,
        cooldownMs: this.config.executionConfig?.cooldownMs || 60000,
        intervalMs: this.config.executionConfig?.intervalMs,
      });
      this.agents.set('execution', this.executionAgent);
      this.setupAgentListeners(this.executionAgent);
    }

    // Researcher
    if (this.config.enabledAgents.researcher) {
      this.researcher = new ResearcherAgent({
        id: 'researcher',
        name: 'Market Researcher',
        enableOnChain: this.config.researcherConfig?.enableOnChain || false,
        intervalMs: this.config.researcherConfig?.intervalMs,
      });
      this.agents.set('researcher', this.researcher);
      this.setupAgentListeners(this.researcher);
    }

    // TradingView Agent
    if (this.config.enabledAgents.tradingView) {
      this.tradingView = new TradingViewAgent({
        id: 'tradingview',
        name: 'TradingView Signals',
        apiUrl: this.config.tradingViewConfig?.apiUrl || process.env.TRADINGVIEW_SIGNAL_URL || 'http://localhost:8080',
        symbol: this.config.tradingViewConfig?.symbol || process.env.TRADINGVIEW_SIGNAL_SYMBOL || 'BTCUSD',
        exchange: this.config.tradingViewConfig?.exchange || process.env.TRADINGVIEW_SIGNAL_EXCHANGE || 'COINBASE',
        timeframes: this.config.tradingViewConfig?.timeframes || ['1h', '4h'],
        requireStrongSignal: this.config.tradingViewConfig?.requireStrongSignal ?? false,
        intervalMs: this.config.tradingViewConfig?.intervalMs,
      });
      this.agents.set('tradingview', this.tradingView);
      this.setupAgentListeners(this.tradingView);
    }

    // Wire up inter-agent communication
    this.setupInterAgentCommunication();
  }

  private setupAgentListeners(agent: BaseAgent): void {
    agent.on('log', (log) => {
      this.emit('agent_log', { agentId: agent.getConfig().id, ...log });
    });

    agent.on('error', (error) => {
      this.emit('agent_error', { agentId: agent.getConfig().id, error });
    });
  }

  private setupInterAgentCommunication(): void {
    // Market Analyst -> Execution Agent
    if (this.marketAnalyst && this.executionAgent) {
      this.marketAnalyst.on('recommendation', (rec) => {
        if (rec.action === 'long' || rec.action === 'short') {
          const signal: TradeSignal = {
            id: `ma-${Date.now()}`,
            timestamp: new Date(),
            direction: rec.action,
            confidence: rec.confidence,
            reason: `Market Analyst recommendation across timeframes`,
            source: 'market-analyst',
            price: 0, // Will be filled by execution agent
          };
          this.executionAgent!.addSignal(signal);
        }
      });
    }

    // Risk Manager -> Execution Agent
    if (this.riskManager && this.executionAgent) {
      this.riskManager.on('alert', (alert) => {
        if (alert.level === 'critical' && alert.type === 'daily_loss_limit') {
          this.executionAgent!.setAutoExecute(false);
          this.emit('trading_halted', { reason: alert.message });
        }
      });

      this.riskManager.on('stop_trading', (data) => {
        this.executionAgent!.setAutoExecute(false);
        this.executionAgent!.clearPendingSignals();
        this.emit('trading_halted', data);
      });
    }

    // Researcher -> Emit market sentiment
    if (this.researcher) {
      this.researcher.on('report', (report) => {
        this.emit('research_report', report);

        // Could influence execution agent confidence thresholds
        if (report.sentiment.overall === 'extreme_fear' || report.sentiment.overall === 'extreme_greed') {
          this.emit('extreme_sentiment', {
            sentiment: report.sentiment.overall,
            score: report.sentiment.score,
          });
        }
      });
    }

    // TradingView -> Execution Agent
    if (this.tradingView && this.executionAgent && this.config.signalSources?.useTradingView) {
      this.tradingView.on('combined_signal', (tvSignal: TVSignal) => {
        if (tvSignal === 'NEUTRAL') return;

        const direction = (tvSignal === 'BUY' || tvSignal === 'STRONG_BUY') ? 'long' : 'short';
        const confidence = tvSignal.includes('STRONG') ? 85 : 65;

        const signal: TradeSignal = {
          id: `tv-${Date.now()}`,
          timestamp: new Date(),
          direction,
          confidence,
          reason: `TradingView signal: ${tvSignal}`,
          source: 'tradingview',
          price: 0,
        };

        this.emit('tradingview_signal', { signal: tvSignal, direction, confidence });
        this.executionAgent!.addSignal(signal);
      });
    }
  }

  // ============ LIFECYCLE ============

  async initialize(lnMarketsConfig?: LNMarketsConfig): Promise<void> {
    const config = lnMarketsConfig || this.config.lnMarkets;

    if (config) {
      this.lnMarkets = createLNMarketsService(config);

      // Verify connection
      const isConnected = await this.lnMarkets.ping();
      if (!isConnected) {
        throw new Error('Failed to connect to LN Markets');
      }

      // Inject service into agents
      if (this.riskManager) {
        this.riskManager.setLNMarketsService(this.lnMarkets);
      }

      if (this.executionAgent && this.riskManager && this.marketAnalyst) {
        this.executionAgent.setServices({
          lnMarkets: this.lnMarkets,
          riskManager: this.riskManager,
          marketAnalyst: this.marketAnalyst,
        });
      }

      this.emit('initialized', { authenticated: true });
    } else {
      // Public API only mode
      this.lnMarkets = createLNMarketsService();
      this.emit('initialized', { authenticated: false });
    }

    if (this.config.autoStart) {
      this.start();
    }
  }

  start(): void {
    if (this.running) {
      console.log('Swarm is already running');
      return;
    }

    console.log('Starting trading swarm...');
    this.running = true;

    for (const agent of this.agents.values()) {
      agent.start();
    }

    this.emit('started');
  }

  stop(): void {
    if (!this.running) {
      console.log('Swarm is not running');
      return;
    }

    console.log('Stopping trading swarm...');

    for (const agent of this.agents.values()) {
      agent.stop();
    }

    this.running = false;
    this.emit('stopped');
  }

  // ============ STATUS & METRICS ============

  async getStatus(): Promise<SwarmStatus> {
    const agents = Array.from(this.agents.values()).map((agent) => {
      const config = agent.getConfig();
      const metrics = agent.getMetrics();
      return {
        id: config.id,
        name: config.name,
        type: agent.getType(),
        status: agent.getStatus(),
        enabled: config.enabled,
        lastRunAt: metrics.lastRunAt,
      };
    });

    let balance: number | undefined;
    let openPositions: number | undefined;
    let dailyPL: number | undefined;

    if (this.lnMarkets) {
      try {
        balance = await this.lnMarkets.getBalance();
        const positions = await this.lnMarkets.getRunningIsolatedPositions();
        openPositions = positions.length;

        if (this.riskManager) {
          const assessment = this.riskManager.getLastAssessment();
          dailyPL = assessment?.dailyPL;
        }
      } catch (error) {
        console.error('Failed to fetch status metrics:', error);
      }
    }

    return {
      running: this.running,
      authenticated: this.lnMarkets !== null && this.config.lnMarkets !== undefined,
      agents,
      balance,
      openPositions,
      dailyPL,
    };
  }

  getAgent(id: string): BaseAgent | undefined {
    return this.agents.get(id);
  }

  getMarketAnalyst(): MarketAnalystAgent | null {
    return this.marketAnalyst;
  }

  getRiskManager(): RiskManagerAgent | null {
    return this.riskManager;
  }

  getExecutionAgent(): ExecutionAgent | null {
    return this.executionAgent;
  }

  getResearcher(): ResearcherAgent | null {
    return this.researcher;
  }

  getTradingView(): TradingViewAgent | null {
    return this.tradingView;
  }

  getLNMarkets(): LNMarketsService | null {
    return this.lnMarkets;
  }

  // ============ MANUAL CONTROLS ============

  async executeManualTrade(params: {
    direction: 'long' | 'short';
    marginPercent: number;
    leverage: number;
    stopLossPercent?: number;
    takeProfitPercent?: number;
  }): Promise<any> {
    if (!this.lnMarkets || !this.riskManager) {
      throw new Error('Trading not available - not authenticated');
    }

    const balance = await this.lnMarkets.getBalance();
    const ticker = await this.lnMarkets.getTicker();
    const currentPrice = ticker.lastPrice;

    const margin = Math.floor((balance * params.marginPercent) / 100);

    let stopLoss: number | undefined;
    let takeProfit: number | undefined;

    if (params.stopLossPercent) {
      stopLoss = params.direction === 'long'
        ? currentPrice * (1 - params.stopLossPercent / 100)
        : currentPrice * (1 + params.stopLossPercent / 100);
    }

    if (params.takeProfitPercent) {
      takeProfit = params.direction === 'long'
        ? currentPrice * (1 + params.takeProfitPercent / 100)
        : currentPrice * (1 - params.takeProfitPercent / 100);
    }

    return this.lnMarkets.openIsolatedPosition({
      type: 'market',
      side: params.direction === 'long' ? 'buy' : 'sell',
      margin,
      leverage: params.leverage,
      stoploss: stopLoss ? Math.round(stopLoss) : undefined,
      takeprofit: takeProfit ? Math.round(takeProfit) : undefined,
    });
  }

  async closeAllPositions(reason = 'Manual close'): Promise<void> {
    if (!this.executionAgent) {
      throw new Error('Execution agent not available');
    }
    await this.executionAgent.closeAllPositions(reason);
  }

  setAutoExecute(enabled: boolean): void {
    if (this.executionAgent) {
      this.executionAgent.setAutoExecute(enabled);
    }
  }

  isAutoExecuteEnabled(): boolean {
    return this.executionAgent?.isAutoExecuteEnabled() || false;
  }
}

// Singleton instance
let swarmInstance: SwarmCoordinator | null = null;

export function getSwarmCoordinator(config?: Partial<SwarmConfig>): SwarmCoordinator {
  if (!swarmInstance) {
    swarmInstance = new SwarmCoordinator(config);
  }
  return swarmInstance;
}

export function createSwarmCoordinator(config?: Partial<SwarmConfig>): SwarmCoordinator {
  return new SwarmCoordinator(config);
}
